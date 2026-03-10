import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  Animated, TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import api, { getSocket } from '../services/api';

const C = {
  bg: '#0D0D0D', card: '#1C1C1E', card2: '#2C2C2E',
  white: '#FFFFFF', gray: '#8E8E93', border: '#3A3A3C',
  blue: '#007AFF', red: '#FF3B30', green: '#34C759', orange: '#FF9500',
};

export default function HomeScreen({ navigation, route }) {
  const { user } = route.params || {};
  const [isOnline, setIsOnline] = useState(true);
  const [driverName, setDriverName] = useState(user?.name || 'Driver');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem('driverName').then((n) => { if (n) setDriverName(n); });
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isOnline]);

  useEffect(() => {
    const socket = getSocket();
    AsyncStorage.getItem('driverId').then((id) => {
      if (id) socket.emit('register', { userId: id, role: 'driver' });
    });
    const handleEmergency = (data) => {
      if (isOnline) navigation.navigate('Alert', { emergency: data });
    };
    socket.on('new-emergency', handleEmergency);
    return () => socket.off('new-emergency', handleEmergency);
  }, [isOnline]);

  // Publish location when online
  useEffect(() => {
    let watcher = null;

    const publishLocation = async (lat, lng) => {
      try {
        // update backend ambulance location (driver token expected)
        await api.put('/api/ambulance/location', { lat, lng });
      } catch (e) {
        // ignore network errors in UI
      }

      try {
        const socket = getSocket();
        socket.emit('driver-location', { lat, lng });
      } catch (e) {}
    };

    const startWatcher = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        publishLocation(pos.coords.latitude, pos.coords.longitude);

        watcher = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.Highest,
          timeInterval: 3000,
          distanceInterval: 5,
        }, (position) => {
          publishLocation(position.coords.latitude, position.coords.longitude);
        });
      } catch (err) {
        // fallback: nothing
      }
    };

    if (isOnline) startWatcher();

    return () => {
      if (watcher) watcher.remove();
      watcher = null;
    };
  }, [isOnline]);

  // Sync status when toggled
  useEffect(() => {
    const syncStatus = async () => {
      try {
        await api.put('/api/ambulance/status', { status: isOnline ? 'available' : 'offline' });
      } catch (e) {}
    };
    syncStatus();
  }, [isOnline]);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['driverToken', 'driverId', 'driverAmbulanceId', 'driverName']);
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>👋 Hello,</Text>
          <Text style={styles.name}>{driverName}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusLeft}>
          <Animated.View style={[
            styles.dot,
            {
              backgroundColor: isOnline ? C.green : C.gray,
              transform: isOnline ? [{ scale: pulseAnim }] : [{ scale: 1 }],
            }
          ]} />
          <View>
            <Text style={styles.statusTitle}>{isOnline ? 'Online' : 'Offline'}</Text>
            <Text style={styles.statusSub}>
              {isOnline ? 'Ready for emergencies' : 'Off duty'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setIsOnline(v => !v)}
          style={[styles.toggleBtn, { backgroundColor: isOnline ? C.green : C.border }]}
          activeOpacity={0.8}
        >
          <Text style={styles.toggleText}>{isOnline ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>

      {/* Ambulance Card */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>YOUR AMBULANCE</Text>
        <View style={styles.ambCard}>
          <Text style={{ fontSize: 36 }}>🚑</Text>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.ambVehicle}>MH-01-AM-001</Text>
            <Text style={styles.ambType}>ALS • Mumbai</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isOnline ? '#34C75920' : '#8E8E9320' }]}>
            <Text style={[styles.badgeText, { color: isOnline ? C.green : C.gray }]}>
              {isOnline ? 'Available' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TODAY'S STATS</Text>
        <View style={styles.statsRow}>
          {[
            { e: '🚗', v: '3', l: 'Trips' },
            { e: '🧑‍⚕️', v: '3', l: 'Patients' },
            { e: '⏱️', v: '7m', l: 'Avg ETA' },
          ].map((s) => (
            <View key={s.l} style={styles.statCard}>
              <Text style={{ fontSize: 22, marginBottom: 4 }}>{s.e}</Text>
              <Text style={styles.statVal}>{s.v}</Text>
              <Text style={styles.statLbl}>{s.l}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Waiting Banner */}
      {isOnline && (
        <View style={styles.waitCard}>
          <Text style={{ fontSize: 30, marginBottom: 8 }}>📡</Text>
          <Text style={styles.waitTitle}>Listening for emergencies...</Text>
          <Text style={styles.waitSub}>
            You will be alerted immediately when a nearby emergency is dispatched
          </Text>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  greeting: { color: C.gray, fontSize: 13 },
  name: { color: C.white, fontSize: 22, fontWeight: '800' },
  logoutBtn: {
    backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  logoutText: { color: C.gray, fontSize: 13 },
  statusCard: {
    flexDirection: 'row', backgroundColor: C.card, marginHorizontal: 20,
    marginVertical: 8, borderRadius: 16, padding: 18,
    alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: C.border,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  statusTitle: { color: C.white, fontSize: 16, fontWeight: '700' },
  statusSub: { color: C.gray, fontSize: 12, marginTop: 2 },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 22 },
  toggleText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  section: { paddingHorizontal: 20, marginTop: 18 },
  sectionLabel: {
    color: C.gray, fontSize: 11, fontWeight: '700',
    marginBottom: 10, letterSpacing: 1,
  },
  ambCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  ambVehicle: { color: C.white, fontSize: 16, fontWeight: '700' },
  ambType: { color: C.gray, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  statVal: { color: C.white, fontSize: 18, fontWeight: '800' },
  statLbl: { color: C.gray, fontSize: 10, marginTop: 2 },
  waitCard: {
    margin: 20, backgroundColor: '#007AFF12', borderRadius: 16,
    padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#007AFF30',
  },
  waitTitle: { color: C.blue, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  waitSub: { color: C.gray, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
