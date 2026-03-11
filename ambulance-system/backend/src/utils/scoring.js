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
 * findBestHospital — nearest eligible hospital selector
 *
 * Selection priority:
 *   1. Hospitals with the required specialist
 *   2. Hospitals with general capability
 *   3. Remaining active hospitals
 *   4. Within the best capability tier, choose the nearest hospital
 *   5. Use beds/score only as tie-breakers
 */
const findBestHospital = async (victimLat, victimLng, emergencyType = 'Unknown') => {
  const lat = Number(victimLat);
  const lng = Number(victimLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid victim coordinates for hospital scoring');
  }

  const hospitals = await Hospital.find({ isActive: true });

  if (!hospitals.length) {
    throw new Error('No hospitals available');
  }

  const requiredSpecialist = SPECIALIST_MAP[emergencyType] || 'general';

  console.log('[findBestHospital] incoming coordinates:', {
    lat,
    lng,
    emergencyType,
    requiredSpecialist,
  });

  const scored = hospitals.map((hospital) => {
    const distance = getDistance(
      lat,
      lng,
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
    const specialistTier = hasSpecialist ? 2 : hasGeneral ? 1 : 0;
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
      specialistTier,
      breakdown: {
        bedsScore: parseFloat(bedsScore.toFixed(1)),
        specialistScore: parseFloat(specialistScore.toFixed(1)),
        distanceScore: parseFloat(distanceScore.toFixed(1)),
      },
    };
  });

  console.table(
    scored.map((entry) => ({
      hospital: entry.hospital.name,
      distanceKm: entry.distance,
      beds: entry.hospital.availableBeds,
      specialists: (entry.hospital.specialists || []).join(', '),
      specialistTier: entry.specialistTier,
      bedsScore: entry.breakdown.bedsScore,
      specialistScore: entry.breakdown.specialistScore,
      distanceScore: entry.breakdown.distanceScore,
      totalScore: entry.score,
    }))
  );

  const bestTier = Math.max(...scored.map((entry) => entry.specialistTier));

  const eligible = scored.filter((entry) => entry.specialistTier === bestTier);

  eligible.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }

    if (a.hospital.availableBeds !== b.hospital.availableBeds) {
      return b.hospital.availableBeds - a.hospital.availableBeds;
    }

    return b.score - a.score;
  });

  const best = eligible[0];
  console.log('[findBestHospital] selected hospital:', {
    hospital: best.hospital.name,
    distanceKm: best.distance,
    specialistTier: best.specialistTier,
    score: best.score,
    breakdown: best.breakdown,
  });

  return {
    hospital: best.hospital,
    distance: best.distance,
    score: best.score,
    breakdown: best.breakdown,
  };
};

module.exports = { findBestHospital };
