'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { Search, Trash2, Star, MessageSquare, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Session {
  id: string;
  title: string;
  mode: string;
  character: string;
  isFavorite: boolean;
  updatedAt: string;
  lastMessage: string;
  messageCount: number;
}

const MODE_LABELS: Record<string, string> = {
  companion: '陪伴', treehole: '树洞', advice: '建议',
};
const CHAR_LABELS: Record<string, { name: string; avatar: string }> = {
  gentle:   { name: '温柔知心', avatar: '🌸' },
  rational: { name: '理性分析', avatar: '🧠' },
  funny:    { name: '幽默风趣', avatar: '😄' },
  elder:    { name: '长辈关怀', avatar: '👴' },
};
const MODE_COLORS: Record<string, string> = {
  companion: 'bg-blue-50 text-blue-600',
  treehole:  'bg-violet-50 text-violet-600',
  advice:    'bg-green-50 text-green-600',
};

function formatTime(str: string) {
  const d = new Date(str);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const isThisYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', ...(isThisYear ? {} : { year: 'numeric' }) });
}

export default function SessionList() {
  const router = useRouter();
  const { user, isLoggedIn, checkAuth } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorite'>('all');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSessions = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: user.id, search, page: page.toString(), limit: '20' });
      if (filter === 'favorite') params.append('favorite', 'true');
      const res = await fetch(`/api/chat/sessions?${params}`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.data.sessions);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { checkAuth().then(() => setAuthLoading(false)); }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { router.replace('/login'); return; }
    fetchSessions();
  }, [search, filter, page, user, isLoggedIn, authLoading]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm('确定要删除这个对话吗？')) return;
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) setSessions(prev => prev.filter(s => s.id !== id));
    } catch { /* ignore */ }
  };

  const handleToggleFavorite = async (id: string, isFavorite: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !isFavorite }),
      });
      if (res.ok) setSessions(prev => prev.map(s => s.id === id ? { ...s, isFavorite: !isFavorite } : s));
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: '-apple-system, "PingFang SC", sans-serif' }}>

      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={22} />
          </button>
          <h1 className="ml-2 text-[17px] font-semibold text-gray-900">对话历史</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* 搜索 + 筛选 */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="搜索对话..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-[14px] text-gray-700 outline-none focus:border-blue-400 transition-colors placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => { setFilter(f => f === 'all' ? 'favorite' : 'all'); setPage(1); }}
            className={`px-4 py-2.5 rounded-xl border text-[13px] font-medium flex items-center gap-1.5 transition-colors ${
              filter === 'favorite'
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Star size={14} className={filter === 'favorite' ? 'fill-white' : ''} />
            收藏
          </button>
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-gray-300" />
            </div>
            <p className="text-[15px] font-medium text-gray-400">
              {filter === 'favorite' ? '还没有收藏的对话' : '暂无对话记录'}
            </p>
            <p className="text-[13px] text-gray-300 mt-1">
              {filter === 'favorite' ? '在对话中点击星标收藏吧' : '去开始你的第一次对话吧'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(session => {
              const char = CHAR_LABELS[session.character] || { name: session.character, avatar: '🤖' };
              const modeColor = MODE_COLORS[session.mode] || 'bg-gray-50 text-gray-500';
              return (
                <a
                  key={session.id}
                  href={`/chat-v2?session=${session.id}`}
                  className="block bg-white rounded-2xl px-4 py-4 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {/* 角色头像 */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-violet-100 flex items-center justify-center text-xl flex-shrink-0 mt-0.5">
                      {char.avatar}
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[14px] font-semibold text-gray-900 truncate flex-1">
                          {session.title || '未命名对话'}
                        </h3>
                        <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">
                          {formatTime(session.updatedAt)}
                        </span>
                      </div>

                      {session.lastMessage && (
                        <p className="text-[13px] text-gray-400 truncate mt-0.5">
                          {session.lastMessage}
                        </p>
                      )}

                      {/* 标签行 */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${modeColor}`}>
                          {MODE_LABELS[session.mode] || session.mode}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">
                          {char.name}
                        </span>
                        <span className="text-[11px] text-gray-300">·</span>
                        <span className="text-[11px] text-gray-400">{session.messageCount} 条</span>
                      </div>
                    </div>

                    {/* 操作按钮（悬浮显示） */}
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={e => handleToggleFavorite(session.id, session.isFavorite, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          session.isFavorite
                            ? 'text-amber-500 hover:bg-amber-50'
                            : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                        }`}
                      >
                        <Star size={15} className={session.isFavorite ? 'fill-current' : ''} />
                      </button>
                      <button
                        onClick={e => handleDelete(session.id, e)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2 pb-6">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              className="px-4 py-2 text-[13px] bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            <span className="text-[13px] text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 text-[13px] bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        )}

        {sessions.length > 0 && totalPages === 1 && <div className="pb-6" />}
      </div>
    </div>
  );
}
