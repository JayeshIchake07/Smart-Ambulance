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

    if (!lat || !lng) {
      return res.status(400).json({ message: 'lat and lng are required' });
    }

    // Determine if ICU is needed
    const needsICU = ['Cardiac', 'Stroke'].includes(emergencyType);

    // ── 1. Find best ambulance ─────────────────────────────────────────────
    const { ambulance, distance: ambDistance } = await findBestAmbulance(
      lat,
      lng,
      needsICU
    );

    // ── 2. Find best hospital (AI scored) ─────────────────────────────────
    const {
      hospital,
      distance: hospDistance,
      score: hospitalScore,
    } = await findBestHospital(lat, lng, emergencyType);

    // ── 3. Get OSRM routes ────────────────────────────────────────────────
    const routes = await getFullRoute(
      ambulance.location.lat,
      ambulance.location.lng,
      lat,
      lng,
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
      victimLocation: { lat, lng },
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
      victimLocation: { lat, lng },
      distance: ambDistance,
      eta,
      route: routes.toVictim.coordinates,
      hospital: {
        _id: hospital._id,
        name: hospital.name,
        address: hospital.address,
        location: hospital.location,
        score: hospitalScore,
      },
      routeToHospital: routes.toHospital.coordinates,
    });

    // Notify hospital
    io.to('hospital').emit('hospital-alert', {
      emergencyId: emergency._id,
      emergencyType,
      ambulanceETA: eta,
      ambulanceLocation: ambulance.location,
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
