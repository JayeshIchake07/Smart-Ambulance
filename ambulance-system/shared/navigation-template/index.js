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

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
    var state = {
      currentPosition: L.latLng(${Number(startLat)}, ${Number(startLng)}),
      destination: L.latLng(${Number(destinationLat)}, ${Number(destinationLng)}),
      destinationLabel: '${safeDestinationLabel}',
      title: '${safeTitle}',
      phaseLabel: '${safePhaseLabel}',
      panelSubtitle: '${safePanelSubtitle}',
      etaLabel: '',
      routeCoordinates: (${routeCoordinatesLiteral} || []).map(function(p) { return L.latLng(p[0], p[1]); }),
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

    function renderStaticRoute(shouldFitBounds) {
      if (!state.routeCoordinates || !state.routeCoordinates.length) return false;

      if (!routeLine) {
        routeLine = L.polyline(state.routeCoordinates, {
          color: '#10b981', weight: 8, opacity: 0.96,
          lineCap: 'round', lineJoin: 'round',
        }).addTo(map);
      } else {
        routeLine.setLatLngs(state.routeCoordinates);
      }

      if (shouldFitBounds) {
        map.fitBounds(routeLine.getBounds(), { padding: [36, 36], animate: false });
      }

      var remaining = getRemainingRouteDistanceMeters(state.routeCoordinates, state.currentPosition);
      distanceEl.textContent = formatDistance(remaining);
      etaEl.textContent = state.etaLabel || formatDuration((remaining / 1000 / 40) * 3600);
      renderInstructions([{ text: 'Continue toward ' + state.destinationLabel, distance: remaining }]);
      return true;
    }

    function clearStaticRoute() {
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
  </script>
</body>
</html>`;
}

module.exports = { buildNavigationMapHtml };