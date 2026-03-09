import React, { useRef, useEffect, useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const generateLeafletHTML = ({ victimLat, victimLng, ambulanceLat, ambulanceLng, hospitalLat, hospitalLng, route }) => {
  const routeCoords = route ? JSON.stringify(route) : '[]';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0D0D0D; }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }
    .victim-pulse {
      width: 20px; height: 20px;
      background: rgba(255,59,48,0.3);
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }
    .victim-dot {
      width: 14px; height: 14px;
      background: #FF3B30;
      border-radius: 50%;
      border: 2px solid white;
      position: absolute;
      top: 3px; left: 3px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    // Victim marker with pulse animation
    var victimIcon = L.divIcon({
      html: '<div style="position:relative;width:20px;height:20px;"><div class="victim-pulse"></div><div class="victim-dot"></div></div>',
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    var ambulanceIcon = L.divIcon({
      html: '<div style="font-size:28px;line-height:1;">🚑</div>',
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    var hospitalIcon = L.divIcon({
      html: '<div style="font-size:28px;line-height:1;">🏥</div>',
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    var victimLat = ${victimLat};
    var victimLng = ${victimLng};
    var ambulanceLat = ${ambulanceLat || victimLat};
    var ambulanceLng = ${ambulanceLng || victimLng};
    var hospitalLat = ${hospitalLat || victimLat};
    var hospitalLng = ${hospitalLng || victimLng};
    var route = ${routeCoords};

    var victimMarker = L.marker([victimLat, victimLng], { icon: victimIcon }).addTo(map);
    var ambulanceMarker = L.marker([ambulanceLat, ambulanceLng], { icon: ambulanceIcon }).addTo(map);
    var hospitalMarker = L.marker([hospitalLat, hospitalLng], { icon: hospitalIcon }).addTo(map);

    // Draw route polyline
    if (route && route.length > 0) {
      L.polyline(route, {
        color: '#FF3B30',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.8
      }).addTo(map);
    }

    // Fit bounds to show all markers
    var bounds = L.latLngBounds([
      [victimLat, victimLng],
      [ambulanceLat, ambulanceLng],
      [hospitalLat, hospitalLng]
    ]);
    map.fitBounds(bounds, { padding: [60, 60] });

    // Handle messages from React Native to move ambulance marker
    function handleMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'UPDATE_AMBULANCE') {
          ambulanceMarker.setLatLng([data.lat, data.lng]);
          // Smooth pan to keep ambulance visible
          if (!map.getBounds().contains([data.lat, data.lng])) {
            map.panTo([data.lat, data.lng]);
          }
        }
      } catch(e) {}
    }

    // Handle both Android and iOS message events
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>`;
};

const LeafletMap = ({ victimLocation, ambulanceLocation, hospitalLocation, route, style }) => {
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);

  // Memoize HTML so parent re-renders don't recreate the iframe/srcDoc and reset its state
  const html = useMemo(() => generateLeafletHTML({
    victimLat: victimLocation?.lat || 19.076,
    victimLng: victimLocation?.lng || 72.8777,
    // embed initial ambulance/hospital positions if available — but do NOT include ambulanceLocation in deps
    ambulanceLat: ambulanceLocation?.lat,
    ambulanceLng: ambulanceLocation?.lng,
    hospitalLat: hospitalLocation?.lat,
    hospitalLng: hospitalLocation?.lng,
    route: route || [],
  }), [victimLocation, hospitalLocation, route]);

  // Update ambulance position without reloading iframe/WebView
  useEffect(() => {
    if (!ambulanceLocation) return;

    const message = JSON.stringify({
      type: 'UPDATE_AMBULANCE',
      lat: ambulanceLocation.lat,
      lng: ambulanceLocation.lng,
    });

    if (Platform.OS === 'web') {
      try {
        iframeRef.current?.contentWindow?.postMessage(message, '*');
      } catch (e) {}
    } else if (webViewRef.current) {
      webViewRef.current.postMessage(message);
    }
  }, [ambulanceLocation]);

  // Web platform: use iframe (keep srcDoc stable via memoized html)
  if (Platform.OS === 'web') {
    return (
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none', ...style }}
        title="map"
      />
    );
  }

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      source={{ html }}
      style={[{ flex: 1 }, style]}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState={false}
    />
  );
};

export default LeafletMap;
