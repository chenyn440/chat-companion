'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import {
  ChevronLeft, ChevronRight, User, Copy, Check,
  Shield, MessageSquare, Heart, BookOpen,
  HelpCircle, MessageCircle, LogOut, Info,
  FileText, Settings,
} from 'lucide-react';

// 手机号脱敏
function maskPhone(phone: string) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

export default function ProfilePage() {
  const { user, setUser, isLoggedIn, checkAuth, logout } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // 编辑昵称
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  // 退出确认弹窗
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    checkAuth().then(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (user?.nickname) setNickname(user.nickname);
  }, [user?.nickname]);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) window.location.href = '/login';
  }, [authLoading, isLoggedIn]);

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout(true);
    window.location.href = '/login';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center px-4 h-14">
          <a href="/chat-v2" className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={22} />
          </a>
          <h1 className="ml-2 text-[17px] font-semibold text-gray-900">个人中心</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── 顶部信息区 ── */}
        <div className="bg-white rounded-2xl px-5 py-5 shadow-sm">
          <div className="flex items-center gap-4">
            {/* 头像 */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-sm">
              {user?.nickname?.[0] || <User size={28} />}
            </div>

            {/* 信息 */}
            <div className="flex-1 min-w-0">
              {/* 昵称行 */}
              {editing ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveNickname()}
                    className="flex-1 text-[15px] font-semibold border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <button onClick={handleSaveNickname} disabled={saving}
                    className="text-xs text-white bg-blue-500 hover:bg-blue-600 px-2.5 py-1 rounded-lg disabled:opacity-50">
                    {saving ? '保存中' : '保存'}
                  </button>
                  <button onClick={() => { setEditing(false); setNickname(user?.nickname || ''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[16px] font-semibold text-gray-900 truncate">
                    {user?.nickname || '未设置昵称'}
                  </span>
                  <button onClick={() => setEditing(true)}
                    className="text-xs text-blue-500 hover:text-blue-600 flex-shrink-0">
                    修改
                  </button>
                </div>
              )}

              {/* 手机号（脱敏） */}
              <p className="text-[13px] text-gray-400 mb-1.5">{maskPhone(user?.phone || '')}</p>

              {/* 用户 ID */}
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-gray-400">ID: </span>
                <span className="text-[12px] text-gray-500 font-mono">{user?.id?.slice(-8)}</span>
                <button onClick={handleCopyId}
                  className="text-gray-400 hover:text-blue-500 transition-colors">
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 我的内容 ── */}
        <Section title="我的内容">
          <MenuItem icon={<MessageSquare size={16} className="text-blue-500" />} label="我的会话" href="/sessions" />
          <MenuItem icon={<Heart size={16} className="text-red-400" />} label="我的收藏" href="/sessions" badge="收藏" />
          <MenuItem icon={<BookOpen size={16} className="text-violet-500" />} label="心情日记" href="/mood" />
        </Section>

        {/* ── 安全与账号 ── */}
        <Section title="账号与安全">
          <MenuItem icon={<Shield size={16} className="text-green-500" />} label="登录方式" desc={maskPhone(user?.phone || '')} disabled />
        </Section>

        {/* ── 支持与反馈 ── */}
        <Section title="支持与反馈">
          <MenuItem icon={<HelpCircle size={16} className="text-amber-500" />} label="帮助中心" disabled tag="建设中" />
          <MenuItem icon={<MessageCircle size={16} className="text-blue-400" />} label="意见反馈" disabled tag="建设中" />
        </Section>

        {/* ── 关于 ── */}
        <Section title="关于">
          <MenuItem icon={<Info size={16} className="text-gray-400" />} label="关于我们" desc="Chat 助手 v1.0" disabled />
          <MenuItem icon={<FileText size={16} className="text-gray-400" />} label="隐私政策" disabled />
          <MenuItem icon={<FileText size={16} className="text-gray-400" />} label="用户协议" disabled />
        </Section>

        {/* ── 退出登录 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center justify-center w-full px-5 py-4 text-red-500 hover:bg-red-50 transition-colors gap-2 font-medium"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>

        <div className="pb-6" />
      </div>

      {/* 退出确认弹窗 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <LogOut size={22} className="text-red-500" />
              </div>
              <h3 className="text-[16px] font-semibold text-gray-900 mb-1">确认退出登录？</h3>
              <p className="text-[13px] text-gray-400">退出后将清除本地会话数据</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 text-[15px] text-gray-600 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <div className="w-px bg-gray-100" />
              <button
                onClick={handleLogout}
                className="flex-1 py-3.5 text-[15px] text-red-500 font-medium hover:bg-red-50 transition-colors"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 子组件 ───

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-gray-400 px-1 mb-1.5 font-medium">{title}</p>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  icon, label, desc, href, disabled, tag, badge,
}: {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  href?: string;
  disabled?: boolean;
  tag?: string;
  badge?: string;
}) {
  const content = (
    <div className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${disabled ? 'opacity-60' : 'hover:bg-gray-50 cursor-pointer'}`}>
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[14px] text-gray-800">{label}</span>
        {desc && <p className="text-[12px] text-gray-400 mt-0.5">{desc}</p>}
      </div>
      {tag && (
        <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{tag}</span>
      )}
      {badge && (
        <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{badge}</span>
      )}
      {!disabled && <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />}
    </div>
  );

  if (href && !disabled) {
    return <a href={href}>{content}</a>;
  }
  return <div>{content}</div>;
}
