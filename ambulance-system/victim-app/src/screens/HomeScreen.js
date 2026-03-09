import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  Dimensions, SafeAreaView, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../utils/constants';
import api from '../services/api';

const { width } = Dimensions.get('window');
const SOS_SIZE = width * 0.52;

export default function HomeScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [locationText, setLocationText] = useState('Getting location...');
  const [loading, setLoading] = useState(false);

  // Animation refs
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  // Get GPS location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationText('Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
      setLocationText(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
    })();
  }, []);

  // Ripple pulse animations
  useEffect(() => {
    const createPulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 2.2, duration: 1500, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 0, useNativeDriver: true }),
        ])
      );

    const breatheAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.07, duration: 900, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );

    const p1 = createPulse(pulse1, 0);
    const p2 = createPulse(pulse2, 500);
    const p3 = createPulse(pulse3, 1000);

    p1.start(); p2.start(); p3.start(); breatheAnim.start();
    return () => { p1.stop(); p2.stop(); p3.stop(); breatheAnim.stop(); };
  }, []);

  const handleSOSPress = async () => {
    // Button press animation
    Animated.sequence([
      Animated.timing(pressAnim, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      Animated.timing(pressAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    navigation.navigate('Emergency', { location });
  };

  const PulseRing = ({ anim }) => (
    <Animated.View
      style={[styles.pulseRing, {
        transform: [{ scale: anim }],
        opacity: anim.interpolate({ inputRange: [1, 2.2], outputRange: [0.5, 0] }),
      }]}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>🚑 RapidAid</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* SOS Button Area */}
      <View style={styles.sosContainer}>
        <PulseRing anim={pulse1} />
        <PulseRing anim={pulse2} />
        <PulseRing anim={pulse3} />

        <Animated.View style={{ transform: [{ scale: breathe }, { scale: pressAnim }] }}>
          <TouchableOpacity
            style={styles.sosButton}
            onPress={handleSOSPress}
            activeOpacity={0.85}
          >
            <Text style={styles.sosEmoji}>🆘</Text>
            <Text style={styles.sosText}>SOS</Text>
            <Text style={styles.sosSub}>Press for Emergency</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Info Cards */}
      <View style={styles.infoCards}>
        <View style={styles.infoCard}>
          <Text style={styles.infoEmoji}>⚡</Text>
          <Text style={styles.infoValue}>~4 min</Text>
          <Text style={styles.infoLabel}>Response</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoEmoji}>🚑</Text>
          <Text style={styles.infoValue}>5</Text>
          <Text style={styles.infoLabel}>Active Amb.</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoEmoji}>🏥</Text>
          <Text style={styles.infoValue}>4</Text>
          <Text style={styles.infoLabel}>Hospitals</Text>
        </View>
      </View>

      {/* GPS Row */}
      <View style={styles.gpsRow}>
        <Text style={styles.gpsEmoji}>📍</Text>
        <Text style={styles.gpsText}>{locationText}</Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Your GPS location is automatically shared with emergency services
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  appName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,199,89,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.safe,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.safe,
    marginRight: 5,
  },
  liveText: {
    color: colors.safe,
    fontSize: 11,
    fontWeight: '700',
  },
  sosContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.emergency,
    backgroundColor: 'transparent',
  },
  sosButton: {
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
    backgroundColor: colors.emergency,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.emergency,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  sosEmoji: { fontSize: 36, marginBottom: 4 },
  sosText: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
  },
  sosSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 4,
  },
  infoCards: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.cardDark,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoEmoji: { fontSize: 20, marginBottom: 4 },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    width: '90%',
  },
  gpsEmoji: { fontSize: 16, marginRight: 8 },
  gpsText: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  footer: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 30,
    paddingBottom: 20,
    lineHeight: 16,
  },
});
