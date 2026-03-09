import axios from 'axios';
import { io } from 'socket.io-client';

// ⚠️ Change to your PC's IP when testing from other devices
export const BASE_URL = 'http://localhost:5000';

const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hospitalToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

let socket = null;

export const getSocket = () => {
  if (!socket || !socket.connected) {
    socket = io(BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
    });
  }
  return socket;
};
