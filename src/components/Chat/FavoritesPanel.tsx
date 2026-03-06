'use client';

import { useState, useEffect } from 'react';
import { chatStorage, StoredSession, StoredMessage } from '@/lib/storage/chatStorage';
import { Star, Search, Copy, X, ExternalLink } from 'lucide-react';

interface FavoritesPanelProps {
  onJumpToMessage: (sessionId: string, messageId: string) => void;
  onClose: () => void;
}

export default function FavoritesPanel({ onJumpToMessage, onClose }: FavoritesPanelProps) {
  const [favorites, setFavorites] = useState<Array<{ session: StoredSession; message: StoredMessage }>>([]);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = () => {
    setFavorites(chatStorage.getFavoriteMessages());
  };

  const handleUnfavorite = (sessionId: string, messageId: string) => {
    chatStorage.toggleMessageFavorite(sessionId, messageId);
    loadFavorites();
  };

  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  };

  const filtered = search
    ? favorites.filter(f =>
        f.message.content.toLowerCase().includes(search.toLowerCase()) ||
        f.session.title.toLowerCase().includes(search.toLowerCase())
      )
    : favorites;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-amber-500 fill-amber-400" />
          <h2 className="font-semibold text-gray-800 text-sm">收藏</h2>
          {favorites.length > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{favorites.length}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
          <X size={16} />
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
          <input
            type="text"
            placeholder="搜索收藏内容..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-700 placeholder-gray-400 outline-none focus:bg-gray-100 transition-colors"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <Star size={32} className="text-gray-200" />
            <p className="text-sm">{search ? '未找到匹配收藏' : '还没有收藏内容'}</p>
            <p className="text-xs">在对话中点击 ⭐ 收藏消息</p>
          </div>
        )}

        {filtered.map(({ session, message }) => (
          <div
            key={message.id}
            className="group border border-gray-100 rounded-xl p-3 hover:border-amber-200 hover:bg-amber-50/30 transition-colors"
          >
            {/* 会话标题 + 时间 */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 truncate flex-1">{session.title}</span>
              <span className="text-xs text-gray-300 ml-2 flex-shrink-0">{formatTime(message.createdAt)}</span>
            </div>

            {/* 角色标签 */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                message.role === 'assistant'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {message.role === 'assistant' ? 'AI' : '我'}
              </span>
            </div>

            {/* 消息摘要 */}
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
              {message.content}
            </p>

            {/* 操作按钮 */}
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onJumpToMessage(session.id, message.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <ExternalLink size={11} />
                跳转
              </button>
              <button
                onClick={() => handleCopy(message.id, message.content)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Copy size={11} />
                {copiedId === message.id ? '已复制' : '复制'}
              </button>
              <button
                onClick={() => handleUnfavorite(session.id, message.id)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-amber-500 hover:bg-amber-50 rounded-lg transition-colors ml-auto"
              >
                <Star size={11} className="fill-amber-400" />
                取消收藏
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
