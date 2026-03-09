import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  Animated, TouchableOpacity, Dimensions,
} from 'react-native';
import LeafletMap from '../components/LeafletMap';
import { getSocket } from '../services/api';
import { colors } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.48;
const MAP_HEIGHT = height * 0.52;

const STATUS_CONFIG = {
  dispatched:        { text: 'Finding your ambulance...', color: colors.warning, emoji: '🔍' },
  driver_accepted:   { text: 'Ambulance is on the way!',  color: colors.info,    emoji: '🚑' },
  patient_picked_up: { text: 'Heading to hospital...',    color: colors.safe,    emoji: '🏥' },
  default:           { text: 'Connecting to services...', color: colors.textSecondary, emoji: '⏳' },
};

export default function TrackingScreen({ navigation, route }) {
  const {
    emergencyId, ambulance, hospital, route: initRoute,
    eta: initEta, emergencyType, victimLocation, userId,
  } = route.params;

  const [status, setStatus] = useState('dispatched');
  const [eta, setEta] = useState(initEta || 8);
  const [ambulanceLocation, setAmbulanceLocation] = useState({
    lat: ambulance?.location?.lat,
    lng: ambulance?.location?.lng,
  });
  const [currentRoute, setCurrentRoute] = useState(initRoute || []);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse dot animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    // Register with server
    AsyncStorage.getItem('userId').then((uid) => {
      if (uid) socket.emit('register', { userId: uid, role: 'victim' });
    });

    // Ambulance accepted — update status
    socket.on('ambulance-coming', (data) => {
      setStatus('driver_accepted');
      if (data.eta) setEta(data.eta);
    });

    // Live ambulance location updates
    socket.on('ambulance-location', (data) => {
      if (data.emergencyId === emergencyId) {
        setAmbulanceLocation({ lat: data.lat, lng: data.lng });
        if (data.eta !== undefined) setEta(data.eta);
      }
    });

    // Status updates
    socket.on('status-update', (data) => {
      if (data.emergencyId === emergencyId) {
        setStatus(data.status);
      }
    });

    // Help complete → CompletedScreen
    socket.on('help-complete', (data) => {
      if (data.emergencyId === emergencyId) {
        navigation.replace('Completed', {
          emergencyType,
          ambulance,
          hospital,
          responseTime: initEta,
        });
      }
    });

    return () => {
      socket.off('ambulance-coming');
      socket.off('ambulance-location');
      socket.off('status-update');
      socket.off('help-complete');
    };
  }, [emergencyId]);

  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG.default;

  return (
    <View style={styles.container}>
      {/* MAP — top 52% */}
      <View style={{ height: MAP_HEIGHT }}>
        <LeafletMap
          victimLocation={victimLocation}
          ambulanceLocation={ambulanceLocation}
          hospitalLocation={hospital?.location}
          route={currentRoute}
          status={status}
          eta={eta}
        />
      </View>

      {/* BOTTOM SHEET — bottom 48% */}
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        {/* Status Row */}
        <View style={styles.statusRow}>
          <Animated.View
            style={[
              styles.statusDot,
              { backgroundColor: statusConf.color, transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Text style={styles.statusText}>{statusConf.emoji} {statusConf.text}</Text>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        {/* ETA Card */}
        <View style={styles.etaCard}>
          <View>
            <Text style={styles.etaLabel}>Estimated Arrival</Text>
            <View style={styles.etaRow}>
              <Text style={styles.etaNumber}>{eta}</Text>
              <Text style={styles.etaUnit}> min</Text>
            </View>
          </View>
          <View style={styles.etaDivider} />
          <View>
            <Text style={styles.etaLabel}>Emergency ID</Text>
            <Text style={styles.etaId}>#{emergencyId?.slice(-6).toUpperCase()}</Text>
          </View>
        </View>

        {/* Ambulance Chips */}
        {ambulance && (
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>🚑 {ambulance.vehicle}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>🏷️ {ambulance.type}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>👤 {ambulance.driverName || 'Driver'}</Text>
            </View>
          </View>
        )}

        {/* Hospital Card */}
        {hospital && (
          <View style={styles.hospitalCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hospitalName}>🏥 {hospital.name}</Text>
              <Text style={styles.hospitalAddr}>{hospital.address}</Text>
              <View style={styles.pillRow}>
                <View style={styles.pill}><Text style={styles.pillText}>🛏 {hospital.availableBeds} beds</Text></View>
                <View style={styles.pill}><Text style={styles.pillText}>24/7 Emergency</Text></View>
                <View style={[styles.pill, { backgroundColor: '#34C75920' }]}>
                  <Text style={[styles.pillText, { color: colors.safe }]}>Best Match</Text>
                </View>
              </View>
            </View>
            {/* Score Circle */}
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>{Math.round(hospital.score || 85)}</Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  sheet: {
    flex: 1,
    backgroundColor: colors.cardDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    marginTop: -20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  liveBadge: {
    backgroundColor: '#FF3B3020',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.emergency,
  },
  liveBadgeText: { color: colors.emergency, fontSize: 10, fontWeight: '800' },
  etaCard: {
    flexDirection: 'row',
    backgroundColor: colors.cardLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  etaLabel: { color: colors.textSecondary, fontSize: 11, marginBottom: 2 },
  etaRow: { flexDirection: 'row', alignItems: 'baseline' },
  etaNumber: { color: colors.textPrimary, fontSize: 34, fontWeight: '800' },
  etaUnit: { color: colors.textSecondary, fontSize: 14 },
  etaDivider: { width: 1, height: 40, backgroundColor: colors.border, marginHorizontal: 20 },
  etaId: { color: colors.info, fontSize: 14, fontWeight: '700' },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  chip: {
    backgroundColor: colors.cardLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipLabel: { color: colors.textSecondary, fontSize: 11 },
  hospitalCard: {
    backgroundColor: colors.cardLight,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  hospitalName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  hospitalAddr: { color: colors.textSecondary, fontSize: 11, marginBottom: 8 },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    backgroundColor: colors.cardDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillText: { color: colors.textSecondary, fontSize: 10 },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#34C75920',
    borderWidth: 2,
    borderColor: colors.safe,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: { color: colors.safe, fontSize: 16, fontWeight: '800' },
  scoreLabel: { color: colors.safe, fontSize: 8 },
});
