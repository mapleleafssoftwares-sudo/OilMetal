import { create } from 'zustand';

export type UserRol = 'admin' | 'consultor' | 'vendedor' | 'deposito' | 'calidad';
export const INTERNAL_ROLES: UserRol[] = ['admin', 'vendedor', 'deposito', 'calidad'];

interface User {
  id: string;
  email: string;
  rol: UserRol;
  nombre?: string;
  empresa_id?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
}));
