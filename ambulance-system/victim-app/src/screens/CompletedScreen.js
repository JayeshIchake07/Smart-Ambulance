import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  Animated, TouchableOpacity,
} from 'react-native';
import { colors } from '../utils/constants';

export default function CompletedScreen({ navigation, route }) {
  const { emergencyType, ambulance, hospital, responseTime } = route.params || {};

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spring scale-in animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] });

  return (
    <SafeAreaView style={styles.container}>
      {/* Glow background effect */}
      <Animated.View style={[styles.glowBg, { opacity: glowOpacity }]} />

      <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
        {/* Success Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>✅</Text>
        </View>

        <Text style={styles.title}>Help Has Arrived!</Text>
        <Text style={styles.subtitle}>
          You have received emergency assistance. Stay safe and rest well.
        </Text>

        {/* Stat Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⚡</Text>
            <Text style={styles.statValue}>{responseTime || 8} min</Text>
            <Text style={styles.statLabel}>Response Time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🚑</Text>
            <Text style={styles.statValue}>{ambulance?.type || 'ALS'}</Text>
            <Text style={styles.statLabel}>Amb. Type</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🏥</Text>
            <Text style={styles.statValue} numberOfLines={1}>{hospital?.name?.split(' ')[0] || 'Hospital'}</Text>
            <Text style={styles.statLabel}>Treated At</Text>
          </View>
        </View>

        {/* Thank you card */}
        <View style={styles.thankCard}>
          <Text style={styles.thankEmoji}>🙏</Text>
          <Text style={styles.thankText}>
            Thank you for trusting <Text style={{ color: colors.safe, fontWeight: '700' }}>RapidAid</Text>.
            {'\n'}Our team is always here when you need us.
          </Text>
        </View>

        {/* Back to Home */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.replace('Home')}
        >
          <Text style={styles.homeBtnText}>← Back to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBg: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.safe,
    top: '20%',
    alignSelf: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#34C75920',
    borderWidth: 3,
    borderColor: colors.safe,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: colors.safe,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  iconText: { fontSize: 44 },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardDark,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statEmoji: { fontSize: 20, marginBottom: 4 },
  statValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2 },
  thankCard: {
    backgroundColor: colors.cardDark,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    marginBottom: 20,
  },
  thankEmoji: { fontSize: 28 },
  thankText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  homeBtn: {
    backgroundColor: colors.cardLight,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  homeBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
