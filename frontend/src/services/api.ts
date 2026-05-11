import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only logout — ProtectedRoute will redirect to /login via React Router
      // Never use window.location.href (causes full reload which breaks on Render)
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
