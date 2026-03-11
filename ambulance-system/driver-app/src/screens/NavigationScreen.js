import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { buildNavigationMapHtml } from 'rapidaid-navigation-template';
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
const getEmergencyId = (emergency) => emergency?.emergencyId || emergency?._id || '';
const getLocationPoint = (location) => {
  if (!location) {
    return null;
  }

  const lat = typeof location.lat === 'number' ? location.lat : Number(location.lat);
  const lng = typeof location.lng === 'number' ? location.lng : Number(location.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
};

export default function NavigationScreen({ navigation, route }) {
  const { emergency } = route.params;
  const emergencyId = getEmergencyId(emergency);
  const [phase, setPhase] = useState('to_victim');
  const [eta, setEta] = useState(emergency.eta || 8);
  const [currentPosition, setCurrentPosition] = useState(() => {
    const point = initialRoutePoint(emergency);
    return point ? { lat: point[0], lng: point[1] } : null;
  });
  const [mapHtml, setMapHtml] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const locationWatcherRef = useRef(null);
  const simulationIntervalRef = useRef(null);
  const hasInitializedRef = useRef(false);

  const isToVictim = phase === 'to_victim';
  const coords = isToVictim ? emergency.route : emergency.routeToHospital;
  const target = getLocationPoint(isToVictim ? emergency.victimLocation : emergency.hospital?.location);
  const destinationLabel = isToVictim ? 'Victim Location' : emergency.hospital?.name || 'Hospital';
  const phaseLabel = isToVictim ? 'Heading to Victim' : 'Heading to Hospital';
  const panelSubtitle = `Following the best route to ${destinationLabel.toLowerCase()} with live ambulance tracking.`;
  const routeCoordinates = useMemo(
    () => (Array.isArray(coords)
      ? coords
          .map((point) => {
            if (!Array.isArray(point) || point.length < 2) {
              return null;
            }

            const lat = Number(point[0]);
            const lng = Number(point[1]);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null;
            }

            return [lat, lng];
          })
          .filter(Boolean)
      : []),
    [coords]
  );
  const selectedHospitalMarkers = useMemo(() => {
    const hospitalPoint = getLocationPoint(emergency.hospital?.location);
    if (!hospitalPoint) {
      return [];
    }

    return [{
      _id: emergency.hospital?._id,
      name: emergency.hospital?.name || 'Assigned Hospital',
      address: emergency.hospital?.address || '',
      location: hospitalPoint,
      availableBeds: emergency.hospital?.availableBeds,
      specialists: emergency.hospital?.specialists || ['general'],
      phone: emergency.hospital?.phone,
    }];
  }, [emergency.hospital]);

  const mapConfig = useMemo(() => {
    const fallbackPoint = initialRoutePoint(emergency);
    const startLat = currentPosition?.lat ?? fallbackPoint?.[0];
    const startLng = currentPosition?.lng ?? fallbackPoint?.[1];

    if (!target || typeof startLat !== 'number' || typeof startLng !== 'number') {
      return null;
    }

    return {
      startLat,
      startLng,
      destinationLat: target.lat,
      destinationLng: target.lng,
      title: 'Driver Route',
      phaseLabel,
      destinationLabel,
      panelSubtitle,
      markerVariant: 'arrow',
      hintText: 'Tap map to show navigation',
      routeCoordinates,
      hospitals: selectedHospitalMarkers,
    };
  }, [currentPosition, destinationLabel, emergency, panelSubtitle, phaseLabel, routeCoordinates, selectedHospitalMarkers, target]);

  useEffect(() => {
    if (!mapConfig) {
      return;
    }

    setMapHtml(buildNavigationMapHtml(mapConfig));
    setMapReady(false);
    hasInitializedRef.current = false;
  }, [phase, mapConfig]);

  useEffect(() => {
    startTracking();

    return () => {
      stopTracking();
    };
  }, [phase]);

  useEffect(() => {
    if (!mapReady || !mapConfig) {
      return;
    }

    postMapMessage({
      type: hasInitializedRef.current ? 'UPDATE' : 'INIT',
      startLat: mapConfig.startLat,
      startLng: mapConfig.startLng,
      destinationLat: mapConfig.destinationLat,
      destinationLng: mapConfig.destinationLng,
      title: 'Driver Route',
      phaseLabel,
      destinationLabel,
      panelSubtitle,
      etaLabel: `${Math.ceil(eta)} min`,
      routeCoordinates,
      hospitals: selectedHospitalMarkers,
    });

    hasInitializedRef.current = true;
  }, [destinationLabel, eta, mapConfig, mapReady, panelSubtitle, phaseLabel, routeCoordinates, selectedHospitalMarkers]);

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

  const stopTracking = () => {
    clearInterval(simulationIntervalRef.current);
    simulationIntervalRef.current = null;

    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
    }
  };

  const calculateEta = (lat, lng) => {
    if (!target) {
      return eta;
    }

    const toRad = (value) => (value * Math.PI) / 180;
    const radiusKm = 6371;
    const deltaLat = toRad(target.lat - lat);
    const deltaLng = toRad(target.lng - lng);
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRad(lat)) * Math.cos(toRad(target.lat)) *
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = radiusKm * c;

    return Math.max(1, Math.ceil((distanceKm / 40) * 60));
  };

  const publishLocation = (lat, lng) => {
    const nextEta = calculateEta(lat, lng);

    setCurrentPosition({ lat, lng });
    setEta(nextEta);
    if (emergencyId) {
      getSocket().emit('driver-location', { lat, lng, emergencyId });
    }

    if (mapReady) {
      postMapMessage({
        type: hasInitializedRef.current ? 'UPDATE' : 'INIT',
        startLat: lat,
        startLng: lng,
        destinationLat: target?.lat,
        destinationLng: target?.lng,
        title: 'Driver Route',
        phaseLabel,
        destinationLabel,
        panelSubtitle,
        etaLabel: `${nextEta} min`,
        routeCoordinates,
        hospitals: selectedHospitalMarkers,
      });
      hasInitializedRef.current = true;
    }
  };

  const startSimulationFallback = () => {
    clearInterval(simulationIntervalRef.current);

    if (!coords?.length) {
      return;
    }

    let pointIndex = 0;
    simulationIntervalRef.current = setInterval(() => {
      pointIndex = Math.min(pointIndex + 1, coords.length - 1);
      const [lat, lng] = coords[pointIndex];
      publishLocation(lat, lng);

      if (pointIndex >= coords.length - 1) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    }, 3000);
  };

  const startTracking = async () => {
    stopTracking();

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (!servicesEnabled || status !== 'granted') {
        startSimulationFallback();
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      publishLocation(current.coords.latitude, current.coords.longitude);

      locationWatcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 2500,
          distanceInterval: 5,
          mayShowUserSettingsDialog: true,
        },
        (position) => {
          publishLocation(position.coords.latitude, position.coords.longitude);
        }
      );
    } catch (error) {
      startSimulationFallback();
    }
  };

  const handlePickedUp = () => {
    const hospitalTarget = getLocationPoint(emergency.hospital?.location);
    if (!hospitalTarget) {
      Alert.alert('Hospital route unavailable', 'This emergency does not have a valid hospital destination yet.');
      return;
    }

    if (!emergencyId) {
      Alert.alert('Pickup update failed', 'The emergency identifier is missing, so the pickup status could not be sent.');
      return;
    }

    stopTracking();
    getSocket().emit('patient-picked-up', { emergencyId });
    setPhase('to_hospital');
    setEta(emergency.eta || 10);
    Alert.alert('Patient Picked Up', 'Live navigation switched to the hospital route.');
  };

  const handleDelivered = () => {
    stopTracking();
    if (emergencyId) {
      getSocket().emit('patient-delivered', { emergencyId });
    }
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
              onLoad={() => setMapReady(true)}
            />
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.webView}
              javaScriptEnabled
              scrollEnabled={false}
              onLoadEnd={() => setMapReady(true)}
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
            <Text style={[styles.etaValue, styles.metaValue]}>#{String(emergencyId || 'pending').slice(-6).toUpperCase()}</Text>
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