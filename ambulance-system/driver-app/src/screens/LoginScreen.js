import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const C = {
  bg: '#0D0D0D', card: '#1C1C1E', card2: '#2C2C2E',
  white: '#FFFFFF', gray: '#8E8E93', border: '#3A3A3C',
  blue: '#007AFF', red: '#FF3B30', green: '#34C759',
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('driver1@test.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token, user } = res.data;
      if (user.role !== 'driver') {
        Alert.alert('Error', 'Not a driver account');
        return;
      }
      await AsyncStorage.setItem('driverToken', token);
      await AsyncStorage.setItem('driverId', user._id);
      await AsyncStorage.setItem('driverAmbulanceId', user.ambulanceId || '');
      await AsyncStorage.setItem('driverName', user.name);
      navigation.replace('Home', { user });
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🚑</Text>
        <Text style={styles.title}>RapidAid Driver</Text>
        <Text style={styles.subtitle}>Sign in to your driver account</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="driver@example.com"
            placeholderTextColor={C.gray}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={C.gray}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.loginBtnText}>Sign In →</Text>
            }
          </TouchableOpacity>

          <View style={styles.hint}>
            <Text style={styles.hintTitle}>Test Accounts (password: 123456)</Text>
            <Text style={styles.hintText}>driver1@test.com — MH-01-AM-001 ALS</Text>
            <Text style={styles.hintText}>driver2@test.com — MH-01-AM-002 ICU</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo: { fontSize: 60, marginBottom: 8 },
  title: { color: C.white, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: C.gray, fontSize: 14, marginBottom: 36 },
  form: { width: '100%' },
  label: { color: C.gray, fontSize: 12, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: C.card, borderRadius: 12, padding: 14,
    color: C.white, fontSize: 15, borderWidth: 1, borderColor: C.border,
  },
  loginBtn: {
    backgroundColor: C.blue, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: {
    marginTop: 24, padding: 14, backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  hintTitle: { color: C.gray, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  hintText: { color: C.gray, fontSize: 12, marginBottom: 2 },
});
