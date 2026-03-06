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
  setUser: (user: User | null) => void;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  login: (user: User) => void;
  logout: (clearLocalData?: boolean) => Promise<void>;
  switchAccount: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoggedIn: false,

  setUser: (user) => set({ user }),
  setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),

  login: (user) => {
    localStorage.setItem('userId', user.id);
    // 初始化 chatStorage 分桶
    import('@/lib/storage/chatStorage').then(({ chatStorage }) => chatStorage.init(user.id));
    set({ user, isLoggedIn: true });
    // 广播给其他标签页
    localStorage.setItem('auth_event', JSON.stringify({ type: 'login', userId: user.id, ts: Date.now() }));
  },

  logout: async (clearLocalData = true) => {
    const userId = get().user?.id || localStorage.getItem('userId') || '';
    // 清理本地数据
    if (clearLocalData && userId) {
      const { chatStorage } = await import('@/lib/storage/chatStorage');
      chatStorage.clearUserData(userId);
    }
    // 清理 localStorage
    localStorage.removeItem('userId');
    set({ user: null, isLoggedIn: false });
    // 通知服务端清 cookie（失败也没关系，客户端已清）
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    // 广播给其他标签页
    localStorage.setItem('auth_event', JSON.stringify({ type: 'logout', ts: Date.now() }));
    window.location.href = '/login';
  },

  switchAccount: async () => {
    // 方案 A：退出当前账号 -> 跳转登录页（登录另一个账号）
    // 退出时保留本地数据（clearLocalData=false），下次登录同账号时还能看到历史
    const userId = get().user?.id || localStorage.getItem('userId') || '';
    localStorage.removeItem('userId');
    set({ user: null, isLoggedIn: false });
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    localStorage.setItem('auth_event', JSON.stringify({ type: 'logout', ts: Date.now() }));
    window.location.href = '/login';
  },

  checkAuth: async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) { set({ user: null, isLoggedIn: false }); return; }

      const res = await fetch('/api/auth/me', { headers: { 'x-user-id': userId } });
      const data = await res.json();
      if (data.success && data.data) {
        // 初始化 chatStorage 分桶
        const { chatStorage } = await import('@/lib/storage/chatStorage');
        chatStorage.init(data.data.id);
        set({ user: data.data, isLoggedIn: true });
      } else {
        set({ user: null, isLoggedIn: false });
      }
    } catch {
      set({ user: null, isLoggedIn: false });
    }
  },
}));
