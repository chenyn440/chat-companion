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
      // 从 localStorage 获取用户ID
      const userId = localStorage.getItem('userId');
      
      if (!userId) {
        set({ user: null, isLoggedIn: false });
        return;
      }
      
      const res = await fetch('/api/auth/me', {
        headers: {
          'x-user-id': userId,
        },
      });
      const data = await res.json();
      if (data.success && data.data) {
        set({ user: data.data, isLoggedIn: true });
      } else {
        set({ user: null, isLoggedIn: false });
      }
    } catch (error) {
      set({ user: null, isLoggedIn: false });
    }
  },
}));
