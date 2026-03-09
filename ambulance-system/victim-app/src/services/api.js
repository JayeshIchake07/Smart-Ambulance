import axios from 'axios';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ⚠️ IMPORTANT: Change this to your PC's IPv4 address when testing on phone
// Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to get your IP
// For Android emulator: use 10.0.2.2
// For web browser: use localhost
export const BASE_URL = Platform.OS === 'web' ? 'http://localhost:5000' : 'http://192.168.29.145:5000';

// ── Axios instance ─────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// Attach token to every request
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

export default api;

// ── Socket singleton ───────────────────────────────────────────────────────
let socket = null;

export const getSocket = () => {
  if (!socket || !socket.connected) {
    socket = io(BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
