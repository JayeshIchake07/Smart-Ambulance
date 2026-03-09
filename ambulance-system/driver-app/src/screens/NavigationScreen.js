import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getSocket } from '../services/api';

const { height } = Dimensions.get('window');

const C = {
  bg: '#08111D',
  card: '#0F1B2D',
  card2: '#15243A',
  white: '#FFFFFF',
  gray: '#9AA8B7',
  border: '#22344E',
  blue: '#0A84FF',
  red: '#FF5A5F',
  green: '#19B46B',
  orange: '#FF9F0A',
};

const initialRoutePoint = (emergency) => emergency?.route?.[0] || emergency?.routeToHospital?.[0] || null;

const makeMapHTML = ({ startLat, startLng, targetLat, targetLng, destinationLabel, phaseLabel }) => `<!DOCTYPE html>
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

  .status-pill {
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(17, 163, 106, 0.12);
    color: var(--accent-strong);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .panel-actions {
    display: flex;
    align-items: center;
    gap: 10px;
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

  .ambulance-marker {
    width: 56px;
    height: 56px;
  }

  .ambulance-rotator {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    background: linear-gradient(180deg, #ffffff 0%, #edf6f2 100%);
    border: 2px solid rgba(17, 163, 106, 0.28);
    box-shadow: 0 10px 20px rgba(12, 138, 88, 0.28);
    transform: rotate(var(--heading, 0deg));
    transition: transform 0.16s linear;
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
  <div id="nav-hint" class="nav-hint">Tap map to show navigation</div>

  <aside id="nav-panel" class="nav-panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Live Navigation</p>
        <h1>Driver Route</h1>
      </div>
      <div class="panel-actions">
        <span class="status-pill">${phaseLabel}</span>
        <button id="panel-close" class="panel-close" type="button" aria-label="Hide navigation">×</button>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">Distance</span>
        <strong id="distance">Calculating...</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">ETA</span>
        <strong id="eta">Calculating...</strong>
      </div>
    </div>

    <p class="subtext">Following the best route to ${destinationLabel.toLowerCase()} with live ambulance tracking.</p>

    <div class="instructions-block">
      <h2>Turn-by-turn</h2>
      <ol id="instructions" class="instructions-list">
        <li>Fetching the best route...</li>
      </ol>
    </div>
  </aside>

<script>
  var start = L.latLng(${startLat}, ${startLng});
  var destination = L.latLng(${targetLat}, ${targetLng});
  var map = L.map('map', { zoomControl: true, preferCanvas: true }).setView(start, 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  var ambulanceIcon = L.divIcon({
    className: 'ambulance-marker',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    html: '<div id="ambulance-rotator" class="ambulance-rotator"><svg viewBox="0 0 64 64" aria-hidden="true" style="width:32px;height:32px;"><rect x="8" y="24" width="30" height="18" rx="6" fill="#12b76a"></rect><path d="M38 28h10l8 9v5H38z" fill="#0c8a58"></path><rect x="14" y="28" width="8" height="8" fill="#ffffff"></rect><rect x="17" y="25" width="2" height="14" fill="#ffffff"></rect><rect x="11" y="31" width="14" height="2" fill="#ffffff"></rect><circle cx="20" cy="45" r="5" fill="#132238"></circle><circle cx="47" cy="45" r="5" fill="#132238"></circle><rect x="42" y="30" width="8" height="5" rx="2" fill="#b7f7d8"></rect></svg></div>'
  });

  var destinationIcon = L.divIcon({
    className: '',
    iconSize: [100, 42],
    iconAnchor: [9, 9],
    html: '<div class="destination-pin"></div><div class="destination-badge">${destinationLabel}</div>'
  });

  var ambulanceMarker = L.marker(start, { icon: ambulanceIcon, zIndexOffset: 1000 }).addTo(map);
  L.marker(destination, { icon: destinationIcon }).addTo(map);

  var distanceEl = document.getElementById('distance');
  var etaEl = document.getElementById('eta');
  var instructionsEl = document.getElementById('instructions');
  var navPanel = document.getElementById('nav-panel');
  var navHint = document.getElementById('nav-hint');
  var panelClose = document.getElementById('panel-close');
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

  function calculateBearing(from, to) {
    var lat1 = toRadians(from.lat);
    var lat2 = toRadians(to.lat);
    var deltaLng = toRadians(to.lng - from.lng);
    var y = Math.sin(deltaLng) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  function setHeading(from, to) {
    var marker = document.getElementById('ambulance-rotator');
    if (!marker) {
      return;
    }
    marker.style.setProperty('--heading', calculateBearing(from, to) + 'deg');
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

  var routingControl = L.Routing.control({
    waypoints: [start, destination],
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    showAlternatives: false,
    createMarker: function() { return null; },
    lineOptions: {
      styles: [
        { color: '#34d399', opacity: 0.18, weight: 16 },
        { color: '#10b981', opacity: 0.96, weight: 8 },
        { color: '#ffffff', opacity: 0.82, weight: 2 }
      ],
      extendToWaypoints: true,
      missingRouteTolerance: 0,
    },
    router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' })
  }).addTo(map);

  routingControl.on('routesfound', function(event) {
    var route = event.routes[0];
    if (!route) {
      return;
    }
    distanceEl.textContent = formatDistance(route.summary.totalDistance);
    etaEl.textContent = formatDuration(route.summary.totalTime);
    renderInstructions(route.instructions || []);
  });

  routingControl.on('routingerror', function() {
    distanceEl.textContent = 'Route unavailable';
    etaEl.textContent = 'Unavailable';
    instructionsEl.innerHTML = '<li>Routing service is currently unavailable.</li>';
  });

  function animateTo(lat, lng) {
    var from = ambulanceMarker.getLatLng();
    var target = L.latLng(lat, lng);
    var startedAt = performance.now();
    var duration = 900;

    if (animFrame) {
      cancelAnimationFrame(animFrame);
    }

    setHeading(from, target);

    function step(now) {
      var progress = Math.min(1, (now - startedAt) / duration);
      var nextLat = from.lat + (target.lat - from.lat) * progress;
      var nextLng = from.lng + (target.lng - from.lng) * progress;
      var point = L.latLng(nextLat, nextLng);

      ambulanceMarker.setLatLng(point);
      map.panTo(point, { animate: true, duration: 0.4, noMoveStart: true });

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        animFrame = null;
      }
    }

    animFrame = requestAnimationFrame(step);
  }

  function handleMessage(event) {
    try {
      var payload = JSON.parse(event.data);
      if (payload.type === 'MOVE') {
        animateTo(payload.lat, payload.lng);
        if (typeof payload.eta === 'number') {
          etaEl.textContent = Math.max(1, Math.ceil(payload.eta)) + ' min';
        }
      }
    } catch (error) {}
  }

  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);
</script>
</body>
</html>`;

export default function NavigationScreen({ navigation, route }) {
  const { emergency } = route.params;
  const [phase, setPhase] = useState('to_victim');
  const [eta, setEta] = useState(emergency.eta || 8);
  const [currentPosition, setCurrentPosition] = useState(() => {
    const point = initialRoutePoint(emergency);
    return point ? { lat: point[0], lng: point[1] } : null;
  });
  const [mapHtml, setMapHtml] = useState('');
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const intervalRef = useRef(null);

  const isToVictim = phase === 'to_victim';
  const coords = isToVictim ? emergency.route : emergency.routeToHospital;
  const target = isToVictim ? emergency.victimLocation : emergency.hospital?.location;
  const destinationLabel = isToVictim ? 'Victim Location' : emergency.hospital?.name || 'Hospital';
  const phaseLabel = isToVictim ? 'Heading to Victim' : 'Heading to Hospital';

  useEffect(() => {
    if (!target) {
      setMapHtml('');
      return;
    }

    const routeStart = coords?.[0] || [currentPosition?.lat, currentPosition?.lng];
    const startLat = routeStart?.[0] ?? currentPosition?.lat;
    const startLng = routeStart?.[1] ?? currentPosition?.lng;

    if (typeof startLat !== 'number' || typeof startLng !== 'number') {
      setMapHtml('');
      return;
    }

    setCurrentPosition({ lat: startLat, lng: startLng });
    setMapHtml(
      makeMapHTML({
        startLat,
        startLng,
        targetLat: target.lat,
        targetLng: target.lng,
        destinationLabel,
        phaseLabel,
      })
    );
  }, [coords, destinationLabel, phaseLabel, target]);

  useEffect(() => {
    startSimulation();
    return () => clearInterval(intervalRef.current);
  }, [phase]);

  const postMapMessage = (payload) => {
    const message = JSON.stringify(payload);

    if (Platform.OS === 'web') {
      try {
        iframeRef.current?.contentWindow?.postMessage(message, '*');
      } catch (error) {}
      return;
    }

    webViewRef.current?.postMessage(message);
  };

  const startSimulation = () => {
    clearInterval(intervalRef.current);
    const socket = getSocket();
    if (!coords || !coords.length || !target) {
      return;
    }

    const getDistanceKm = (lat1, lon1, lat2, lon2) => {
      const toRad = (value) => (value * Math.PI) / 180;
      const radiusKm = 6371;
      const deltaLat = toRad(lat2 - lat1);
      const deltaLng = toRad(lon2 - lon1);
      const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return radiusKm * c;
    };

    let pointIndex = 0;
    intervalRef.current = setInterval(() => {
      pointIndex = Math.min(pointIndex + 1, coords.length - 1);
      const [lat, lng] = coords[pointIndex];
      const remainingDistance = getDistanceKm(lat, lng, target.lat, target.lng);
      const nextEta = Math.max(1, Math.ceil((remainingDistance / 40) * 60));

      setCurrentPosition({ lat, lng });
      setEta(nextEta);
      socket.emit('driver-location', { lat, lng, emergencyId: emergency.emergencyId });
      postMapMessage({ type: 'MOVE', lat, lng, eta: nextEta });

      if (pointIndex >= coords.length - 1) {
        clearInterval(intervalRef.current);
      }
    }, 3000);
  };

  const handlePickedUp = () => {
    clearInterval(intervalRef.current);
    const socket = getSocket();
    socket.emit('patient-picked-up', { emergencyId: emergency.emergencyId });
    setPhase('to_hospital');
    setEta(emergency.eta || 10);
    Alert.alert('Patient Picked Up', 'Live navigation switched to the hospital route.');
  };

  const handleDelivered = () => {
    clearInterval(intervalRef.current);
    const socket = getSocket();
    socket.emit('patient-delivered', { emergencyId: emergency.emergencyId });
    Alert.alert(
      'Mission Complete',
      'Patient has been delivered to the hospital.',
      [{ text: 'Done', onPress: () => navigation.replace('Home', {}) }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapShell}>
        {mapHtml ? (
          Platform.OS === 'web' ? (
            <iframe
              ref={iframeRef}
              title="driver-live-navigation"
              srcDoc={mapHtml}
              style={styles.webFrame}
            />
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.webView}
              javaScriptEnabled
              scrollEnabled={false}
            />
          )
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.placeholderText}>Loading live navigation...</Text>
          </View>
        )}
      </View>

      <SafeAreaView style={styles.panel}>
        <View style={[styles.phaseBadge, { backgroundColor: isToVictim ? '#FF5A5F18' : '#0A84FF18' }]}>
          <Text style={[styles.phaseText, { color: isToVictim ? C.red : C.blue }]}>
            {phaseLabel}
          </Text>
        </View>

        <View style={styles.etaRow}>
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Live ETA</Text>
            <Text style={styles.etaValue}>{Math.ceil(eta)} min</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Emergency ID</Text>
            <Text style={[styles.etaValue, styles.metaValue]}>#{emergency.emergencyId?.slice(-6).toUpperCase()}</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Type</Text>
            <Text style={styles.etaValue}>{emergency.emergencyType}</Text>
          </View>
        </View>

        <View style={styles.destCard}>
          <Text style={styles.destinationEmoji}>{isToVictim ? '📍' : '🏥'}</Text>
          <View style={styles.destMeta}>
            <Text style={styles.destName}>{destinationLabel}</Text>
            <Text style={styles.destCoords}>
              {target ? `${target.lat?.toFixed(4)}, ${target.lng?.toFixed(4)}` : 'Waiting for destination'}
            </Text>
          </View>
        </View>

        {isToVictim ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.orange }]} onPress={handlePickedUp} activeOpacity={0.85}>
            <Text style={styles.actionText}>Patient Picked Up</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.green }]} onPress={handleDelivered} activeOpacity={0.85}>
            <Text style={styles.actionText}>Patient Delivered</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  mapShell: {
    height: height * 0.56,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#DDE7F0',
    borderWidth: 1,
    borderColor: '#1E314C',
  },
  webFrame: {
    width: '100%',
    height: '100%',
    border: 0,
    flex: 1,
  },
  webView: { flex: 1 },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#102038',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: C.gray, fontSize: 14 },
  panel: {
    flex: 1,
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    marginTop: -18,
    gap: 12,
  },
  phaseBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  phaseText: { fontSize: 13, fontWeight: '700' },
  etaRow: {
    flexDirection: 'row',
    backgroundColor: C.card2,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: C.border,
  },
  etaItem: { alignItems: 'center', flex: 1 },
  etaLabel: { color: C.gray, fontSize: 11, marginBottom: 4 },
  etaValue: { color: C.white, fontSize: 17, fontWeight: '700' },
  metaValue: { color: '#6DB2FF', fontSize: 14 },
  etaDivider: { width: 1, height: 40, backgroundColor: C.border },
  destCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card2,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  destinationEmoji: { fontSize: 28 },
  destMeta: { flex: 1, marginLeft: 12 },
  destName: { color: C.white, fontSize: 15, fontWeight: '700' },
  destCoords: { color: C.gray, fontSize: 11, marginTop: 4 },
  actionBtn: {
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
