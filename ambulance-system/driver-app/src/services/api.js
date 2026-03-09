import axios from 'axios';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ Change to your PC's IP address
export const BASE_URL = 'http://192.168.29.145:5000';

const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('driverToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

export default api;

let socket = null;

export const getSocket = () => {
  if (!socket || !socket.connected) {
    socket = io(BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });
  }
  return socket;
};
