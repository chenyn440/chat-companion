'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, User, Copy, Check, MessageSquare, Calendar, Star, Smile } from 'lucide-react';
import { CHARACTERS } from '@/lib/config/characters';

// 手机号脱敏
function maskPhone(phone: string) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

interface UserStats {
  totalSessions: number;
  totalMessages: number;
  usageDays: number;
  favoriteCharacter: string;
  favoriteCharacterKey: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser, isLoggedIn, checkAuth } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);

  // 昵称编辑
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  // 复制 ID
  const [copied, setCopied] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  useEffect(() => {
    checkAuth().then(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { router.replace('/login'); return; }
    if (user?.id) fetchStats();
  }, [authLoading, isLoggedIn, user?.id]);

  useEffect(() => {
    if (user?.nickname && !editing) setNickname(user.nickname);
  }, [user?.nickname]);

  const fetchStats = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/user/stats?userId=${user.id}`);
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch { /* ignore */ }
  };

  const handleSaveNickname = async () => {
    if (!user?.id || !nickname.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (data.success && user) {
        setUser({ ...user, nickname: data.data.nickname });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefaultCharacter = async (charId: string) => {
    if (!user?.id) return;
    const prevCharId = user.preferences?.defaultCharacter;
    const prevMode = user.preferences?.defaultMode || 'companion';
    // 乐观更新
    setUser({ ...user, preferences: { defaultCharacter: charId, defaultMode: prevMode } });
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, preferences: { defaultCharacter: charId, defaultMode: prevMode } }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('已设置');
      } else {
        setUser({ ...user, preferences: { defaultCharacter: prevCharId || 'gentle', defaultMode: prevMode } });
        showToast('设置失败，请重试');
      }
    } catch {
      setUser({ ...user, preferences: { defaultCharacter: prevCharId || 'gentle', defaultMode: prevMode } });
      showToast('设置失败，请重试');
    }
  };

  const handleCopyPhone = () => {
    if (!user?.phone) return;
    navigator.clipboard.writeText(user.phone).then(() => {
      setCopied(true);
      showToast('已复制');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentCharId = user?.preferences?.defaultCharacter || 'gentle';

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white text-sm px-5 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}

      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={22} />
          </button>
          <h1 className="ml-2 text-[17px] font-semibold text-gray-900">个人中心</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── 用户信息卡 ── */}
        <div className="bg-white rounded-2xl px-5 py-5 shadow-sm">
          <div className="flex items-center gap-4">
            {/* 头像 */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-sm">
              {user?.nickname?.[0] || <User size={28} />}
            </div>

            {/* 信息 */}
            <div className="flex-1 min-w-0">
              {/* 昵称 */}
              {editing ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveNickname()}
                    className="flex-1 text-[15px] font-semibold border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500 min-w-0"
                    autoFocus
                  />
                  <button onClick={handleSaveNickname} disabled={saving}
                    className="text-xs text-white bg-blue-500 hover:bg-blue-600 px-2.5 py-1 rounded-lg disabled:opacity-50 flex-shrink-0">
                    {saving ? '保存中' : '保存'}
                  </button>
                  <button onClick={() => { setEditing(false); setNickname(user?.nickname || ''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1 flex-shrink-0">
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[16px] font-semibold text-gray-900 truncate">
                    {user?.nickname || '未设置昵称'}
                  </span>
                  <button onClick={() => setEditing(true)}
                    className="text-xs text-blue-500 hover:text-blue-600 flex-shrink-0">
                    修改
                  </button>
                </div>
              )}

              {/* 手机号（脱敏 + 可复制） */}
              <button
                onClick={handleCopyPhone}
                className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span>{maskPhone(user?.phone || '')}</span>
                {copied
                  ? <Check size={12} className="text-green-500" />
                  : <Copy size={12} className="text-gray-300" />
                }
              </button>
            </div>
          </div>
        </div>

        {/* ── 使用统计 ── */}
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm">
          <h3 className="text-[13px] font-medium text-gray-500 mb-3">使用统计</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<MessageSquare size={18} className="text-blue-500" />}
              bg="bg-blue-50"
              value={stats?.totalSessions ?? 0}
              label="对话次数"
            />
            <StatCard
              icon={<MessageSquare size={18} className="text-green-500" />}
              bg="bg-green-50"
              value={stats?.totalMessages ?? 0}
              label="消息条数"
            />
            <StatCard
              icon={<Calendar size={18} className="text-purple-500" />}
              bg="bg-purple-50"
              value={stats?.usageDays ?? 0}
              label="使用天数"
            />
            <StatCard
              icon={<Star size={18} className="text-orange-400" />}
              bg="bg-orange-50"
              value={stats?.favoriteCharacter ?? '-'}
              label="最爱角色"
              isText
            />
          </div>
        </div>

        {/* ── 偏好设置 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <h3 className="text-[13px] font-medium text-gray-500">偏好设置</h3>
          </div>
          <a href="/sessions" className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <MessageSquare size={15} className="text-blue-500" />
              </div>
              <span className="text-[14px] text-gray-800">对话历史</span>
            </div>
            <ChevronRight size={15} className="text-gray-300" />
          </a>
          <div className="border-t border-gray-50" />
          <a href="/mood" className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Smile size={15} className="text-yellow-500" />
              </div>
              <span className="text-[14px] text-gray-800">心情日记</span>
            </div>
            <ChevronRight size={15} className="text-gray-300" />
          </a>
        </div>

        {/* ── 默认角色 ── */}
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm">
          <h3 className="text-[13px] font-medium text-gray-500 mb-3">默认角色</h3>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {CHARACTERS.map(char => {
              const isActive = currentCharId === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => handleSetDefaultCharacter(char.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{char.avatar}</span>
                  <span>{char.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pb-6" />
      </div>
    </div>
  );
}

// 统计卡片
function StatCard({
  icon, bg, value, label, isText,
}: {
  icon: React.ReactNode;
  bg: string;
  value: number | string;
  label: string;
  isText?: boolean;
}) {
  return (
    <div className={`${bg} rounded-xl p-3.5 flex flex-col gap-1.5`}>
      {icon}
      <p className={`font-bold text-gray-800 ${isText ? 'text-[15px]' : 'text-[22px]'} leading-tight`}>
        {value}
      </p>
      <p className="text-[12px] text-gray-400">{label}</p>
    </div>
  );
}
