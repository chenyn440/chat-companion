'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, User, Copy, Check,
  MessageSquare, Calendar, Star, Zap,
  ShieldCheck, HelpCircle, Clock, LogOut,
  Sparkles, ChevronDown, ChevronUp, Receipt, FileText,
  Camera, Pencil, X,
} from 'lucide-react';

function maskPhone(phone: string) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

interface UserStats {
  totalSessions: number;
  totalMessages: number;
  usageDays: number;
  favoriteCharacter: string;
}

// ─── 编辑资料弹窗 ─────────────────────────────────────────────
function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: { id: string; nickname?: string; avatar?: string; motto?: string };
  onClose: () => void;
  onSaved: (data: { nickname: string; avatar: string; motto: string }) => void;
}) {
  const [nickname, setNickname] = useState(user.nickname || '');
  const [motto, setMotto] = useState(user.motto || '');
  const [avatarPreview, setAvatarPreview] = useState(user.avatar || '');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('图片不能超过 5MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          nickname: nickname.trim(),
          avatar: avatarPreview,
          motto: motto.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved({ nickname: data.data.nickname, avatar: data.data.avatar || '', motto: data.data.motto || '' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-[16px] font-semibold text-gray-900">编辑资料</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* 头像 */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-3xl font-bold shadow-sm overflow-hidden">
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  : (nickname?.[0] || <User size={32} />)
                }
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center shadow-md transition-colors"
              >
                <Camera size={13} className="text-white" />
              </button>
            </div>
            <span className="text-[12px] text-gray-400">点击相机图标上传头像（≤5MB）</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* 昵称 */}
          <div>
            <label className="block text-[12px] text-gray-400 mb-1.5">昵称</label>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              maxLength={20}
              placeholder="请输入昵称"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-800 outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          {/* 座右铭 */}
          <div>
            <label className="block text-[12px] text-gray-400 mb-1.5">座右铭</label>
            <input
              value={motto}
              onChange={e => setMotto(e.target.value)}
              maxLength={40}
              placeholder="一句话介绍自己（可选）"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-800 outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={saving || !nickname.trim()}
            className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-[14px] font-semibold transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser, isLoggedIn, checkAuth, logout } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [userMotto, setUserMotto] = useState('');
  const [userAvatar, setUserAvatar] = useState('');

  // 权益展开
  const [benefitsExpanded, setBenefitsExpanded] = useState(false);

  // 复制 ID
  const [copied, setCopied] = useState(false);

  // 编辑资料弹窗
  const [showEditModal, setShowEditModal] = useState(false);

  // 退出确认
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  useEffect(() => { checkAuth().then(() => setAuthLoading(false)); }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { router.replace('/login'); return; }
    if (user?.id) {
      fetchStats();
      fetchUserExtra();
    }
  }, [authLoading, isLoggedIn, user?.id]);

  const fetchStats = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/user/stats?userId=${user.id}`);
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch { /* ignore */ }
  };

  const fetchUserExtra = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/user/profile?userId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setUserMotto(data.data.motto || '');
        setUserAvatar(data.data.avatar || '');
      }
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

  const handleEditSaved = (data: { nickname: string; avatar: string; motto: string }) => {
    if (user) setUser({ ...user, nickname: data.nickname });
    setUserMotto(data.motto);
    setUserAvatar(data.avatar);
    setShowEditModal(false);
    showToast('资料已保存');
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

  const allBenefits = [
    '基础对话功能',
    '4 种 AI 角色',
    '心情日记功能',
    '私信好友功能',
    '对话历史记录',
    '消息收藏功能',
  ];
  const visibleBenefits = benefitsExpanded ? allBenefits : allBenefits.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white text-sm px-5 py-2 rounded-full shadow-xl z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* 编辑资料弹窗 */}
      {showEditModal && user && (
        <EditProfileModal
          user={{ id: user.id, nickname: user.nickname, avatar: userAvatar, motto: userMotto }}
          onClose={() => setShowEditModal(false)}
          onSaved={handleEditSaved}
        />
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

        {/* ── 1. 身份信息区 ── */}
        <div className="bg-white rounded-2xl px-5 py-5 shadow-sm">
          <div className="flex items-start gap-4">
            {/* 头像 */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-sm overflow-hidden">
              {userAvatar
                ? <img src={userAvatar} alt="avatar" className="w-full h-full object-cover" />
                : (user?.nickname?.[0] || <User size={28} />)
              }
            </div>

            {/* 信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[17px] font-semibold text-gray-900 truncate">
                  {user?.nickname || '未设置昵称'}
                </span>
              </div>
              {/* 座右铭 */}
              {userMotto && (
                <p className="text-[12px] text-gray-400 truncate mb-1">{userMotto}</p>
              )}
              {/* 登录方式（脱敏） */}
              <p className="text-[13px] text-gray-400 mb-1.5">{maskPhone(user?.phone || '')}</p>
              {/* 用户 ID 可复制 */}
              <button onClick={handleCopyId} className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-blue-500 transition-colors">
                <span className="font-mono">ID: {user?.id?.slice(-10)}</span>
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
            </div>

            {/* 编辑资料 */}
            <button
              onClick={() => setShowEditModal(true)}
              className="flex-shrink-0 flex items-center gap-1 text-[13px] text-blue-500 hover:text-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors mt-0.5"
            >
              <Pencil size={13} />
              编辑
            </button>
          </div>
        </div>

        {/* ── 2. 权益/套餐卡 ── */}
        <div className="rounded-2xl overflow-hidden shadow-sm bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Sparkles size={14} className="text-blue-400" />
                </div>
                <span className="text-white font-semibold text-[15px]">免费版</span>
              </div>
              <span className="text-[12px] text-white/40">当前套餐</span>
            </div>

            {/* 权益列表（可展开） */}
            <div className="space-y-1.5 mb-3">
              {visibleBenefits.map(item => (
                <div key={item} className="flex items-center gap-2 text-[13px] text-white/60">
                  <Check size={12} className="text-blue-400 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            {/* 展开/收起 */}
            <button
              onClick={() => setBenefitsExpanded(e => !e)}
              className="flex items-center gap-1 text-[12px] text-blue-400/80 hover:text-blue-300 mb-4 transition-colors"
            >
              {benefitsExpanded ? <><ChevronUp size={13} />收起</> : <><ChevronDown size={13} />查看全部权益</>}
            </button>

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
            <button onClick={() => showToast('功能建设中')} className="text-[12px] text-white/40 hover:text-white/70 transition-colors">
              查看权益详情 →
            </button>
          </div>
        </div>

        {/* ── 3. 使用概览 ── */}
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

        {/* ── 4. 我的服务入口（分组） ── */}
        {/* 交易相关 */}
        <div>
          <p className="text-[11px] text-gray-400 px-1 mb-1.5 font-medium tracking-wide">交易</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
            <EntryItem icon={<Receipt size={15} className="text-blue-500" />} bg="bg-blue-50" label="订单/购买记录" onPress={() => showToast('功能建设中')} tag="建设中" />
            <EntryItem icon={<FileText size={15} className="text-violet-500" />} bg="bg-violet-50" label="账单/发票" onPress={() => showToast('功能建设中')} tag="建设中" />
          </div>
        </div>

        {/* 账户安全 */}
        <div>
          <p className="text-[11px] text-gray-400 px-1 mb-1.5 font-medium tracking-wide">账户安全</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <EntryItem icon={<ShieldCheck size={15} className="text-green-500" />} bg="bg-green-50" label="账号与安全" onPress={() => showToast('功能建设中')} tag="建设中" />
          </div>
        </div>

        {/* 内容 */}
        <div>
          <p className="text-[11px] text-gray-400 px-1 mb-1.5 font-medium tracking-wide">内容</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <EntryItem icon={<Clock size={15} className="text-amber-500" />} bg="bg-amber-50" label="对话历史" href="/sessions" />
          </div>
        </div>

        {/* 支持 */}
        <div>
          <p className="text-[11px] text-gray-400 px-1 mb-1.5 font-medium tracking-wide">支持</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <EntryItem icon={<HelpCircle size={15} className="text-pink-500" />} bg="bg-pink-50" label="帮助与反馈" onPress={() => showToast('功能建设中')} tag="建设中" />
          </div>
        </div>

        {/* ── 5. 退出登录 ── */}
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
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3.5 text-[15px] text-gray-600 hover:bg-gray-50 transition-colors">取消</button>
              <div className="w-px bg-gray-100" />
              <button onClick={handleLogout} className="flex-1 py-3.5 text-[15px] text-red-500 font-medium hover:bg-red-50 transition-colors">退出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EntryItem({ icon, bg, label, href, onPress, tag }: {
  icon: React.ReactNode; bg: string; label: string;
  href?: string; onPress?: () => void; tag?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <span className="flex-1 text-[14px] text-gray-800">{label}</span>
      {tag && <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full mr-1">{tag}</span>}
      <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
    </div>
  );
  if (href) return <a href={href}>{inner}</a>;
  return <button className="w-full text-left" onClick={onPress}>{inner}</button>;
}
