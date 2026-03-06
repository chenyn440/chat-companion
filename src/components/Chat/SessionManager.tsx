'use client';

import { useState } from 'react';
import { StoredSession } from '@/lib/storage/chatStorage';
import { Search, Pin, Trash2, Edit2, Check, X } from 'lucide-react';

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

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export default function SessionManager({
  sessions,
  currentSessionId,
  onSessionSelect,
  onDeleteSession,
  onRenameSession,
  onTogglePin,
  onExport,
}: SessionManagerProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);

  const sorted = [...sessions].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const filtered = search
    ? sorted.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : sorted;

  const commitRename = (sid: string) => {
    if (editTitle.trim()) onRenameSession(sid, editTitle.trim());
    setEditingId(null);
    setEditTitle('');
  };

  // 按日期分组
  const grouped: { label: string; items: StoredSession[] }[] = [];
  let lastLabel = '';
  for (const s of filtered) {
    const diffDays = Math.floor((Date.now() - s.updatedAt) / 86400000);
    const label = diffDays === 0 ? '今天' : diffDays === 1 ? '昨天' : diffDays < 7 ? '最近 7 天' : '更早';
    if (label !== lastLabel) { grouped.push({ label, items: [] }); lastLabel = label; }
    grouped[grouped.length - 1].items.push(s);
  }

  return (
    <div className="flex flex-col h-full text-gray-200">
      {/* 搜索 */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input
            type="text"
            placeholder="搜索对话..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-500 outline-none focus:bg-white/15 transition-colors"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 scrollbar-dark">
        {filtered.length === 0 && (
          <p className="text-center text-gray-600 text-xs py-8">
            {search ? '未找到匹配对话' : '暂无对话记录'}
          </p>
        )}

        {grouped.map(group => (
          <div key={group.label}>
            <p className="text-gray-600 text-xs px-2 pt-4 pb-1.5 font-medium">{group.label}</p>
            {group.items.map(s => (
              <div
                key={s.id}
                onClick={() => onSessionSelect(s.id)}
                onMouseEnter={() => setHoverId(s.id)}
                onMouseLeave={() => setHoverId(null)}
                className={`group relative flex items-center gap-2 px-2 py-2.5 rounded-lg cursor-pointer transition-colors select-none ${
                  currentSessionId === s.id
                    ? 'bg-white/15 text-white'
                    : 'hover:bg-white/10 text-gray-300'
                }`}
              >
                {/* 置顶图标 */}
                {s.pinned && <Pin size={12} className="flex-shrink-0 text-amber-400" />}

                {/* 标题 / 编辑框 */}
                {editingId === s.id ? (
                  <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(s.id);
                        if (e.key === 'Escape') { setEditingId(null); setEditTitle(''); }
                      }}
                      autoFocus
                      className="flex-1 bg-white/20 text-white text-xs rounded px-2 py-1 outline-none"
                    />
                    <button onClick={() => commitRename(s.id)} className="text-green-400 hover:text-green-300">
                      <Check size={13} />
                    </button>
                    <button onClick={() => { setEditingId(null); setEditTitle(''); }} className="text-gray-500 hover:text-gray-300">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-xs truncate">{s.title}</span>
                    <span className="text-gray-600 text-xs flex-shrink-0 group-hover:hidden">
                      {formatTime(s.updatedAt)}
                    </span>

                    {/* 操作按钮 */}
                    <div className="hidden group-hover:flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onTogglePin(s.id)}
                        className="p-1 rounded hover:bg-white/15"
                        title={s.pinned ? '取消置顶' : '置顶'}
                      >
                        <Pin size={13} className={s.pinned ? 'text-amber-400' : 'text-gray-400'} />
                      </button>
                      <button
                        onClick={() => { setEditingId(s.id); setEditTitle(s.title); }}
                        className="p-1 rounded hover:bg-white/15"
                        title="重命名"
                      >
                        <Edit2 size={13} className="text-gray-400" />
                      </button>
                      <button
                        onClick={() => { if (confirm('确定删除？')) onDeleteSession(s.id); }}
                        className="p-1 rounded hover:bg-red-500/20"
                        title="删除"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
