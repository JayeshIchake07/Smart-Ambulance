const Ambulance = require('../models/Ambulance');
const Emergency = require('../models/Emergency');
const { getDistance } = require('./distance');

const TERMINAL_EMERGENCY_STATUSES = ['completed', 'cancelled'];
const STALE_EMERGENCY_MINUTES = 30;

const releaseReusableAmbulances = async () => {
  const cutoffTime = new Date(Date.now() - STALE_EMERGENCY_MINUTES * 60 * 1000);
  const ambulances = await Ambulance.find({ status: { $ne: 'available' } })
    .populate('currentEmergency', 'status updatedAt');

  const ambulanceIdsToRelease = [];
  const staleEmergencyIds = [];

  ambulances.forEach((ambulance) => {
    const emergency = ambulance.currentEmergency;

    if (!emergency) {
      ambulanceIdsToRelease.push(ambulance._id);
      return;
    }

    if (TERMINAL_EMERGENCY_STATUSES.includes(emergency.status)) {
      ambulanceIdsToRelease.push(ambulance._id);
      return;
    }

    if (emergency.updatedAt < cutoffTime) {
      ambulanceIdsToRelease.push(ambulance._id);
      staleEmergencyIds.push(emergency._id);
    }
  });

  if (staleEmergencyIds.length) {
    await Emergency.updateMany(
      { _id: { $in: staleEmergencyIds } },
      { status: 'cancelled' }
    );
  }

  if (ambulanceIdsToRelease.length) {
    await Ambulance.updateMany(
      { _id: { $in: ambulanceIdsToRelease } },
      { status: 'available', currentEmergency: null }
    );
  }

  return ambulanceIdsToRelease.length;
};

/**
 * findBestAmbulance
 * Filters available ambulances, prefers ICU type if needed,
 * sorts by distance to victim, returns closest one.
 */
const findBestAmbulance = async (victimLat, victimLng, needsICU = false) => {
  // Get all available ambulances
  let ambulances = await Ambulance.find({ status: 'available' });

  if (!ambulances.length) {
    const releasedCount = await releaseReusableAmbulances();

    if (releasedCount > 0) {
      ambulances = await Ambulance.find({ status: 'available' });
    }
  }

  if (!ambulances.length) {
    const error = new Error('No ambulances available at this time');
    error.code = 'NO_AMBULANCES_AVAILABLE';
    throw error;
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
