'use client';

import { useState } from 'react';
import { chatStorage, StoredSession } from '@/lib/storage/chatStorage';
import { Plus, Search, Star, Pin, Trash2, Edit2, Download } from 'lucide-react';

interface SessionManagerProps {
  sessions: StoredSession[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onTogglePin: (sessionId: string) => void;
  onExport: (sessionId: string, format: 'txt' | 'md') => void;
}

export default function SessionManager({
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onTogglePin,
  onExport,
}: SessionManagerProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // 排序：置顶优先，然后按更新时间
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  // 搜索过滤
  const filteredSessions = searchKeyword
    ? sortedSessions.filter(s => s.title.toLowerCase().includes(searchKeyword.toLowerCase()))
    : sortedSessions;

  const handleRename = (sessionId: string) => {
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* 搜索框 */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="搜索会话..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* 新建按钮 */}
      <div className="p-3 border-b">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          新建会话
        </button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            {searchKeyword ? '未找到匹配的会话' : '暂无会话'}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`group relative p-3 rounded-lg cursor-pointer transition ${
                  currentSessionId === session.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => onSessionSelect(session.id)}
              >
                {/* 置顶标记 */}
                {session.pinned && (
                  <Pin size={12} className="absolute top-2 right-2 text-blue-600" />
                )}

                {/* 标题 */}
                {editingId === session.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(session.id);
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditTitle('');
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                ) : (
                  <div className="font-medium text-gray-800 text-sm truncate pr-4">
                    {session.title}
                  </div>
                )}

                {/* 时间 */}
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(session.updatedAt).toLocaleString()}
                </div>

                {/* 操作按钮 */}
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(session.id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title={session.pinned ? '取消置顶' : '置顶'}
                  >
                    <Pin size={14} className={session.pinned ? 'text-blue-600' : 'text-gray-600'} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(session.id);
                      setEditTitle(session.title);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="重命名"
                  >
                    <Edit2 size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('确定删除此会话吗？')) {
                        onDeleteSession(session.id);
                      }
                    }}
                    className="p-1 hover:bg-red-100 rounded"
                    title="删除"
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
