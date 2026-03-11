const express = require('express');
const Emergency = require('../models/Emergency');
const Ambulance = require('../models/Ambulance');
const { protect } = require('../middleware/auth');
const { findBestAmbulance } = require('../utils/dispatch');
const { findBestHospital } = require('../utils/scoring');
const { getFullRoute } = require('../utils/routeEngine');
const { getETA } = require('../utils/distance');

const router = express.Router();

// ── POST /api/dispatch ─────────────────────────────────────────────────────
// Main SOS trigger — victim calls this when they press SOS
router.post('/', protect, async (req, res) => {
  try {
    const { lat, lng, emergencyType = 'Unknown' } = req.body;
    const victimLat = Number(lat);
    const victimLng = Number(lng);

    if (!Number.isFinite(victimLat) || !Number.isFinite(victimLng)) {
      return res.status(400).json({ message: 'lat and lng are required' });
    }

    console.log('[dispatch] incoming SOS request:', {
      patientId: req.user?._id,
      emergencyType,
      lat: victimLat,
      lng: victimLng,
    });

    // Determine if ICU is needed
    const needsICU = ['Cardiac', 'Stroke'].includes(emergencyType);

    // ── 1. Find best ambulance ─────────────────────────────────────────────
    const { ambulance, distance: ambDistance } = await findBestAmbulance(
      victimLat,
      victimLng,
      needsICU
    );

    // ── 2. Find best hospital (AI scored) ─────────────────────────────────
    const {
      hospital,
      distance: hospDistance,
      score: hospitalScore,
      breakdown: hospitalScoreBreakdown,
    } = await findBestHospital(victimLat, victimLng, emergencyType);

    // ── 3. Get OSRM routes ────────────────────────────────────────────────
    const routes = await getFullRoute(
      ambulance.location.lat,
      ambulance.location.lng,
      victimLat,
      victimLng,
      hospital.location.lat,
      hospital.location.lng
    );

    const eta = routes.toVictim.durationMinutes;

    // ── 4. Save Emergency to DB ───────────────────────────────────────────
    const emergency = await Emergency.create({
      patient: req.user._id,
      ambulance: ambulance._id,
      hospital: hospital._id,
      emergencyType,
      status: 'dispatched',
      victimLocation: { lat: victimLat, lng: victimLng },
      route: routes.toVictim.coordinates,
      eta,
      hospitalScore,
      needsICU,
    });

    // ── 5. Mark ambulance as dispatched ──────────────────────────────────
    await Ambulance.findByIdAndUpdate(ambulance._id, {
      status: 'dispatched',
      currentEmergency: emergency._id,
    });

    // ── 6. Emit socket events ─────────────────────────────────────────────
    const io = req.app.get('io');

    // Notify driver
    io.to('driver').emit('new-emergency', {
      emergencyId: emergency._id,
      emergencyType,
      victimLocation: { lat: victimLat, lng: victimLng },
      distance: ambDistance,
      eta,
      route: routes.toVictim.coordinates,
      hospital: {
        _id: hospital._id,
        name: hospital.name,
        address: hospital.address,
        location: hospital.location,
        score: hospitalScore,
        distance: hospDistance,
        breakdown: hospitalScoreBreakdown,
      },
      routeToHospital: routes.toHospital.coordinates,
    });

    // Notify hospital
    io.to('hospital').emit('hospital-alert', {
      emergencyId: emergency._id,
      patientType: emergencyType,
      emergencyType,
      status: 'dispatched',
      ambulanceETA: eta,
      ambulanceLocation: ambulance.location,
      victimLocation: { lat: victimLat, lng: victimLng },
      hospitalId: hospital._id,
      hospitalName: hospital.name,
      hospitalLocation: hospital.location,
      route: routes.toVictim.coordinates,
      routeToHospital: routes.toHospital.coordinates,
    });

    // ── 7. Respond to victim ──────────────────────────────────────────────
    res.status(201).json({
      emergencyId: emergency._id,
      status: 'dispatched',
      ambulance: {
        _id: ambulance._id,
        vehicle: ambulance.vehicle,
        type: ambulance.type,
        driverName: ambulance.driverName,
        location: ambulance.location,
        distance: ambDistance,
      },
      hospital: {
        _id: hospital._id,
        name: hospital.name,
        address: hospital.address,
        location: hospital.location,
        score: hospitalScore,
        breakdown: hospitalScoreBreakdown,
        availableBeds: hospital.availableBeds,
        specialists: hospital.specialists,
        distance: hospDistance,
      },
      route: routes.toVictim.coordinates,
      routeToHospital: routes.toHospital.coordinates,
      eta,
    });
  } catch (err) {
    console.error('Dispatch error:', err.message);

    if (err.code === 'NO_AMBULANCES_AVAILABLE') {
      return res.status(409).json({ message: err.message });
    }

    if (err.message === 'No hospitals available') {
      return res.status(503).json({ message: err.message });
    }

    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/dispatch/:id ──────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id)
      .populate('ambulance')
      .populate('hospital')
      .populate('patient', '-password');

    if (!emergency) {
      return res.status(404).json({ message: 'Emergency not found' });
    }

    res.json(emergency);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/dispatch/:id/status ───────────────────────────────────────────
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const emergency = await Emergency.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!emergency) {
      return res.status(404).json({ message: 'Emergency not found' });
    }

    res.json(emergency);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
