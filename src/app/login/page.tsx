'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const { isLoggedIn, login } = useAuthStore();
  const router = useRouter();
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsHydrated(true); }, []);

  useEffect(() => {
    if (isHydrated && isLoggedIn) router.push('/chat-v2');
  }, [isHydrated, isLoggedIn, router]);

  const validatePhone = (v: string) => {
    if (!v) { setPhoneError('请输入手机号'); return false; }
    if (!/^1\d{10}$/.test(v)) { setPhoneError('请输入有效的手机号'); return false; }
    setPhoneError(''); return true;
  };

  const sendCode = async () => {
    if (!validatePhone(phone) || countdown > 0) return;
    setIsSending(true);
    setNetworkError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
        }, 1000);
        // 发送成功后聚焦验证码输入框
        setTimeout(() => codeInputRef.current?.focus(), 100);
      } else {
        setNetworkError('发送失败，请重试');
      }
    } catch {
      setNetworkError('网络异常，请重试');
    } finally {
      setIsSending(false);
    }
  };

  const handleLogin = async () => {
    let valid = true;
    if (!phone) { setPhoneError('请输入手机号'); valid = false; }
    if (!code) { setCodeError('请输入验证码'); valid = false; }
    if (!valid) return;

    setIsLoading(true);
    setNetworkError('');
    setCodeError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('userId', data.data.user.id);
        login(data.data.user);
        setTimeout(() => router.push('/chat-v2'), 100);
      } else {
        setCodeError(data.error || '账号或验证码错误');
      }
    } catch {
      setNetworkError('网络异常，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* 卡片：移动端全宽，PC 端居中固定宽 */}
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl px-6 py-8 sm:px-8">

        {/* Logo / 标题 */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">AI</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">欢迎回来</h1>
          <p className="text-gray-500 text-sm mt-1">登录后开始你的陪伴之旅</p>
        </div>

        <div className="space-y-4">
          {/* 手机号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => { setPhone(e.target.value); if (phoneError) setPhoneError(''); }}
              onBlur={() => phone && validatePhone(phone)}
              placeholder="请输入手机号"
              className={`w-full px-4 rounded-xl border outline-none transition text-base
                h-[48px] sm:h-[44px]
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${phoneError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
            />
            {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
          </div>

          {/* 验证码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">验证码</label>
            <div className="flex gap-2">
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                value={code}
                onChange={e => { setCode(e.target.value); if (codeError) setCodeError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="请输入验证码"
                className={`flex-1 px-4 rounded-xl border outline-none transition text-base
                  h-[48px] sm:h-[44px]
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${codeError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
              />
              <button
                onClick={sendCode}
                disabled={isSending || countdown > 0 || !phone}
                className="px-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200
                  disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap
                  text-sm font-medium h-[48px] sm:h-[44px] flex-shrink-0 min-w-[88px]"
              >
                {isSending
                  ? <span className="flex items-center gap-1 justify-center"><Loader2 size={13} className="animate-spin" />发送中</span>
                  : countdown > 0 ? `${countdown}s 后重发` : '获取验证码'
                }
              </button>
            </div>
            {codeError && <p className="text-red-500 text-xs mt-1">{codeError}</p>}
          </div>

          {/* 网络错误 */}
          {networkError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {networkError}
            </div>
          )}

          {/* 登录按钮 */}
          <button
            onClick={handleLogin}
            disabled={isLoading || !phone || !code}
            className="w-full bg-blue-600 text-white rounded-xl hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold
              h-[52px] sm:h-[48px] text-base flex items-center justify-center gap-2 mt-2"
          >
            {isLoading
              ? <><Loader2 size={18} className="animate-spin" />登录中…</>
              : '登录'
            }
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          登录即表示同意用户协议和隐私政策
        </p>
      </div>
    </div>
  );
}
