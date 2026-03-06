'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface DmMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  createdAt: number;
  isSelf: boolean;
}

interface DmChatProps {
  userId: string;
  friend: { id: string; nickname: string; avatar?: string };
  onClose: () => void;
}

export default function DmChat({ userId, friend, onClose }: DmChatProps) {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headers = { 'x-user-id': userId, 'Content-Type': 'application/json' };

  // 初始化：创建/获取会话
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/dm/conversations', {
          method: 'POST', headers,
          body: JSON.stringify({ friendId: friend.id }),
        });
        const d = await r.json();
        if (d.success) {
          setConvId(d.data.conversationId);
        } else {
          setError(d.error || '无法建立会话');
        }
      } catch {
        setError('网络错误，请重试');
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, []);

  // 拉取消息（增量）
  const fetchMessages = useCallback(async (cid: string, since = 0) => {
    try {
      const url = `/api/dm/conversations/${cid}/messages${since ? `?after=${since}` : ''}`;
      const r = await fetch(url, { headers: { 'x-user-id': userId } });
      const d = await r.json();
      if (d.success) {
        setPollError(false);
        const newMsgs: DmMessage[] = d.data;
        if (newMsgs.length > 0) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
          });
          lastTsRef.current = newMsgs[newMsgs.length - 1].createdAt;
        }
      } else {
        setPollError(true);
      }
    } catch {
      setPollError(true);
    }
  }, [userId]);

  // 开始轮询
  useEffect(() => {
    if (!convId) return;
    fetchMessages(convId, 0); // 首次全量
    pollTimerRef.current = setInterval(() => {
      fetchMessages(convId, lastTsRef.current); // 增量
    }, 3000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [convId, fetchMessages]);

  // 自动滚底
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !convId || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    setError('');
    try {
      const r = await fetch(`/api/dm/conversations/${convId}/messages`, {
        method: 'POST', headers,
        body: JSON.stringify({ content }),
      });
      const d = await r.json();
      if (d.success) {
        setMessages(prev => [...prev, d.data]);
        lastTsRef.current = d.data.createdAt;
      } else {
        setInput(content); // 还原
        setError(d.error || '发送失败，请重试');
      }
    } catch {
      setInput(content);
      setError('网络错误，请重试');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ height: '70vh', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
              {friend.nickname.slice(0, 1)}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{friend.nickname}</p>
              <p className="text-xs text-green-500 flex items-center gap-1">
                {pollError
                  ? <span className="text-amber-500">连接中断</span>
                  : <><span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />轮询中</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertCircle size={24} className="text-red-400" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          {!loading && !error && messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">还没有消息，发一条打个招呼吧 👋</p>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
              {!msg.isSelf && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                  {msg.senderNickname.slice(0, 1)}
                </div>
              )}
              <div className={`max-w-[72%] ${msg.isSelf ? '' : ''}`}>
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.isSelf
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <p className={`text-xs text-gray-400 mt-1 ${msg.isSelf ? 'text-right' : ''}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.isSelf && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                  我
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 错误提示 */}
        {error && !loading && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-xs border-t">
            <AlertCircle size={12} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              <X size={12} />
            </button>
          </div>
        )}

        {/* 轮询断线提示 */}
        {pollError && (
          <div className="flex items-center justify-between px-4 py-2 bg-amber-50 text-amber-700 text-xs border-t">
            <span className="flex items-center gap-1"><AlertCircle size={12} />消息更新中断</span>
            <button onClick={() => convId && fetchMessages(convId, lastTsRef.current)}
              className="flex items-center gap-1 hover:text-amber-900">
              <RefreshCw size={11} />重试
            </button>
          </div>
        )}

        {/* 输入框 */}
        <div className="border-t bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`给 ${friend.nickname} 发消息...`}
              rows={1}
              disabled={!convId || sending}
              className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 focus:border-blue-400 focus:bg-white transition-colors disabled:opacity-50"
              style={{ minHeight: '40px', maxHeight: '100px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !convId || sending}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl transition-colors"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-center">Enter 发送 · Shift+Enter 换行</p>
        </div>
      </div>
    </div>
  );
}
