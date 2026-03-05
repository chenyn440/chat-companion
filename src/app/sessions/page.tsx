'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { Search, Trash2, Star, MessageSquare, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

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

export default function SessionList() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorite'>('all');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId: user?.id || 'guest',
        search,
        page: page.toString(),
        limit: '20',
      });
      
      if (filter === 'favorite') {
        params.append('favorite', 'true');
      }
      
      const res = await fetch(`/api/chat/sessions?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setSessions(data.data.sessions);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Fetch sessions error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [search, filter, page, user]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个对话吗？')) return;
    
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setSessions(sessions.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Delete session error:', error);
    }
  };

  const handleToggleFavorite = async (id: string, isFavorite: boolean) => {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !isFavorite }),
      });
      
      if (res.ok) {
        setSessions(sessions.map(s => 
          s.id === id ? { ...s, isFavorite: !isFavorite } : s
        ));
      }
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  const getModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      companion: '陪伴',
      treehole: '树洞',
      advice: '建议',
    };
    return labels[mode] || mode;
  };

  const getCharacterLabel = (character: string) => {
    const labels: Record<string, string> = {
      gentle: '温柔知心',
      rational: '理性分析',
      funny: '幽默风趣',
      elder: '长辈关怀',
    };
    return labels[character] || character;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b p-4">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-gray-600 hover:text-gray-800">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold">对话历史</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 搜索和筛选 */}
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索对话..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setFilter(filter === 'all' ? 'favorite' : 'all')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'favorite'
                ? 'bg-yellow-500 text-white'
                : 'bg-white border text-gray-600'
            }`}
          >
            <Star size={18} className={filter === 'favorite' ? 'fill-current' : ''} />
          </button>
        </div>

        {/* 对话列表 */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
            <p>暂无对话记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <Link href={`/chat/${session.id}`} className="flex-1">
                    <h3 className="font-medium text-gray-800 mb-1">{session.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-1">{session.lastMessage}</p>
                    <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400">
                      <span className="bg-gray-100 px-2 py-1 rounded">{getModeLabel(session.mode)}</span>
                      <span className="bg-gray-100 px-2 py-1 rounded">{getCharacterLabel(session.character)}</span>
                      <span>{session.messageCount} 条消息</span>
                      <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => handleToggleFavorite(session.id, session.isFavorite)}
                      className={`p-2 rounded-lg transition-colors ${
                        session.isFavorite
                          ? 'text-yellow-500 hover:bg-yellow-50'
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <Star size={18} className={session.isFavorite ? 'fill-current' : ''} />
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex justify-center space-x-2 pt-4">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-4 py-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 border rounded-lg disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
