import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { colors, EMERGENCY_TYPES } from '../utils/constants';

export default function EmergencyScreen({ navigation, route }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const { location } = route.params || {};

  const handleSendHelp = async () => {
    if (!selected) {
      Alert.alert('Select Emergency Type', 'Please select what type of help you need.');
      return;
    }

    setLoading(true);
    try {
      // Auto-login if no token
      let token = await AsyncStorage.getItem('token');
      let userId = await AsyncStorage.getItem('userId');

      if (!token) {
        const loginRes = await api.post('/api/auth/login', {
          email: 'victim@test.com',
          password: '123456',
        });
        token = loginRes.data.token;
        userId = loginRes.data.user._id;
        await AsyncStorage.setItem('token', token);
        await AsyncStorage.setItem('userId', userId);
      }

      // SOS dispatch
      const lat = location?.latitude || 19.076;
      const lng = location?.longitude || 72.8777;

      const res = await api.post('/api/dispatch', {
        lat,
        lng,
        emergencyType: selected.id,
      });

      const data = res.data;

      navigation.replace('Tracking', {
        emergencyId: data.emergencyId,
        ambulance: data.ambulance,
        hospital: data.hospital,
        route: data.route,
        routeToHospital: data.routeToHospital,
        eta: data.eta,
        emergencyType: selected.id,
        victimLocation: { lat, lng },
        userId,
      });
    } catch (err) {
      Alert.alert('Dispatch Failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>What happened?</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Emergency Type Grid */}
        <View style={styles.grid}>
          {EMERGENCY_TYPES.map((type) => {
            const isSelected = selected?.id === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  isSelected && { borderColor: type.color, backgroundColor: `${type.color}18` },
                ]}
                onPress={() => setSelected(type)}
                activeOpacity={0.8}
              >
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: type.color }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
                <Text style={styles.typeEmoji}>{type.emoji}</Text>
                <Text style={styles.typeLabel}>{type.label}</Text>
                <Text style={styles.typeDesc}>{type.description}</Text>
                <View style={[styles.priorityBadge, { backgroundColor: type.priority === 'P1' ? '#FF3B3020' : '#FF950020' }]}>
                  <Text style={[styles.priorityText, { color: type.priority === 'P1' ? colors.emergency : colors.warning }]}>
                    {type.priority}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected banner */}
        {selected && (
          <View style={[styles.selectedBanner, { borderColor: selected.color }]}>
            <Text style={styles.selectedBannerText}>
              {selected.emoji} {selected.label} selected
            </Text>
          </View>
        )}

        {/* Send Help Button */}
        <TouchableOpacity
          style={[styles.sendBtn, !selected && { opacity: 0.5 }]}
          onPress={handleSendHelp}
          disabled={loading || !selected}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.sendEmoji}>🚑</Text>
              <Text style={styles.sendText}>Send Help Now</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  backText: { color: colors.info, fontSize: 16 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  typeCard: {
    width: '47%',
    backgroundColor: colors.cardDark,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'flex-start',
    position: 'relative',
    minHeight: 130,
  },
  checkmark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  typeEmoji: { fontSize: 28, marginBottom: 6 },
  typeLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  typeDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: { fontSize: 11, fontWeight: '700' },
  selectedBanner: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  selectedBannerText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  sendBtn: {
    flexDirection: 'row',
    backgroundColor: colors.emergency,
    marginTop: 16,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.emergency,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  sendEmoji: { fontSize: 22 },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});
