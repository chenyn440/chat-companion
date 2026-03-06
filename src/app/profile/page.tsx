'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { ChevronLeft, User, MessageSquare, Calendar, Star, Settings, Smile } from 'lucide-react';
import Link from 'next/link';
import { CHARACTERS } from '@/lib/config/characters';

const MODES = [
  { value: 'companion', label: '陪伴' },
  { value: 'treehole', label: '树洞' },
  { value: 'advice', label: '建议' },
];

interface UserStats {
  totalSessions: number;
  totalMessages: number;
  usageDays: number;
  favoriteCharacter: string;
  favoriteCharacterKey: string;
}

export default function ProfilePage() {
  const { user, setUser, isLoggedIn, checkAuth } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');

  useEffect(() => {
    checkAuth().then(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    if (user?.id) {
      fetchStats();
    }
  }, [user?.id, isLoggedIn, authLoading]);

  // 同步 nickname 状态当 user 变化时
  useEffect(() => {
    if (user?.nickname && !editing) {
      setNickname(user.nickname);
    }
  }, [user?.nickname, editing]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/user/stats?userId=${user?.id}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const handleUpdatePreferences = async (preferences: { defaultCharacter?: string; defaultMode?: string }) => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          preferences: { ...user.preferences, ...preferences }
        }),
      });
      const data = await res.json();
      if (data.success && user) {
        setUser({ ...user, preferences: data.data.preferences || { ...user.preferences, ...preferences } });
      } else {
        alert(data.error || '设置失败，请重试');
      }
    } catch (error) {
      console.error('Update preferences error:', error);
      alert('网络错误，请重试');
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.id) return;
    
    // 验证昵称不为空
    if (!nickname.trim()) {
      alert('昵称不能为空');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, nickname: nickname.trim() }),
      });
      
      const data = await res.json();
      
      if (data.success && user) {
        // 更新全局状态
        setUser({ 
          ...user, 
          nickname: data.data.nickname,
          avatar: data.data.avatar || user.avatar,
          preferences: data.data.preferences || user.preferences,
        });
        setEditing(false);
        alert('昵称修改成功！');
      } else {
        alert(data.error || '修改失败，请重试');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      alert('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-gray-600 hover:text-gray-800">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold">个人中心</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 用户信息卡片 */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl">
              {user?.nickname?.[0] || <User size={32} />}
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="border rounded px-2 py-1"
                    placeholder="输入昵称"
                  />
                  <button
                    onClick={handleUpdateProfile}
                    disabled={loading}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                  >
                    {loading ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setNickname(user?.nickname || '');
                    }}
                    className="px-3 py-1 text-gray-500 text-sm"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-medium">{user?.nickname || '未设置昵称'}</h2>
                  <button
                    onClick={() => {
                      setNickname(user?.nickname || '');
                      setEditing(true);
                    }}
                    className="text-blue-500 text-sm"
                  >
                    修改
                  </button>
                </div>
              )}
              <p className="text-gray-500 text-sm">{user?.phone}</p>
            </div>
          </div>
        </div>

        {/* 统计数据 */}
        {stats && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <Star className="mr-2 text-yellow-500" size={20} />
              使用统计
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <MessageSquare className="mx-auto mb-2 text-blue-500" size={24} />
                <p className="text-2xl font-bold text-blue-600">{stats.totalSessions}</p>
                <p className="text-sm text-gray-500">对话次数</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <MessageSquare className="mx-auto mb-2 text-green-500" size={24} />
                <p className="text-2xl font-bold text-green-600">{stats.totalMessages}</p>
                <p className="text-sm text-gray-500">消息条数</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <Calendar className="mx-auto mb-2 text-purple-500" size={24} />
                <p className="text-2xl font-bold text-purple-600">{stats.usageDays}</p>
                <p className="text-sm text-gray-500">使用天数</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <Star className="mx-auto mb-2 text-orange-500" size={24} />
                <p className="text-lg font-bold text-orange-600">{stats.favoriteCharacter}</p>
                <p className="text-sm text-gray-500">最爱角色</p>
              </div>
            </div>
          </div>
        )}

        {/* 偏好设置 */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <Settings className="mr-2 text-gray-500" size={20} />
            偏好设置
          </h3>
          <div className="space-y-3">
            <Link href="/sessions" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              <span>对话历史</span>
              <ChevronLeft className="transform rotate-180" size={18} />
            </Link>
            <Link href="/mood" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              <span className="flex items-center">
                <Smile className="mr-2 text-yellow-500" size={18} />
                心情日记
              </span>
              <ChevronLeft className="transform rotate-180" size={18} />
            </Link>
            {/* 默认角色选择 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">默认角色</p>
              <div className="flex flex-wrap gap-2">
                {CHARACTERS.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => handleUpdatePreferences({ defaultCharacter: char.id })}
                    className={`px-3 py-1 rounded-full text-sm transition ${
                      (user?.preferences?.defaultCharacter || 'gentle') === char.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {char.avatar} {char.name}
                  </button>
                ))}
              </div>
            </div>
            {/* 默认模式选择 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">默认模式</p>
              <div className="flex flex-wrap gap-2">
                {MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => handleUpdatePreferences({ defaultMode: mode.value })}
                    className={`px-3 py-1 rounded-full text-sm transition ${
                      (user?.preferences?.defaultMode || 'companion') === mode.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
