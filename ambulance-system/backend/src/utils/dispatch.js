const Ambulance = require('../models/Ambulance');
const { getDistance } = require('./distance');

/**
 * findBestAmbulance
 * Filters available ambulances, prefers ICU type if needed,
 * sorts by distance to victim, returns closest one.
 */
const findBestAmbulance = async (victimLat, victimLng, needsICU = false) => {
  // Get all available ambulances
  let ambulances = await Ambulance.find({ status: 'available' });

  if (!ambulances.length) {
    throw new Error('No ambulances available at this time');
  }

  // If ICU required, prefer ICU ambulances; fall back to all if none available
  if (needsICU) {
    const icuAmbulances = ambulances.filter((a) => a.type === 'ICU');
    if (icuAmbulances.length > 0) {
      ambulances = icuAmbulances;
    }
  }

  // Score each ambulance by distance
  const scored = ambulances.map((amb) => {
    const distance = getDistance(
      victimLat,
      victimLng,
      amb.location.lat,
      amb.location.lng
    );
    return { ambulance: amb, distance };
  });

  // Sort by distance ascending — closest first
  scored.sort((a, b) => a.distance - b.distance);

  const best = scored[0];
  return {
    ambulance: best.ambulance,
    distance: parseFloat(best.distance.toFixed(2)),
  };
};

module.exports = { findBestAmbulance };
