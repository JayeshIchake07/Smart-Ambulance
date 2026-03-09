const express = require('express');
const Hospital = require('../models/Hospital');
const { protect } = require('../middleware/auth');
const { findBestHospital } = require('../utils/scoring');

const router = express.Router();

// ── GET /api/hospital ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isActive: true });
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/hospital/best ─────────────────────────────────────────────────
// ?lat=&lng=&type=
router.get('/best', async (req, res) => {
  try {
    const { lat, lng, type = 'Unknown' } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'lat and lng are required' });
    }

    const result = await findBestHospital(parseFloat(lat), parseFloat(lng), type);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/hospital/beds ─────────────────────────────────────────────────
router.put('/beds', protect, async (req, res) => {
  try {
    const { hospitalId, availableBeds } = req.body;

    const id = hospitalId || req.user.hospitalId;
    if (!id) return res.status(400).json({ message: 'hospitalId required' });

    const hospital = await Hospital.findByIdAndUpdate(
      id,
      { availableBeds },
      { new: true }
    );

    res.json(hospital);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/hospital/specialists ─────────────────────────────────────────
router.put('/specialists', protect, async (req, res) => {
  try {
    const { hospitalId, specialists } = req.body;

    const id = hospitalId || req.user.hospitalId;
    if (!id) return res.status(400).json({ message: 'hospitalId required' });

    const hospital = await Hospital.findByIdAndUpdate(
      id,
      { specialists },
      { new: true }
    );

    res.json(hospital);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
