'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const { isLoggedIn, login } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && isLoggedIn) {
      router.push('/chat');
    }
  }, [isHydrated, isLoggedIn, router]);

  const sendCode = async () => {
    if (!phone || countdown > 0) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (res.ok) {
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Send code error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleLogin = async () => {
    if (!phone || !code) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      const data = await res.json();
      if (data.success) {
        // 使用 login 方法设置用户状态（cookie 已由服务端设置）
        login(data.data.user);
        // 等待状态更新后跳转
        setTimeout(() => {
          router.push('/chat');
        }, 100);
      } else {
        alert(data.error || '登录失败');
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-800">欢迎回来</h1>
        <p className="text-gray-500 text-center mb-8">登录后开始你的陪伴之旅</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="请输入验证码"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
              <button
                onClick={sendCode}
                disabled={isSending || countdown > 0 || !phone}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
              >
                {countdown > 0 ? `${countdown}s` : isSending ? '发送中...' : '获取验证码'}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading || !phone || !code}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          登录即表示同意用户协议和隐私政策
        </p>
      </div>
    </div>
  );
}
