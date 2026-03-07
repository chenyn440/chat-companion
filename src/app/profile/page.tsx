'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, User, Copy, Check,
  MessageSquare, Calendar, Star, Zap,
  ShieldCheck, HelpCircle, Clock, LogOut,
  Sparkles,
} from 'lucide-react';

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
  const { user, isLoggedIn, checkAuth, logout } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);

  // 复制 ID
  const [copied, setCopied] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  // 退出确认
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    checkAuth().then(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { router.replace('/login'); return; }
    if (user?.id) fetchStats();
  }, [authLoading, isLoggedIn, user?.id]);

  const fetchStats = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/user/stats?userId=${user.id}`);
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch { /* ignore */ }
  };

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id).then(() => {
      setCopied(true);
      showToast('已复制');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout(true);
    router.replace('/login');
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white text-sm px-5 py-2 rounded-full shadow-xl z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={22} />
          </button>
          <h1 className="ml-2 text-[17px] font-semibold text-gray-900">个人中心</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── 5.1 身份信息区 ── */}
        <div className="bg-white rounded-2xl px-5 py-5 shadow-sm">
          <div className="flex items-center gap-4">
            {/* 头像 */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-sm">
              {user?.nickname?.[0] || <User size={28} />}
            </div>
            {/* 信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[17px] font-semibold text-gray-900 truncate">
                  {user?.nickname || '未设置昵称'}
                </span>
              </div>
              {/* 登录方式（脱敏） */}
              <p className="text-[13px] text-gray-400 mb-2">{maskPhone(user?.phone || '')}</p>
              {/* 用户 ID 可复制 */}
              <button
                onClick={handleCopyId}
                className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-blue-500 transition-colors"
              >
                <span className="font-mono">ID: {user?.id?.slice(-10)}</span>
                {copied
                  ? <Check size={12} className="text-green-500" />
                  : <Copy size={12} />
                }
              </button>
            </div>
            {/* 编辑资料 */}
            <button
              onClick={() => showToast('功能建设中')}
              className="flex-shrink-0 text-[13px] text-blue-500 hover:text-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors"
            >
              编辑资料
            </button>
          </div>
        </div>

        {/* ── 5.2 权益/套餐卡 ── */}
        <div className="rounded-2xl overflow-hidden shadow-sm bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
          <div className="px-5 pt-5 pb-4">
            {/* 套餐标题 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Sparkles size={14} className="text-blue-400" />
                </div>
                <span className="text-white font-semibold text-[15px]">免费版</span>
              </div>
              <span className="text-[12px] text-white/40">当前套餐</span>
            </div>
            {/* 权益摘要 */}
            <div className="space-y-1.5 mb-4">
              {[
                '基础对话功能',
                '4 种 AI 角色',
                '心情日记功能',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-[13px] text-white/60">
                  <Check size={12} className="text-blue-400 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            {/* CTA */}
            <button
              onClick={() => showToast('功能建设中')}
              className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-[14px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Zap size={15} />
              升级 Pro
            </button>
          </div>
          <div className="px-5 py-2.5 bg-white/5 border-t border-white/10">
            <button
              onClick={() => showToast('功能建设中')}
              className="text-[12px] text-white/40 hover:text-white/70 transition-colors"
            >
              查看权益详情 →
            </button>
          </div>
        </div>

        {/* ── 5.3 使用概览 ── */}
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm">
          <h3 className="text-[13px] font-medium text-gray-400 mb-3">使用概览</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3.5">
              <MessageSquare size={16} className="text-blue-500 mb-2" />
              <p className="text-[22px] font-bold text-gray-800 leading-tight">{stats?.totalSessions ?? 0}</p>
              <p className="text-[12px] text-gray-400 mt-0.5">对话次数</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3.5">
              <MessageSquare size={16} className="text-green-500 mb-2" />
              <p className="text-[22px] font-bold text-gray-800 leading-tight">{stats?.totalMessages ?? 0}</p>
              <p className="text-[12px] text-gray-400 mt-0.5">消息条数</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3.5">
              <Calendar size={16} className="text-purple-500 mb-2" />
              <p className="text-[22px] font-bold text-gray-800 leading-tight">{stats?.usageDays ?? 0}</p>
              <p className="text-[12px] text-gray-400 mt-0.5">使用天数</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3.5">
              <Star size={16} className="text-orange-400 mb-2" />
              <p className="text-[15px] font-bold text-gray-800 leading-tight">{stats?.favoriteCharacter ?? '-'}</p>
              <p className="text-[12px] text-gray-400 mt-0.5">常用角色</p>
            </div>
          </div>
        </div>

        {/* ── 5.4 我的服务入口 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          <EntryItem
            icon={<Clock size={15} className="text-blue-500" />}
            bg="bg-blue-50"
            label="对话历史"
            href="/sessions"
          />
          <EntryItem
            icon={<ShieldCheck size={15} className="text-green-500" />}
            bg="bg-green-50"
            label="账号与安全"
            onPress={() => showToast('功能建设中')}
            tag="建设中"
          />
          <EntryItem
            icon={<HelpCircle size={15} className="text-amber-500" />}
            bg="bg-amber-50"
            label="帮助与反馈"
            onPress={() => showToast('功能建设中')}
            tag="建设中"
          />
        </div>

        {/* ── 5.5 退出登录 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center justify-center w-full px-5 py-4 text-red-500 hover:bg-red-50 transition-colors gap-2 font-medium text-[14px]"
          >
            <LogOut size={15} />
            退出登录
          </button>
        </div>

        <div className="pb-8" />
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

// 服务入口项
function EntryItem({
  icon, bg, label, href, onPress, tag,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  href?: string;
  onPress?: () => void;
  tag?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <span className="flex-1 text-[14px] text-gray-800">{label}</span>
      {tag && (
        <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full mr-1">{tag}</span>
      )}
      <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
    </div>
  );

  if (href) return <a href={href}>{inner}</a>;
  return <button className="w-full text-left" onClick={onPress}>{inner}</button>;
}
