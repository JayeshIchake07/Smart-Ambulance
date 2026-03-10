const axios = require('axios');
const path = require('path');
const EtaModel = require('../ml/etaModel');

// Try to load a trained ETA model (optional)
try {
  const modelPath = path.resolve(__dirname, '..', '..', 'data', 'eta_model.json');
  EtaModel.load(modelPath);
  if (EtaModel.model) console.log('ETA model loaded from', modelPath);
} catch (e) {}

/**
 * getRoute — calls OSRM public API
 * Returns array of [lat, lng] coordinates for Leaflet polyline
 *
 * OSRM returns coordinates as [lng, lat] — we convert to [lat, lng]
 */
const getRoute = async (fromLat, fromLng, toLat, toLng) => {
  try {
    // OSRM public demo server (free, no API key)
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

    const response = await axios.get(url, { timeout: 8000 });

    if (
      response.data.code !== 'Ok' ||
      !response.data.routes ||
      !response.data.routes.length
    ) {
      throw new Error('OSRM returned no route');
    }

    const route = response.data.routes[0];
    const durationSeconds = route.duration;
    const distanceMeters = route.distance;

    // GeoJSON coordinates are [lng, lat] — flip to [lat, lng] for Leaflet
    const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
    let durationMinutes = Math.ceil(durationSeconds / 60);

    // If we have a trained ETA model, use it to predict duration (server-side prototype)
    try {
      if (EtaModel.model) {
        const hour = new Date().getHours();
        const dow = new Date().getDay();
        const pred = EtaModel.predict(distanceKm, hour, dow);
        if (pred && Number.isFinite(pred)) {
          durationMinutes = Math.max(1, Math.round(pred));
        }
      }
    } catch (e) {}

    return {
      coordinates, // [[lat, lng], ...]
      durationMinutes,
      distanceKm,
    };
  } catch (err) {
    console.warn(`⚠️ OSRM failed (${err.message}), using straight-line fallback`);

    // Fallback: straight line with 10 intermediate points
    const coordinates = generateStraightLine(fromLat, fromLng, toLat, toLng);
    const dist = haversineKm(fromLat, fromLng, toLat, toLng);
    let durationMinutes = Math.ceil((dist / 40) * 60); // 40 km/h city speed

    try {
      if (EtaModel.model) {
        const hour = new Date().getHours();
        const dow = new Date().getDay();
        const pred = EtaModel.predict(dist, hour, dow);
        if (pred && Number.isFinite(pred)) durationMinutes = Math.max(1, Math.round(pred));
      }
    } catch (e) {}

    return {
      coordinates,
      durationMinutes,
      distanceKm: parseFloat(dist.toFixed(2)),
    };
  }
};

/**
 * Get full route: ambulance → victim → hospital (combined)
 */
const getFullRoute = async (ambLat, ambLng, victimLat, victimLng, hospLat, hospLng) => {
  const [toVictim, toHospital] = await Promise.all([
    getRoute(ambLat, ambLng, victimLat, victimLng),
    getRoute(victimLat, victimLng, hospLat, hospLng),
  ]);

  return {
    toVictim,
    toHospital,
    totalDurationMinutes: toVictim.durationMinutes + toHospital.durationMinutes,
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const toRad = (deg) => (deg * Math.PI) / 180;

const generateStraightLine = (lat1, lng1, lat2, lng2, points = 12) => {
  const coords = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    coords.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]);
  }
  return coords;
};

module.exports = { getRoute, getFullRoute };
