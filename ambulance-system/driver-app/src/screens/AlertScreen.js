import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Animated, Vibration,
} from 'react-native';
import { getSocket } from '../services/api';

const C = {
  bg: '#0D0D0D', card: '#1C1C1E',
  white: '#FFFFFF', gray: '#8E8E93', border: '#3A3A3C',
  blue: '#007AFF', red: '#FF3B30', green: '#34C759', orange: '#FF9500',
};

const TYPE_EMOJI = {
  Cardiac: '❤️', Stroke: '🧠', Accident: '🚗',
  Breathing: '🫁', Injury: '🩹', Unknown: '🆘',
};
const TYPE_COLOR = {
  Cardiac: '#FF3B30', Stroke: '#FF6B35', Accident: '#FF9500',
  Breathing: '#5E5CE6', Injury: '#FF9500', Unknown: '#8E8E93',
};

export default function AlertScreen({ navigation, route }) {
  const { emergency } = route.params;
  const [countdown, setCountdown] = useState(30);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Vibration.vibrate([400, 400, 400, 400, 400], true);

    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); handleReject(); return 0; }
        return prev - 1;
      });
    }, 1000);

    return () => { clearInterval(timer); Vibration.cancel(); };
  }, []);

  const handleAccept = () => {
    Vibration.cancel();
    const socket = getSocket();
    socket.emit('driver-accepted', { emergencyId: emergency.emergencyId });
    navigation.replace('Navigation', { emergency });
  };

  const handleReject = () => {
    Vibration.cancel();
    navigation.goBack();
  };

  const typeColor = TYPE_COLOR[emergency.emergencyType] || C.red;
  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#0D0D0D', '#180808'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Top Bar */}
        <View style={[styles.topBar, { borderBottomColor: typeColor }]}>
          <Text style={styles.alertTitle}>🚨 EMERGENCY ALERT</Text>
          <View style={[styles.countBadge, { backgroundColor: countdown <= 10 ? C.red : C.orange }]}>
            <Text style={styles.countText}>{countdown}s</Text>
          </View>
        </View>

        <View style={styles.body}>

          {/* Emergency Type */}
          <View style={[styles.typeCard, { borderColor: typeColor }]}>
            <Text style={styles.typeEmoji}>
              {TYPE_EMOJI[emergency.emergencyType] || '🆘'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeTitle}>{emergency.emergencyType} Emergency</Text>
              <Text style={styles.typeSub}>Immediate response required</Text>
            </View>
            <View style={[styles.p1Badge, { backgroundColor: typeColor + '25' }]}>
              <Text style={[styles.p1Text, { color: typeColor }]}>P1</Text>
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Row emoji="📍" label="Victim Location"
              value={`${emergency.victimLocation?.lat?.toFixed(4)}, ${emergency.victimLocation?.lng?.toFixed(4)}`} />
            <Divider />
            <Row emoji="📏" label="Distance" value={`${emergency.distance?.toFixed(1) || '?'} km`} />
            <Divider />
            <Row emoji="⏱️" label="ETA to Victim" value={`${emergency.eta || '?'} minutes`} />
          </View>

          {/* Hospital */}
          {emergency.hospital && (
            <View style={styles.hospCard}>
              <Text style={styles.hospLabel}>🏥 ASSIGNED HOSPITAL</Text>
              <Text style={styles.hospName}>{emergency.hospital.name}</Text>
              <Text style={styles.hospAddr}>{emergency.hospital.address}</Text>
            </View>
          )}

        </View>

        {/* Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} activeOpacity={0.8}>
            <Text style={styles.rejectText}>✕  Reject</Text>
          </TouchableOpacity>

          <Animated.View style={[{ flex: 1 }, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
              <Text style={styles.acceptText}>✓  Accept</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

      </SafeAreaView>
    </Animated.View>
  );
}

function Row({ emoji, label, value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <Text style={{ fontSize: 20, width: 28 }}>{emoji}</Text>
      <View>
        <Text style={{ color: '#8E8E93', fontSize: 11 }}>{label}</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#3A3A3C', marginVertical: 2 }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 2,
  },
  alertTitle: { color: C.red, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  countBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  countText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  body: { flex: 1, padding: 20, gap: 12 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 16, padding: 16, gap: 14, borderWidth: 2,
  },
  typeEmoji: { fontSize: 38 },
  typeTitle: { color: C.white, fontSize: 18, fontWeight: '700' },
  typeSub: { color: C.gray, fontSize: 12, marginTop: 2 },
  p1Badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  p1Text: { fontSize: 13, fontWeight: '800' },
  infoCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  hospCard: {
    backgroundColor: '#007AFF12', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#007AFF30',
  },
  hospLabel: { color: C.gray, fontSize: 10, fontWeight: '700', marginBottom: 4, letterSpacing: 1 },
  hospName: { color: C.white, fontSize: 15, fontWeight: '700' },
  hospAddr: { color: C.gray, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 32 },
  rejectBtn: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 18,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  rejectText: { color: C.gray, fontSize: 16, fontWeight: '700' },
  acceptBtn: {
    flex: 1, backgroundColor: C.green, borderRadius: 16, padding: 18,
    alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  acceptText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
