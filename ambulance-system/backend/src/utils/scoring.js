const Hospital = require('../models/Hospital');
const { getDistance } = require('./distance');

/**
 * Emergency type → required specialist mapping
 */
const SPECIALIST_MAP = {
  Cardiac:   'cardiac',
  Stroke:    'neuro',
  Accident:  'trauma',
  Injury:    'ortho',
  Breathing: 'general',
  Unknown:   'general',
};

/**
 * findBestHospital — AI scoring algorithm
 *
 * Scoring weights:
 *   Beds availability  → 45 points max
 *   Specialist match   → 35 points max
 *   Distance (inverse) → 20 points max
 *
 * Returns hospital with highest score
 */
const findBestHospital = async (victimLat, victimLng, emergencyType = 'Unknown') => {
  const hospitals = await Hospital.find({ isActive: true });

  if (!hospitals.length) {
    throw new Error('No hospitals available');
  }

  const requiredSpecialist = SPECIALIST_MAP[emergencyType] || 'general';

  const scored = hospitals.map((hospital) => {
    const distance = getDistance(
      victimLat,
      victimLng,
      hospital.location.lat,
      hospital.location.lng
    );

    // ── Beds Score (0–45) ──────────────────────────────────────────────────
    // More beds = higher score; cap at 40 beds for max score
    const bedRatio = Math.min(hospital.availableBeds / 40, 1);
    const bedsScore = bedRatio * 45;

    // ── Specialist Score (0–35) ────────────────────────────────────────────
    const hasSpecialist = hospital.specialists.includes(requiredSpecialist);
    const hasGeneral = hospital.specialists.includes('general');
    let specialistScore = 0;
    if (hasSpecialist) specialistScore = 35;
    else if (hasGeneral) specialistScore = 15;

    // ── Distance Score (0–20) ─────────────────────────────────────────────
    // Closer = higher score; 0 km → 20 pts, 20 km → 0 pts
    const maxDistance = 20; // km
    const distanceScore = Math.max(0, ((maxDistance - distance) / maxDistance) * 20);

    const totalScore = bedsScore + specialistScore + distanceScore;

    return {
      hospital,
      distance: parseFloat(distance.toFixed(2)),
      score: parseFloat(totalScore.toFixed(1)),
      breakdown: { bedsScore, specialistScore, distanceScore },
    };
  });

  // Sort by score descending — best first
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  return {
    hospital: best.hospital,
    distance: best.distance,
    score: best.score,
    breakdown: best.breakdown,
  };
};

module.exports = { findBestHospital };
