function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildVehicleMarkerHtml(markerVariant) {
  if (markerVariant === 'arrow') {
    return `
      <div class="vehicle-arrow-wrap">
        <div id="vehicle-rotator" class="vehicle-arrow-rotator">
          <div class="vehicle-arrow-core"></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="vehicle-ambulance-wrap">
      <div id="vehicle-rotator" class="vehicle-ambulance-rotator">
        <svg viewBox="0 0 64 64" aria-hidden="true" class="vehicle-ambulance-svg">
          <rect x="8" y="24" width="30" height="18" rx="6" fill="#12b76a"></rect>
          <path d="M38 28h10l8 9v5H38z" fill="#0c8a58"></path>
          <rect x="14" y="28" width="8" height="8" fill="#ffffff"></rect>
          <rect x="17" y="25" width="2" height="14" fill="#ffffff"></rect>
          <rect x="11" y="31" width="14" height="2" fill="#ffffff"></rect>
          <circle cx="20" cy="45" r="5" fill="#132238"></circle>
          <circle cx="47" cy="45" r="5" fill="#132238"></circle>
          <rect x="42" y="30" width="8" height="5" rx="2" fill="#b7f7d8"></rect>
        </svg>
      </div>
    </div>
  `;
}

function buildNavigationMapHtml(options = {}) {
  const {
    startLat = 19.076,
    startLng = 72.8777,
    destinationLat = 19.0544,
    destinationLng = 72.8322,
    title = 'Live Navigation',
    phaseLabel = 'Navigation Active',
    destinationLabel = 'Destination',
    panelSubtitle = '',
    markerVariant = 'ambulance',
    hintText = 'Tap map to show navigation',
    routeCoordinates = [],
    hospitals = [],
  } = options;

  const safeTitle = escapeHtml(title);
  const safePhaseLabel = escapeHtml(phaseLabel);
  const safeDestinationLabel = escapeHtml(destinationLabel);
  const safePanelSubtitle = escapeHtml(panelSubtitle);
  const safeHintText = escapeHtml(hintText);
  const vehicleMarkerHtmlLiteral = JSON.stringify(buildVehicleMarkerHtml(markerVariant));
  const routeCoordinatesLiteral = JSON.stringify(
    Array.isArray(routeCoordinates)
      ? routeCoordinates
          .map((point) => {
            if (!Array.isArray(point) || point.length < 2) return null;
            const lat = Number(point[0]);
            const lng = Number(point[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return [lat, lng];
          })
          .filter(Boolean)
      : []
  );
  const hospitalsLiteral = JSON.stringify(Array.isArray(hospitals) ? hospitals : []);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
  <style>
    :root {
      --bg: #eef3f8;
      --panel-bg: rgba(255, 255, 255, 0.96);
      --panel-border: rgba(16, 24, 40, 0.08);
      --text: #132238;
      --muted: #5d6b82;
      --accent: #11a36a;
      --accent-strong: #0c8a58;
      --shadow: 0 18px 40px rgba(21, 35, 52, 0.16);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html,
    body,
    #map {
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #f8fbfe 0%, var(--bg) 100%);
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }

    body {
      overflow: hidden;
      color: var(--text);
    }

    .nav-panel {
      position: absolute;
      top: 16px;
      left: 16px;
      z-index: 1000;
      width: min(340px, calc(100vw - 32px));
      padding: 16px;
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      background: var(--panel-bg);
      backdrop-filter: blur(14px);
      box-shadow: var(--shadow);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .nav-panel--hidden {
      opacity: 0;
      transform: translateY(-8px);
      pointer-events: none;
    }

    .nav-hint {
      position: absolute;
      top: 16px;
      left: 16px;
      z-index: 999;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(19, 34, 56, 0.86);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.2);
      display: none;
    }

    .nav-hint--visible {
      display: block;
    }

    .panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .eyebrow {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent-strong);
    }

    h1,
    h2 {
      margin: 0;
    }

    h1 {
      font-size: 22px;
      line-height: 1.1;
    }

    .panel-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-pill {
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(17, 163, 106, 0.12);
      color: var(--accent-strong);
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .panel-close {
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 999px;
      background: rgba(19, 34, 56, 0.08);
      color: #132238;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 16px;
    }

    .summary-card {
      padding: 14px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(235, 243, 249, 0.96));
      border: 1px solid rgba(16, 24, 40, 0.06);
    }

    .summary-label {
      display: block;
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 12px;
    }

    .summary-card strong {
      font-size: 16px;
    }

    .subtext {
      margin-top: 12px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }

    .instructions-block {
      margin-top: 16px;
    }

    .instructions-list {
      margin: 10px 0 0;
      padding-left: 20px;
      max-height: min(34vh, 220px);
      overflow: auto;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
    }

    .instructions-list li {
      padding: 8px 0;
    }

    .instructions-list li + li {
      border-top: 1px solid rgba(16, 24, 40, 0.06);
    }

    .leaflet-control-container .leaflet-routing-container {
      display: none;
    }

    .leaflet-control-zoom {
      margin-top: 118px !important;
      border: none !important;
      box-shadow: var(--shadow) !important;
    }

    .leaflet-control-zoom a {
      width: 42px !important;
      height: 42px !important;
      line-height: 42px !important;
      border: none !important;
      color: var(--text) !important;
    }

    .vehicle-ambulance-wrap,
    .vehicle-arrow-wrap {
      width: 56px;
      height: 56px;
      display: grid;
      place-items: center;
    }

    .vehicle-ambulance-rotator {
      --heading: 0deg;
      width: 56px;
      height: 56px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #edf6f2 100%);
      border: 2px solid rgba(17, 163, 106, 0.28);
      box-shadow: 0 10px 20px rgba(12, 138, 88, 0.28);
      transform: rotate(var(--heading));
      transition: transform 0.16s linear;
    }

    .vehicle-ambulance-svg {
      width: 32px;
      height: 32px;
    }

    .vehicle-arrow-rotator {
      --heading: 0deg;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      transform: rotate(var(--heading));
      transition: transform 0.16s linear;
      filter: drop-shadow(0 10px 18px rgba(10, 132, 255, 0.35));
    }

    .vehicle-arrow-core {
      position: relative;
      width: 0;
      height: 0;
      border-left: 14px solid transparent;
      border-right: 14px solid transparent;
      border-bottom: 28px solid #0a84ff;
    }

    .vehicle-arrow-core::after {
      content: '';
      position: absolute;
      left: -8px;
      top: 8px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 16px solid #ffffff;
    }

    /* Hospital marker styles */
    .hospital-marker {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 18px;
      color: #fff;
      font-weight: 700;
      box-shadow: 0 6px 12px rgba(0,0,0,0.18);
      border: 2px solid #fff;
      font-size: 12px;
    }
    .hospital-marker--green { background: #10b981; }
    .hospital-marker--orange { background: #ff9f0a; }
    .hospital-marker--red { background: #ff3b30; }
    .hospital-marker .label { padding: 0 4px; }
    .custom-cluster { display: inline-grid; place-items: center; color: #fff; font-weight: 700; border-radius: 999px; }
    .marker-cluster-small { background: rgba(16,24,40,0.9); width:34px; height:34px; }
    .marker-cluster-medium { background: rgba(10,132,255,0.95); width:44px; height:44px; }
    .marker-cluster-large { background: rgba(17,163,106,0.95); width:56px; height:56px; }
    /* Specialty legend */
    .specialty-legend {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 1100;
      display: flex;
      gap: 8px;
      align-items: center;
      pointer-events: auto;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 12px;
      background: rgba(255,255,255,0.9);
      box-shadow: 0 6px 14px rgba(10,20,40,0.08);
      cursor: pointer;
      font-size: 13px;
      color: #111827;
      user-select: none;
    }

    .legend-item--inactive { opacity: 0.45; }

    .legend-icon { width: 18px; height: 18px; display: inline-block; }

    .destination-pin {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #1d4ed8;
      border: 4px solid #ffffff;
      box-shadow: 0 8px 18px rgba(29, 78, 216, 0.28);
    }

    .destination-badge {
      margin-top: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(19, 34, 56, 0.92);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      .nav-panel {
        top: 12px;
        left: 12px;
        width: calc(100vw - 24px);
        padding: 14px;
      }

      .summary-grid {
        grid-template-columns: 1fr;
      }

      .leaflet-control-zoom {
        margin-top: 250px !important;
      }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="nav-hint" class="nav-hint">${safeHintText}</div>

  <aside id="nav-panel" class="nav-panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Live Navigation</p>
        <h1 id="map-title">${safeTitle}</h1>
      </div>
      <div class="panel-actions">
        <span id="status-label" class="status-pill">${safePhaseLabel}</span>
        <button id="panel-close" class="panel-close" type="button" aria-label="Hide navigation">×</button>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">Distance </span>
        <strong id="distance">Calculating...</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">ETA</span>
        <strong id="eta">Calculating...</strong>
      </div>
    </div>

    <p id="panel-subtitle" class="subtext">${safePanelSubtitle}</p>

    <div class="instructions-block">
      <h2>Turn-by-turn</h2>
      <ol id="instructions" class="instructions-list">
        <li>Fetching the best route...</li>
      </ol>
    </div>
  </aside>

  <script>
    var ROUTE_BASE_COLOR = '#007AFF';
    var SIGNAL_WAVE_COLOR = '#34C759';
    var SIGNAL_WAVE_OPACITY = 0.9;
    var SIGNAL_WAVE_REPEAT_MS = 9000;
    var SIGNAL_WAVE_ACTIVE_MS = 1400;
    var SIGNAL_WAVE_FADE_MS = 600;
    var SIGNAL_WAVE_SEGMENT_SIZE = 8;

    var state = {
      currentPosition: L.latLng(${Number(startLat)}, ${Number(startLng)}),
      destination: L.latLng(${Number(destinationLat)}, ${Number(destinationLng)}),
      destinationLabel: '${safeDestinationLabel}',
      title: '${safeTitle}',
      phaseLabel: '${safePhaseLabel}',
      panelSubtitle: '${safePanelSubtitle}',
      etaLabel: '',
      routeCoordinates: (${routeCoordinatesLiteral} || []).map(function(p) { return L.latLng(p[0], p[1]); }),
      hospitals: (${hospitalsLiteral} || []).map(function(h) {
        if (!h || !h.location) return null;
        return {
          name: h.name || 'Hospital',
          address: h.address || '',
          lat: Number(h.location.lat),
          lng: Number(h.location.lng),
          specialists: h.specialists || [],
          availableBeds: typeof h.availableBeds === 'number' ? h.availableBeds : (h.availableBeds ? Number(h.availableBeds) : 0),
          phone: h.phone || ''
        };
      }).filter(Boolean),
    };

    var map = L.map('map', { zoomControl: true, preferCanvas: true }).setView(state.currentPosition, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var navPanel = document.getElementById('nav-panel');
    var navHint = document.getElementById('nav-hint');
    var panelClose = document.getElementById('panel-close');
    var titleEl = document.getElementById('map-title');
    var statusEl = document.getElementById('status-label');
    var subtitleEl = document.getElementById('panel-subtitle');
    var distanceEl = document.getElementById('distance');
    var etaEl = document.getElementById('eta');
    var instructionsEl = document.getElementById('instructions');
    var animFrame = null;

    function showPanel() {
      navPanel.classList.remove('nav-panel--hidden');
      navHint.classList.remove('nav-hint--visible');
    }

    function hidePanel() {
      navPanel.classList.add('nav-panel--hidden');
      navHint.classList.add('nav-hint--visible');
    }

    panelClose.addEventListener('click', function(event) {
      event.stopPropagation();
      hidePanel();
    });

    map.on('click', function() {
      showPanel();
    });

    function formatDistance(distanceInMeters) {
      if (distanceInMeters >= 1000) {
        return (distanceInMeters / 1000).toFixed(1) + ' km';
      }
      return Math.round(distanceInMeters) + ' m';
    }

    function formatDuration(durationInSeconds) {
      var totalMinutes = Math.max(1, Math.round(durationInSeconds / 60));
      var hours = Math.floor(totalMinutes / 60);
      var minutes = totalMinutes % 60;
      if (!hours) {
        return totalMinutes + ' min';
      }
      return hours + ' hr ' + minutes + ' min';
    }

    function toRadians(value) {
      return (value * Math.PI) / 180;
    }

    // ── route helpers (defined before use) ──────────────────────────────────
    var routeLine = null;
    var signalWaveInterval = null;
    var signalWaveTimeouts = [];
    var signalWaveLayers = [];
    var signalWaveFrames = [];
    var signalWaveRouteKey = '';

    function calculateDistanceMeters(a, b) {
      var radiusMeters = 6371000;
      var deltaLat = toRadians(b.lat - a.lat);
      var deltaLng = toRadians(b.lng - a.lng);
      var lat1 = toRadians(a.lat);
      var lat2 = toRadians(b.lat);
      var aa = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      var c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return radiusMeters * c;
    }

    function getNearestRouteIndex(routePoints, currentPoint) {
      if (!routePoints || !routePoints.length) return -1;
      var nearestIndex = 0;
      var nearestDistance = Number.POSITIVE_INFINITY;
      routePoints.forEach(function(point, index) {
        var d = calculateDistanceMeters(currentPoint, point);
        if (d < nearestDistance) { nearestDistance = d; nearestIndex = index; }
      });
      return nearestIndex;
    }

    function getRemainingRouteDistanceMeters(routePoints, currentPoint) {
      if (!routePoints || !routePoints.length) {
        return calculateDistanceMeters(currentPoint, state.destination);
      }
      var nearestIndex = getNearestRouteIndex(routePoints, currentPoint);
      if (nearestIndex < 0) return calculateDistanceMeters(currentPoint, state.destination);
      var total = calculateDistanceMeters(currentPoint, routePoints[nearestIndex]);
      for (var i = nearestIndex; i < routePoints.length - 1; i += 1) {
        total += calculateDistanceMeters(routePoints[i], routePoints[i + 1]);
      }
      return total;
    }

    function routeKeyFromPoints(routePoints) {
      if (!routePoints || routePoints.length < 2) return '';

      var first = routePoints[0];
      var last = routePoints[routePoints.length - 1];
      return [
        routePoints.length,
        first.lat.toFixed(5),
        first.lng.toFixed(5),
        last.lat.toFixed(5),
        last.lng.toFixed(5)
      ].join(':');
    }

    function clearSignalWavePass() {
      signalWaveTimeouts.forEach(function(timeoutId) {
        clearTimeout(timeoutId);
      });
      signalWaveTimeouts = [];

      signalWaveFrames.forEach(function(frameId) {
        cancelAnimationFrame(frameId);
      });
      signalWaveFrames = [];

      signalWaveLayers.forEach(function(layer) {
        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
      signalWaveLayers = [];
    }

    function stopSignalWave() {
      if (signalWaveInterval) {
        clearInterval(signalWaveInterval);
        signalWaveInterval = null;
      }

      clearSignalWavePass();
    }

    function buildSignalWaveSegments(routePoints) {
      var segments = [];
      if (!routePoints || routePoints.length < 2) {
        return segments;
      }

      for (var startIndex = 0; startIndex < routePoints.length - 1; startIndex += SIGNAL_WAVE_SEGMENT_SIZE) {
        var endIndex = Math.min(startIndex + SIGNAL_WAVE_SEGMENT_SIZE, routePoints.length - 1);
        var segmentPoints = routePoints.slice(startIndex, endIndex + 1);

        if (segmentPoints.length > 1) {
          segments.push(segmentPoints);
        }
      }

      return segments;
    }

    function fadeOutSignalLayer(layer) {
      var fadeStartedAt = performance.now();

      function step(now) {
        var progress = Math.min(1, (now - fadeStartedAt) / SIGNAL_WAVE_FADE_MS);

        if (layer && map.hasLayer(layer)) {
          layer.setStyle({ opacity: SIGNAL_WAVE_OPACITY * (1 - progress) });
        }

        if (progress < 1) {
          var frameId = requestAnimationFrame(step);
          signalWaveFrames.push(frameId);
        } else if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      }

      var initialFrameId = requestAnimationFrame(step);
      signalWaveFrames.push(initialFrameId);
    }

    function runSignalWavePass() {
      clearSignalWavePass();

      var segments = buildSignalWaveSegments(state.routeCoordinates);
      if (!segments.length) {
        return;
      }

      var staggerMs = Math.min(260, Math.max(110, Math.round(2400 / segments.length)));

      segments.forEach(function(segmentPoints, index) {
        var startTimeoutId = setTimeout(function() {
          var segmentLayer = L.polyline(segmentPoints, {
            color: SIGNAL_WAVE_COLOR,
            weight: 10,
            opacity: SIGNAL_WAVE_OPACITY,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          signalWaveLayers.push(segmentLayer);

          var fadeTimeoutId = setTimeout(function() {
            fadeOutSignalLayer(segmentLayer);
          }, SIGNAL_WAVE_ACTIVE_MS);

          signalWaveTimeouts.push(fadeTimeoutId);
        }, index * staggerMs);

        signalWaveTimeouts.push(startTimeoutId);
      });
    }

    function restartSignalWave() {
      stopSignalWave();

      if (!state.routeCoordinates || state.routeCoordinates.length < 2) {
        return;
      }

      runSignalWavePass();
      signalWaveInterval = setInterval(runSignalWavePass, SIGNAL_WAVE_REPEAT_MS);
    }

    function renderStaticRoute(shouldFitBounds) {
      if (!state.routeCoordinates || !state.routeCoordinates.length) return false;

      if (!routeLine) {
        routeLine = L.polyline(state.routeCoordinates, {
          color: ROUTE_BASE_COLOR, weight: 8, opacity: 0.95,
          lineCap: 'round', lineJoin: 'round',
        }).addTo(map);
      } else {
        routeLine.setStyle({ color: ROUTE_BASE_COLOR, weight: 8, opacity: 0.95 });
        routeLine.setLatLngs(state.routeCoordinates);
      }

      if (shouldFitBounds) {
        var bounds = routeLine.getBounds();
        bounds.extend(state.currentPosition);
        bounds.extend(state.destination);
        (state.hospitals || []).forEach(function(hospital) {
          var hospitalLat = Number(hospital.lat || (hospital.location && hospital.location.lat));
          var hospitalLng = Number(hospital.lng || (hospital.location && hospital.location.lng));
          if (Number.isFinite(hospitalLat) && Number.isFinite(hospitalLng)) {
            bounds.extend([hospitalLat, hospitalLng]);
          }
        });
        map.fitBounds(bounds, { padding: [36, 36], animate: false });
      }

      var nextRouteKey = routeKeyFromPoints(state.routeCoordinates);
      if (nextRouteKey !== signalWaveRouteKey) {
        signalWaveRouteKey = nextRouteKey;
        restartSignalWave();
      }

      var remaining = getRemainingRouteDistanceMeters(state.routeCoordinates, state.currentPosition);
      distanceEl.textContent = formatDistance(remaining);
      etaEl.textContent = state.etaLabel || formatDuration((remaining / 1000 / 40) * 3600);
      renderInstructions([{ text: 'Continue toward ' + state.destinationLabel, distance: remaining }]);
      return true;
    }

    function clearStaticRoute() {
      stopSignalWave();
      signalWaveRouteKey = '';

      if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
    }

    function calculateBearing(from, to) {
      var lat1 = toRadians(from.lat);
      var lat2 = toRadians(to.lat);
      var deltaLng = toRadians(to.lng - from.lng);
      var y = Math.sin(deltaLng) * Math.cos(lat2);
      var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
      return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    }

    function setHeading(from, to) {
      var marker = document.getElementById('vehicle-rotator');
      if (!marker) {
        return;
      }
      marker.style.setProperty('--heading', calculateBearing(from, to) + 'deg');
    }

    function setHeaderContent() {
      titleEl.textContent = state.title;
      statusEl.textContent = state.phaseLabel;
      subtitleEl.textContent = state.panelSubtitle;
    }

    function renderInstructions(instructions) {
      instructionsEl.innerHTML = '';
      if (!instructions || !instructions.length) {
        instructionsEl.innerHTML = '<li>Continue on the highlighted route.</li>';
        return;
      }

      instructions.forEach(function(instruction) {
        var li = document.createElement('li');
        li.textContent = instruction.text + ' (' + formatDistance(instruction.distance || 0) + ')';
        instructionsEl.appendChild(li);
      });
    }

    var vehicleIcon = L.divIcon({
      className: '',
      iconSize: [56, 56],
      iconAnchor: [28, 28],
      html: ${vehicleMarkerHtmlLiteral}
    });

    function destinationIconHtml(label) {
      return '<div class="destination-pin"></div><div class="destination-badge">' + label + '</div>';
    }

    var destinationIcon = L.divIcon({
      className: '',
      iconSize: [110, 42],
      iconAnchor: [9, 9],
      html: destinationIconHtml(state.destinationLabel)
    });

    var vehicleMarker = L.marker(state.currentPosition, { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(map);
    var targetMarker = L.marker(state.destination, { icon: destinationIcon }).addTo(map);

    // Hospital clustering + distinct icons
    var hospitalClusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      iconCreateFunction: function(cluster) {
        var count = cluster.getChildCount();
        var size = 'small';
        if (count >= 50) size = 'large';
        else if (count >= 15) size = 'medium';

        var cls = 'marker-cluster-' + size;
        var html = '<div class="custom-cluster ' + cls + '"><span>' + count + '</span></div>';
        return L.divIcon({ html: html, className: '', iconSize: size === 'large' ? [56,56] : size === 'medium' ? [44,44] : [34,34], iconAnchor: [16,16] });
      }
    });
    var hospitalMarkers = [];

    function createHospitalDivIcon(hospital) {
      var count = hospital.availableBeds || 0;
      var cls = 'hospital-marker--green';
      if (count < 8) cls = 'hospital-marker--red';
      else if (count < 20) cls = 'hospital-marker--orange';

      // Determine primary specialty and choose SVG
      var specialty = (hospital.specialists && hospital.specialists[0]) || '';
      var svg = '';
      var titleSuffix = '';
      switch ((specialty || '').toLowerCase()) {
        case 'cardiac':
          svg = '<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M12 21s-7-4.35-9-7.09C-1 9.42 3.33 4 8.5 6.5 12 8 12 12 12 12s0-4 3.5-5.5C20.67 4 25 9.42 21 13.91 19 16.65 12 21 12 21z"/></svg>';
          titleSuffix = ' Cardiac';
          break;
        case 'neuro':
          svg = '<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M12 2a5 5 0 0 0-5 5v1H5a3 3 0 0 0-3 3v3a6 6 0 0 0 6 6h6a6 6 0 0 0 6-6v-3a3 3 0 0 0-3-3h-2V7a5 5 0 0 0-5-5z"/></svg>';
          titleSuffix = ' Neuro';
          break;
        case 'trauma':
          svg = '<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M21 11h-8V3H11v8H3v2h8v8h2v-8h8z"/></svg>';
          titleSuffix = ' Trauma';
          break;
        case 'ortho':
          svg = '<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M12 2a2 2 0 0 0-2 2v3H7v2h3v6H8v2h3v3a2 2 0 0 0 4 0v-3h3v-2h-3v-6h3V9h-3V4a2 2 0 0 0-2-2z"/></svg>';
          titleSuffix = ' Ortho';
          break;
        case 'oncology':
          svg = '<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M12 2a5 5 0 0 1 5 5c0 3-5 6-5 6s-5-3-5-6a5 5 0 0 1 5-5zM4 20v-2a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v2H4z"/></svg>';
          titleSuffix = ' Oncology';
          break;
        case 'general':
        default:
          svg = '<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M12 2L8 6v6H2v8h20v-8h-6V6z"/></svg>';
          titleSuffix = ' General';
      }

      var html = '<div class="hospital-marker ' + cls + '"><span class="label">' + svg + '</span></div>';
      var icon = L.divIcon({ html: html, className: '', iconSize: [34, 34], iconAnchor: [17, 17] });
      icon._title = (hospital.name || 'Hospital') + (titleSuffix || '');
      icon._specialty = (specialty || 'general').toLowerCase();
      return icon;
    }

    function clearHospitalMarkers() {
      try {
        hospitalMarkers.forEach(function(m) { hospitalClusterGroup.removeLayer(m); });
        hospitalMarkers = [];
        if (map.hasLayer(hospitalClusterGroup)) map.removeLayer(hospitalClusterGroup);
      } catch (e) {}
    }

    function renderHospitalMarkers(hospitals) {
      clearHospitalMarkers();
      if (!hospitals || !hospitals.length) return;

      // compute unique specialties
      var specialtySet = {};
      hospitals.forEach(function(h) { if (h.specialists && h.specialists.length) specialtySet[(h.specialists[0]||'general').toLowerCase()] = true; });
      var specialtiesList = Object.keys(specialtySet);

      hospitals.forEach(function(h) {
        try {
          var lat = Number(h.lat || (h.location && h.location.lat));
          var lng = Number(h.lng || (h.location && h.location.lng));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          var icon = createHospitalDivIcon(h);
          var marker = L.marker([lat, lng], { icon: icon, title: icon._title || h.name });
          marker._specialty = (icon._specialty || (h.specialists && h.specialists[0]) || 'general').toLowerCase();
          marker.bindPopup('<strong>' + (h.name || 'Hospital') + '</strong><br/>' + (h.address || '') + '<br/>Beds: ' + (h.availableBeds || 0));
          hospitalMarkers.push(marker);
          hospitalClusterGroup.addLayer(marker);
        } catch (e) {}
      });

      map.addLayer(hospitalClusterGroup);

      // render legend (specialty filter)
      renderSpecialtyLegend(specialtiesList);
    }

    // Try to fetch hospitals from backend if none provided
    (function ensureHospitals() {
      if (state.hospitals && state.hospitals.length) {
        renderHospitalMarkers(state.hospitals);
        return;
      }

      // attempt to fetch; ignore failures
      try {
        fetch('/api/hospital').then(function(res) { return res.json(); }).then(function(json) {
          if (Array.isArray(json) && json.length) {
            var mapped = json.map(function(h) {
              return {
                name: h.name,
                address: h.address,
                lat: h.location && h.location.lat,
                lng: h.location && h.location.lng,
                availableBeds: h.availableBeds,
                specialists: h.specialists || [],
                phone: h.phone || ''
              };
            });
            state.hospitals = mapped;
            renderHospitalMarkers(mapped);
          }
        }).catch(function() {});
      } catch (e) {}
    })();

      // Specialty filtering state
      var activeSpecialties = {};

      function renderSpecialtyLegend(specialties) {
        try {
          var existing = document.getElementById('specialty-legend');
          if (existing) existing.parentNode.removeChild(existing);

          var container = document.createElement('div');
          container.id = 'specialty-legend';
          container.className = 'specialty-legend';

          specialties.forEach(function(s) {
            var item = document.createElement('div');
            item.className = 'legend-item';
            item.dataset.specialty = s;
            item.title = s;

            var iconHtml = '';
            switch (s) {
              case 'cardiac': iconHtml = '<svg class="legend-icon" viewBox="0 0 24 24" fill="#ef4444" xmlns="http://www.w3.org/2000/svg"><path d="M12 21s-7-4.35-9-7.09C-1 9.42 3.33 4 8.5 6.5 12 8 12 12 12 12s0-4 3.5-5.5C20.67 4 25 9.42 21 13.91 19 16.65 12 21 12 21z"/></svg>'; break;
              case 'neuro': iconHtml = '<svg class="legend-icon" viewBox="0 0 24 24" fill="#8b5cf6" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a5 5 0 0 0-5 5v1H5a3 3 0 0 0-3 3v3a6 6 0 0 0 6 6h6a6 6 0 0 0 6-6v-3a3 3 0 0 0-3-3h-2V7a5 5 0 0 0-5-5z"/></svg>'; break;
              case 'trauma': iconHtml = '<svg class="legend-icon" viewBox="0 0 24 24" fill="#06b6d4" xmlns="http://www.w3.org/2000/svg"><path d="M21 11h-8V3H11v8H3v2h8v8h2v-8h8z"/></svg>'; break;
              case 'ortho': iconHtml = '<svg class="legend-icon" viewBox="0 0 24 24" fill="#f59e0b" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a2 2 0 0 0-2 2v3H7v2h3v6H8v2h3v3a2 2 0 0 0 4 0v-3h3v-2h-3v-6h3V9h-3V4a2 2 0 0 0-2-2z"/></svg>'; break;
              case 'oncology': iconHtml = '<svg class="legend-icon" viewBox="0 0 24 24" fill="#ec4899" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a5 5 0 0 1 5 5c0 3-5 6-5 6s-5-3-5-6a5 5 0 0 1 5-5zM4 20v-2a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v2H4z"/></svg>'; break;
              default: iconHtml = '<svg class="legend-icon" viewBox="0 0 24 24" fill="#10b981" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L8 6v6H2v8h20v-8h-6V6z"/></svg>';
            }

            item.innerHTML = iconHtml + '<span style="margin-left:4px">' + s.charAt(0).toUpperCase() + s.slice(1) + '</span>';

            // default: active
            activeSpecialties[s] = true;

            item.addEventListener('click', function() {
              var sp = this.dataset.specialty;
              activeSpecialties[sp] = !activeSpecialties[sp];
              this.classList.toggle('legend-item--inactive', !activeSpecialties[sp]);
              filterHospitalMarkers();
            });

            container.appendChild(item);
          });

          document.body.appendChild(container);
        } catch (e) {}
      }

      function filterHospitalMarkers() {
        try {
          hospitalMarkers.forEach(function(marker) {
            var sp = marker._specialty || 'general';
            if (activeSpecialties[sp]) {
              if (!hospitalClusterGroup.hasLayer(marker)) hospitalClusterGroup.addLayer(marker);
            } else {
              if (hospitalClusterGroup.hasLayer(marker)) hospitalClusterGroup.removeLayer(marker);
            }
          });
        } catch (e) {}
      }

    // ── Route initialisation ─────────────────────────────────────────────────
    var routingControl = null;

    function ensureRoutingControl() {
      if (routingControl) {
        return routingControl;
      }

      routingControl = L.Routing.control({
        waypoints: [state.currentPosition, state.destination],
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        showAlternatives: false,
        createMarker: function() { return null; },
        lineOptions: { styles: [], addWaypoints: false },
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', timeout: 12000 })
      }).addTo(map);

      routingControl.on('routesfound', function(event) {
        var route = event.routes && event.routes[0];
        if (!route) return;

        var coords = [];
        try {
          coords = (route.coordinates || []).map(function(c) {
            if (c && typeof c.lat === 'number') return L.latLng(c.lat, c.lng);
            if (Array.isArray(c) && c.length >= 2) return L.latLng(c[0], c[1]);
            return null;
          }).filter(Boolean);
        } catch (e) {}

        if (coords.length > 1) {
          state.routeCoordinates = coords;
          renderStaticRoute(false);

          try {
            var cacheKey = 'route:' + state.currentPosition.lat.toFixed(4) + ',' + state.currentPosition.lng.toFixed(4) + '|' + state.destination.lat.toFixed(4) + ',' + state.destination.lng.toFixed(4);
            sessionStorage.setItem(cacheKey, JSON.stringify(coords.map(function(p) { return [p.lat, p.lng]; })));
          } catch (e) {}
        } else {
          try {
            var dist = (route.summary && route.summary.totalDistance) || 0;
            var time = (route.summary && route.summary.totalTime) || 0;
            if (dist) distanceEl.textContent = formatDistance(dist);
            if (time) etaEl.textContent = state.etaLabel || formatDuration(time);
          } catch (e) {}
          renderInstructions(route.instructions || []);
        }
      });

      routingControl.on('routingerror', function() {
        var fallback = [];
        var segs = 20;
        var fa = state.currentPosition, fb = state.destination;
        for (var fi = 0; fi <= segs; fi++) {
          fallback.push(L.latLng(fa.lat + (fb.lat - fa.lat) * fi / segs, fa.lng + (fb.lng - fa.lng) * fi / segs));
        }
        state.routeCoordinates = fallback;
        renderStaticRoute(true);
        renderInstructions([{ text: 'Approximate route (OSRM unavailable)', distance: getRemainingRouteDistanceMeters(fallback, state.currentPosition) }]);
      });

      return routingControl;
    }

    // 1. Use backend-supplied route coordinates immediately (no OSRM needed)
    if (state.routeCoordinates.length > 1) {
      renderStaticRoute(true);
    } else {
      // 2. Fall back to sessionStorage cache
      var didUseCached = false;
      try {
        var cacheKeyInit = 'route:' + state.currentPosition.lat.toFixed(4) + ',' + state.currentPosition.lng.toFixed(4) + '|' + state.destination.lat.toFixed(4) + ',' + state.destination.lng.toFixed(4);
        var cachedInit = sessionStorage.getItem(cacheKeyInit);
        if (cachedInit) {
          var parsedInit = JSON.parse(cachedInit);
          if (Array.isArray(parsedInit) && parsedInit.length > 1) {
            state.routeCoordinates = parsedInit.map(function(p) { return L.latLng(p[0], p[1]); });
            renderStaticRoute(true);
            didUseCached = true;
          }
        }
      } catch (e) {}

      // 3. Last resort: OSRM routing control
      if (!didUseCached) {
        ensureRoutingControl();
      }
    }

    function animateTo(nextLat, nextLng) {
      var from = vehicleMarker.getLatLng();
      var target = L.latLng(nextLat, nextLng);
      var startedAt = performance.now();
      var duration = 900;

      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }

      setHeading(from, target);

      function step(now) {
        var progress = Math.min(1, (now - startedAt) / duration);
        var lat = from.lat + (target.lat - from.lat) * progress;
        var lng = from.lng + (target.lng - from.lng) * progress;
        var point = L.latLng(lat, lng);

        vehicleMarker.setLatLng(point);
        map.panTo(point, { animate: true, duration: 0.4, noMoveStart: true });

        if (progress < 1) {
          animFrame = requestAnimationFrame(step);
        } else {
          animFrame = null;
        }
      }

      animFrame = requestAnimationFrame(step);
    }

    function updateMap(payload, shouldAnimate) {
      var destinationChanged = false;

      if (typeof payload.startLat === 'number' && typeof payload.startLng === 'number') {
        var nextPosition = L.latLng(payload.startLat, payload.startLng);
        if (shouldAnimate) {
          animateTo(payload.startLat, payload.startLng);
        } else {
          vehicleMarker.setLatLng(nextPosition);
          map.setView(nextPosition, map.getZoom());
        }
        state.currentPosition = nextPosition;
      }

      if (typeof payload.destinationLat === 'number' && typeof payload.destinationLng === 'number') {
        destinationChanged =
          Math.abs(state.destination.lat - payload.destinationLat) > 0.00001 ||
          Math.abs(state.destination.lng - payload.destinationLng) > 0.00001;
        state.destination = L.latLng(payload.destinationLat, payload.destinationLng);
      }

      if (payload.destinationLabel) {
        state.destinationLabel = payload.destinationLabel;
      }

      if (payload.title) {
        state.title = payload.title;
      }

      if (payload.phaseLabel) {
        state.phaseLabel = payload.phaseLabel;
      }

      if (payload.panelSubtitle !== undefined) {
        state.panelSubtitle = payload.panelSubtitle;
      }

      if (payload.etaLabel !== undefined) {
        state.etaLabel = payload.etaLabel;
      }

      if (Array.isArray(payload.hospitals)) {
        state.hospitals = payload.hospitals;
        renderHospitalMarkers(state.hospitals);
      }

      targetMarker.setLatLng(state.destination);
      targetMarker.setIcon(L.divIcon({
        className: '',
        iconSize: [110, 42],
        iconAnchor: [9, 9],
        html: destinationIconHtml(state.destinationLabel)
      }));

      setHeaderContent();

      if (destinationChanged) {
        clearStaticRoute();
        state.routeCoordinates = [];
      }

      // Update route display
      if (Array.isArray(payload.routeCoordinates) && payload.routeCoordinates.length > 1) {
        // Fresh route coordinates from backend — just render them, no OSRM
        state.routeCoordinates = payload.routeCoordinates.map(function(p) {
          if (Array.isArray(p)) return L.latLng(p[0], p[1]);
          if (p && typeof p.lat === 'number') return L.latLng(p.lat, p.lng);
          return null;
        }).filter(Boolean);
        renderStaticRoute(false);
      } else if (state.routeCoordinates.length > 1 && !destinationChanged) {
        renderStaticRoute(false);
      } else {
        ensureRoutingControl();
        if (routingControl && typeof routingControl.setWaypoints === 'function') {
          routingControl.setWaypoints([state.currentPosition, state.destination]);
        }
      }

      if (state.etaLabel) {
        etaEl.textContent = state.etaLabel;
      }
    }

    function onMessage(event) {
      try {
        var payload = JSON.parse(event.data);
        if (payload.type === 'INIT') {
          updateMap(payload, false);
          return;
        }

        if (payload.type === 'UPDATE') {
          updateMap(payload, true);
        }
      } catch (error) {}
    }

    setHeaderContent();
    window.addEventListener('message', onMessage);
    document.addEventListener('message', onMessage);
    window.addEventListener('beforeunload', stopSignalWave);
  </script>
</body>
</html>`;
}

module.exports = { buildNavigationMapHtml };