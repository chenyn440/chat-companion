import { create } from 'zustand';

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
  isLoggedIn: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  login: (user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  
  setUser: (user) => set({ user }),
  setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
  login: (user) => set({ user, isLoggedIn: true }),
  logout: () => set({ user: null, isLoggedIn: false }),
  checkAuth: async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success) {
        set({ isLoggedIn: true });
      } else {
        set({ isLoggedIn: false });
      }
    } catch (error) {
      set({ isLoggedIn: false });
    }
  },
}));
