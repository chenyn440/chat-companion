import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  phone: string;
  nickname: string;
  avatar?: string;
  preferences?: {
    defaultCharacter: string;
    defaultMode: string;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoggedIn: false,
      
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      login: (user, token) => set({ user, token, isLoggedIn: true }),
      logout: () => set({ user: null, token: null, isLoggedIn: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
