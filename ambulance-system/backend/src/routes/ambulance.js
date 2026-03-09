const express = require('express');
const Ambulance = require('../models/Ambulance');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/ambulance ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const ambulances = await Ambulance.find().populate('driver', 'name email');
    res.json(ambulances);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/ambulance/location ────────────────────────────────────────────
router.put('/location', protect, async (req, res) => {
  try {
    const { lat, lng, ambulanceId } = req.body;

    const id = ambulanceId || req.user.ambulanceId;
    if (!id) return res.status(400).json({ message: 'ambulanceId required' });

    const ambulance = await Ambulance.findByIdAndUpdate(
      id,
      { 'location.lat': lat, 'location.lng': lng },
      { new: true }
    );

    res.json(ambulance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/ambulance/status ──────────────────────────────────────────────
router.put('/status', protect, async (req, res) => {
  try {
    const { status, ambulanceId } = req.body;

    const id = ambulanceId || req.user.ambulanceId;
    if (!id) return res.status(400).json({ message: 'ambulanceId required' });

    const ambulance = await Ambulance.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    res.json(ambulance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
