import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, ActivityIndicator, Alert,
  Dimensions, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import api from '../services/api';
import { colors, EMERGENCY_TYPES } from '../utils/constants';
import LeafletMap from '../components/LeafletMap';
import { Linking } from 'react-native';

const { height } = Dimensions.get('window');

export default function EmergencyScreen({ navigation, route }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapData, setMapData] = useState(null);
  const { location } = route.params || {};
  const [deviceLocation, setDeviceLocation] = useState(() => {
    if (location?.latitude && location?.longitude) {
      return { lat: location.latitude, lng: location.longitude };
    }

    return null;
  });
  const [nearestHospital, setNearestHospital] = useState(null);
  const [nearestDistanceKm, setNearestDistanceKm] = useState(null);
  const previewRoute = mapData?.route || [];

  const HOSPITAL_WEBSITE_DISTANCE_KM = 10; // enable website link only within this radius

  const getCurrentDeviceLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      throw new Error('Location permission is required to dispatch the nearest ambulance.');
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const nextLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    setDeviceLocation(nextLocation);
    return nextLocation;
  };

  useEffect(() => {
    getCurrentDeviceLocation().catch(() => {
      if (location?.latitude && location?.longitude) {
        setDeviceLocation({ lat: location.latitude, lng: location.longitude });
      }
    });
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    // compute nearest hospital from backend list using current device location
    const findNearest = async () => {
      try {
        const res = await api.get('/api/hospital');
        const hospitals = res.data || [];
        if (!deviceLocation || hospitals.length === 0) return;
        const { lat, lng } = deviceLocation;
        let best = null;
        let bestDist = Infinity;
        hospitals.forEach((h) => {
          if (!h.location) return;
          const d = haversineKm(lat, lng, h.location.lat, h.location.lng);
          if (d < bestDist) {
            bestDist = d;
            best = h;
          }
        });
        if (best) {
          setNearestHospital(best);
          setNearestDistanceKm(bestDist);
        }
      } catch (err) {
        // ignore for now
      }
    };
    findNearest();
  }, [deviceLocation]);

  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const openHospitalWebsite = async (url) => {
    if (!url) return Alert.alert('No website', 'This hospital does not provide a website.');
    if (!nearestDistanceKm || nearestDistanceKm > HOSPITAL_WEBSITE_DISTANCE_KM) {
      return Alert.alert('Unavailable', 'Hospital website is available only if you are near their area.');
    }
    const ok = await Linking.canOpenURL(url);
    if (ok) return Linking.openURL(url);
    return Alert.alert('Cannot open', 'Unable to open the hospital website.');
  };

  const loginDemoVictim = async () => {
    const loginRes = await api.post('/api/auth/login', {
      email: 'victim@test.com',
      password: '123456',
    });

    const nextToken = loginRes.data.token;
    const nextUserId = loginRes.data.user._id;

    await AsyncStorage.multiSet([
      ['token', nextToken],
      ['userId', nextUserId],
    ]);

    return {
      token: nextToken,
      userId: nextUserId,
    };
  };

  const ensureVictimSession = async () => {
    const token = await AsyncStorage.getItem('token');
    const userId = await AsyncStorage.getItem('userId');

    if (!token) {
      return loginDemoVictim();
    }

    try {
      await api.get('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return { token, userId };
    } catch (err) {
      if (err.response?.status !== 401) {
        throw err;
      }

      await AsyncStorage.multiRemove(['token', 'userId']);
      return loginDemoVictim();
    }
  };

  const handleSendHelp = async () => {
    if (!selected) {
      Alert.alert('Select Emergency Type', 'Please select what type of help you need.');
      return;
    }

    setLoading(true);
    try {
      const { token, userId } = await ensureVictimSession();

      const currentLocation = await getCurrentDeviceLocation();
      const lat = currentLocation.lat;
      const lng = currentLocation.lng;

      const res = await api.post('/api/dispatch', {
        lat,
        lng,
        emergencyType: selected.id,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = res.data;

      // Show map with victim location, hospital, and route
      setMapData({
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
      setShowMap(true);
      setLoading(false);
    } catch (err) {
      Alert.alert('Dispatch Failed', err.response?.data?.message || err.message);
      setLoading(false);
    }
  };

  const handleContinueToTracking = () => {
    navigation.replace('Tracking', mapData);
  };

  // Map overlay view
  if (showMap && mapData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>🚑 Help is on the way!</Text>
          <Text style={styles.mapSubtitle}>
            Nearest hospital: {mapData.hospital?.name || 'Finding...'}
          </Text>
        </View>

        <View style={styles.mapContainer}>
          <LeafletMap
            victimLocation={mapData.victimLocation}
            ambulanceLocation={{
              lat: mapData.ambulance?.location?.lat,
              lng: mapData.ambulance?.location?.lng,
            }}
            hospitalLocation={{
              lat: mapData.hospital?.location?.lat,
              lng: mapData.hospital?.location?.lng,
            }}
            hospital={mapData.hospital}
            route={previewRoute}
            status="driver_accepted"
            eta={mapData.eta}
            style={{ flex: 1 }}
          />
        </View>

        <View style={styles.mapInfoCard}>
          <View style={styles.mapInfoRow}>
            <View style={styles.mapInfoItem}>
              <Text style={styles.mapInfoLabel}>📍 Your Location</Text>
              <Text style={styles.mapInfoValue}>
                {mapData.victimLocation.lat.toFixed(4)}, {mapData.victimLocation.lng.toFixed(4)}
              </Text>
            </View>
            <View style={styles.mapInfoItem}>
              <Text style={styles.mapInfoLabel}>⏱️ ETA</Text>
              <Text style={styles.mapInfoValue}>{mapData.eta || '~8'} min</Text>
            </View>
          </View>
          <View style={styles.mapInfoRow}>
            <View style={styles.mapInfoItem}>
              <Text style={styles.mapInfoLabel}>🏥 Hospital</Text>
              <Text style={styles.mapInfoValue} numberOfLines={1}>
                {mapData.hospital?.name || 'Assigning...'}
              </Text>
              <Text style={styles.mapInfoMeta}>
                {typeof mapData.hospital?.distance === 'number'
                  ? `${mapData.hospital.distance.toFixed(2)} km away`
                  : 'Distance unavailable'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinueToTracking}>
          <Text style={styles.continueText}>Track Ambulance Live →</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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

        {/* Nearest hospital quick info (before dispatch) */}
        {nearestHospital && (
          <View style={styles.nearestCard}>
            <Text style={styles.nearestLabel}>Nearest Hospital</Text>
            <Text style={styles.nearestName}>{nearestHospital.name} · {nearestDistanceKm ? `${nearestDistanceKm.toFixed(1)} km` : ''}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.siteBtn, nearestDistanceKm && nearestDistanceKm <= HOSPITAL_WEBSITE_DISTANCE_KM ? {} : { opacity: 0.5 }]}
                onPress={() => openHospitalWebsite(nearestHospital.website)}
                disabled={!nearestDistanceKm || nearestDistanceKm > HOSPITAL_WEBSITE_DISTANCE_KM}
              >
                <Text style={styles.siteBtnText}>Visit Hospital Site</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => {
                  if (nearestHospital.phone) Linking.openURL(`tel:${nearestHospital.phone}`);
                  else Alert.alert('No phone', 'Phone number not available');
                }}
              >
                <Text style={styles.siteBtnText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
          disabled={loading}
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

  nearestCard: {
    backgroundColor: colors.cardDark,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nearestLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  nearestName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  siteBtn: {
    backgroundColor: colors.info,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  siteBtnText: { color: '#fff', fontWeight: '700' },
  callBtn: {
    backgroundColor: colors.safe,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
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
  // Map overlay styles
  mapHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  mapTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  mapSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    margin: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  mapInfoCard: {
    backgroundColor: colors.cardDark,
    marginHorizontal: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mapInfoItem: {
    flex: 1,
  },
  mapInfoLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  mapInfoValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  mapInfoMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  continueBtn: {
    backgroundColor: colors.safe,
    margin: 12,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.safe,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  continueText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
