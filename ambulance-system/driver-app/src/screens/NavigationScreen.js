import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Alert, SafeAreaView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getSocket } from '../services/api';

const { height } = Dimensions.get('window');

const C = {
  bg: '#0D0D0D', card: '#1C1C1E', card2: '#2C2C2E',
  white: '#FFFFFF', gray: '#8E8E93', border: '#3A3A3C',
  blue: '#007AFF', red: '#FF3B30', green: '#34C759', orange: '#FF9500',
};

const makeMapHTML = (dLat, dLng, tLat, tLng, route, tEmoji) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0;}html,body,#map{width:100%;height:100%;background:#0D0D0D;}</style>
</head>
<body><div id="map"></div>
<script>
var map=L.map('map',{zoomControl:true,attributionControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
var dIcon=L.divIcon({html:'<div style="font-size:28px">🚑</div>',className:'',iconSize:[30,30],iconAnchor:[15,15]});
var tIcon=L.divIcon({html:'<div style="font-size:28px">${tEmoji}</div>',className:'',iconSize:[30,30],iconAnchor:[15,15]});
var dMarker=L.marker([${dLat},${dLng}],{icon:dIcon}).addTo(map);
L.marker([${tLat},${tLng}],{icon:tIcon}).addTo(map);
var route=${JSON.stringify(route || [])};
if(route.length>0)L.polyline(route,{color:'#007AFF',weight:5,opacity:0.9}).addTo(map);
map.fitBounds([[${dLat},${dLng}],[${tLat},${tLng}]],{padding:[60,60]});
function onMsg(e){try{var d=JSON.parse(e.data);if(d.type==='MOVE')dMarker.setLatLng([d.lat,d.lng]);}catch(err){}}
window.addEventListener('message',onMsg);
document.addEventListener('message',onMsg);
</script>
</body></html>`;

export default function NavigationScreen({ navigation, route }) {
  const { emergency } = route.params;
  const [phase, setPhase] = useState('to_victim');
  const [eta, setEta] = useState(emergency.eta || 8);
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    startSimulation();
    return () => clearInterval(intervalRef.current);
  }, [phase]);

  const startSimulation = () => {
    clearInterval(intervalRef.current);
    const socket = getSocket();
    const coords = phase === 'to_victim' ? emergency.route : emergency.routeToHospital;
    if (!coords || coords.length === 0) return;

    const getDistanceKm = (lat1, lon1, lat2, lon2) => {
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 6371; // km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const targetLoc = phase === 'to_victim' ? emergency.victimLocation : emergency.hospital?.location;

    let idx = 0;
      intervalRef.current = setInterval(() => {
      idx = Math.min(idx + 1, coords.length - 1);
      const [lat, lng] = coords[idx];
      socket.emit('driver-location', { lat, lng, emergencyId: emergency.emergencyId });
      // Send MOVE updates to the embedded map. Use WebView on native and iframe on web.
      if (Platform.OS === 'web') {
        try { iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'MOVE', lat, lng }), '*'); } catch (e) {}
      } else if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ type: 'MOVE', lat, lng }));
      }
      // Recompute ETA from remaining straight-line distance to target assuming avg speed 40 km/h
      if (targetLoc && typeof targetLoc.lat === 'number' && typeof targetLoc.lng === 'number') {
        const distKm = getDistanceKm(lat, lng, targetLoc.lat, targetLoc.lng);
        const etaMin = Math.max(1, Math.ceil((distKm / 40) * 60));
        setEta(etaMin);
      }
      if (idx >= coords.length - 1) clearInterval(intervalRef.current);
    }, 3000);
  };

  const handlePickedUp = () => {
    clearInterval(intervalRef.current);
    const socket = getSocket();
    socket.emit('patient-picked-up', { emergencyId: emergency.emergencyId });
    setPhase('to_hospital');
    setEta(emergency.eta || 10);
    Alert.alert('✅ Patient Picked Up', 'Now navigating to hospital');
  };

  const handleDelivered = () => {
    clearInterval(intervalRef.current);
    const socket = getSocket();
    socket.emit('patient-delivered', { emergencyId: emergency.emergencyId });
    Alert.alert(
      '🎉 Mission Complete!',
      'Patient has been delivered to the hospital.',
      [{ text: 'Done', onPress: () => navigation.replace('Home', {}) }]
    );
  };

  const isToVictim = phase === 'to_victim';
  const coords = isToVictim ? emergency.route : emergency.routeToHospital;
  const target = isToVictim ? emergency.victimLocation : emergency.hospital?.location;
  const tEmoji = isToVictim ? '📍' : '🏥';
  const startCoord = coords?.[0];

  return (
    <View style={styles.container}>

      {/* Map */}
      <View style={{ height: height * 0.54 }}>
        {startCoord && target ? (
          Platform.OS === 'web' ? (
            <iframe
              ref={iframeRef}
              title="map"
              srcDoc={makeMapHTML(startCoord[0], startCoord[1], target.lat, target.lng, coords, tEmoji)}
              style={{ flex: 1, width: '100%', height: '100%', border: 0 }}
            />
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: makeMapHTML(startCoord[0], startCoord[1], target.lat, target.lng, coords, tEmoji) }}
              style={{ flex: 1 }}
              javaScriptEnabled
              scrollEnabled={false}
            />
          )
        ) : (
          <View style={[styles.mapPlaceholder]}>
            <Text style={{ color: C.gray, fontSize: 14 }}>Loading map...</Text>
          </View>
        )}
      </View>

      {/* Bottom Panel */}
      <SafeAreaView style={styles.panel}>

        {/* Phase Badge */}
        <View style={[styles.phaseBadge, { backgroundColor: isToVictim ? '#FF3B3018' : '#007AFF18' }]}>
          <Text style={[styles.phaseText, { color: isToVictim ? C.red : C.blue }]}>
            {isToVictim ? '📍 Heading to Victim' : '🏥 Heading to Hospital'}
          </Text>
        </View>

        {/* ETA Row */}
        <View style={styles.etaRow}>
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text style={styles.etaValue}>{Math.ceil(eta)} min</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Emergency ID</Text>
            <Text style={[styles.etaValue, { color: C.blue, fontSize: 14 }]}>
              #{emergency.emergencyId?.slice(-6).toUpperCase()}
            </Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Type</Text>
            <Text style={styles.etaValue}>{emergency.emergencyType}</Text>
          </View>
        </View>

        {/* Destination */}
        <View style={styles.destCard}>
          <Text style={{ fontSize: 26 }}>{tEmoji}</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.destName}>
              {isToVictim ? 'Victim Location' : emergency.hospital?.name}
            </Text>
            <Text style={styles.destCoords}>
              {target ? `${target.lat?.toFixed(4)}, ${target.lng?.toFixed(4)}` : '—'}
            </Text>
          </View>
        </View>

        {/* Action Button */}
        {isToVictim ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.orange }]} onPress={handlePickedUp} activeOpacity={0.8}>
            <Text style={styles.actionText}>🙋 Patient Picked Up</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.green }]} onPress={handleDelivered} activeOpacity={0.8}>
            <Text style={styles.actionText}>✅ Patient Delivered</Text>
          </TouchableOpacity>
        )}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  mapPlaceholder: {
    flex: 1, backgroundColor: '#1C1C1E',
    alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    flex: 1, backgroundColor: C.card,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 16, marginTop: -18, gap: 10,
  },
  phaseBadge: {
    alignSelf: 'center', paddingHorizontal: 16,
    paddingVertical: 6, borderRadius: 20,
  },
  phaseText: { fontSize: 13, fontWeight: '700' },
  etaRow: {
    flexDirection: 'row', backgroundColor: C.card2,
    borderRadius: 14, padding: 14,
    alignItems: 'center', justifyContent: 'space-around',
  },
  etaItem: { alignItems: 'center' },
  etaLabel: { color: C.gray, fontSize: 11, marginBottom: 2 },
  etaValue: { color: C.white, fontSize: 18, fontWeight: '700' },
  etaDivider: { width: 1, height: 36, backgroundColor: C.border },
  destCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card2, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  destName: { color: C.white, fontSize: 14, fontWeight: '600' },
  destCoords: { color: C.gray, fontSize: 11, marginTop: 2 },
  actionBtn: {
    borderRadius: 16, padding: 18, alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
