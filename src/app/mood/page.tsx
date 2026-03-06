'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { ChevronLeft, Calendar, Smile, Frown, Angry, AlertCircle, Meh } from 'lucide-react';
import Link from 'next/link';

const moodOptions = [
  { value: 'happy', label: '开心', icon: Smile, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { value: 'neutral', label: '平静', icon: Meh, color: 'text-gray-500', bg: 'bg-gray-50' },
  { value: 'sad', label: '难过', icon: Frown, color: 'text-blue-500', bg: 'bg-blue-50' },
  { value: 'anxious', label: '焦虑', icon: AlertCircle, color: 'text-purple-500', bg: 'bg-purple-50' },
  { value: 'angry', label: '生气', icon: Angry, color: 'text-red-500', bg: 'bg-red-50' },
];

interface MoodRecord {
  _id: string;
  mood: string;
  content: string;
  date: string;
}

export default function MoodPage() {
  const { user, isLoggedIn, checkAuth } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedMood, setSelectedMood] = useState('');
  const [content, setContent] = useState('');
  const [moods, setMoods] = useState<MoodRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAuth().then(() => setIsCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (isCheckingAuth) return;
    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    fetchMoods();
    fetchStats();
  }, [isLoggedIn, isCheckingAuth]);

  const fetchMoods = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mood?userId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setMoods(data.data.moods);
      }
    } catch (error) {
      console.error('Fetch moods error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/mood/stats?userId=${user.id}&days=30`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const saveMood = async () => {
    if (!user?.id || !selectedMood) {
      alert('请先选择心情');
      return;
    }
    
    setSaving(true);
    try {
      const res = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          mood: selectedMood,
          content,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        alert('心情记录保存成功！');
        setContent('');
        setSelectedMood('');
        fetchMoods();
        fetchStats();
      } else {
        alert(data.error || '保存失败，请重试');
      }
    } catch (error) {
      console.error('Save mood error:', error);
      alert('网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-gray-600 hover:text-gray-800">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold">心情日记</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 今日心情记录 */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <Calendar className="mr-2 text-blue-500" size={20} />
            今天的心情
          </h2>
          
          {/* 心情选择 */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {moodOptions.map((mood) => {
              const Icon = mood.icon;
              return (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={`flex flex-col items-center p-3 rounded-lg transition ${
                    selectedMood === mood.value
                      ? `${mood.bg} ${mood.color} ring-2 ring-offset-2 ring-blue-500`
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <Icon size={28} className={mood.color} />
                  <span className="text-xs mt-1 text-gray-600">{mood.label}</span>
                </button>
              );
            })}
          </div>

          {/* 日记输入 */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录一下今天的心情..."
            className="w-full p-3 border rounded-lg resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* 保存按钮 */}
          <button
            onClick={saveMood}
            disabled={!selectedMood || saving}
            className="w-full mt-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? '保存中...' : '保存心情'}
          </button>
        </div>

        {/* 心情统计 */}
        {stats && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-medium mb-4">心情统计（近30天）</h2>
            <div className="grid grid-cols-5 gap-2 text-center">
              {moodOptions.map((mood) => (
                <div key={mood.value} className={`p-3 rounded-lg ${mood.bg}`}>
                  <p className="text-2xl font-bold">{stats.moodCounts[mood.value] || 0}</p>
                  <p className="text-xs text-gray-500">{mood.label}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-gray-500 mt-3">
              共记录 {stats.total} 天
            </p>
          </div>
        )}

        {/* 历史记录 */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">历史记录</h2>
          {loading ? (
            <p className="text-center text-gray-500 py-4">加载中...</p>
          ) : moods.length === 0 ? (
            <p className="text-center text-gray-400 py-4">还没有心情记录</p>
          ) : (
            <div className="space-y-3">
              {moods.map((mood) => {
                const moodOption = moodOptions.find((m) => m.value === mood.mood);
                const Icon = moodOption?.icon || Meh;
                return (
                  <div key={mood._id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Icon size={20} className={moodOption?.color} />
                        <span className="font-medium">{moodOption?.label}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(mood.date).toLocaleDateString()}
                      </span>
                    </div>
                    {mood.content && (
                      <p className="text-sm text-gray-600">{mood.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
