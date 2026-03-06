'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { Send, ArrowLeft, Loader2, WifiOff, RefreshCw } from 'lucide-react';

interface DmMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  createdAt: number;
  isSelf: boolean;
  status?: 'sending' | 'sent' | 'failed';
}

export default function DmPageClient({ convId }: { convId: string }) {
  const router = useRouter();
  const { user, checkAuth } = useAuthStore();
  const [authReady, setAuthReady] = useState(false);
  const [friendNickname, setFriendNickname] = useState('私信');
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [pollError, setPollError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    checkAuth().then(() => setAuthReady(true));
  }, []);

  // 拉取消息
  const fetchMessages = useCallback(async (userId: string, since = 0) => {
    try {
      const url = `/api/dm/conversations/${convId}/messages${since ? `?after=${since}` : ''}`;
      const r = await fetch(url, { headers: { 'x-user-id': userId } });
      const d = await r.json();
      if (d.success) {
        setPollError(false);
        const newMsgs: DmMessage[] = d.data.map((m: any) => ({
          ...m,
          isSelf: m.senderId === userId,
          status: 'sent' as const,
        }));
        if (newMsgs.length > 0) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const fresh = newMsgs.filter(m => !ids.has(m.id));
            // 推断对方昵称
            const other = fresh.find(m => !m.isSelf);
            if (other) setFriendNickname(other.senderNickname);
            return [...prev, ...fresh];
          });
          lastTsRef.current = newMsgs[newMsgs.length - 1].createdAt;
        }
      } else {
        setPollError(true);
      }
    } catch {
      setPollError(true);
    }
  }, [convId]);

  // 初始化 + 开始轮询
  useEffect(() => {
    if (!authReady || !user) return;
    fetchMessages(user.id, 0).finally(() => setLoading(false));
    pollTimerRef.current = setInterval(() => {
      fetchMessages(user.id, lastTsRef.current);
    }, 3000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [authReady, user, fetchMessages]);

  // 自动滚底
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // textarea 自适应高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !user || sendingRef.current) return;
    sendingRef.current = true;

    // 乐观更新
    const tempId = `temp_${Date.now()}`;
    const optimistic: DmMessage = {
      id: tempId,
      senderId: user.id,
      senderNickname: user.nickname,
      content,
      createdAt: Date.now(),
      isSelf: true,
      status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');

    try {
      const r = await fetch(`/api/dm/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'x-user-id': user.id, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const d = await r.json();
      if (d.success) {
        // 用真实消息替换乐观消息
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...d.data, isSelf: true, status: 'sent' as const } : m
        ));
        lastTsRef.current = d.data.createdAt;
      } else {
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, status: 'failed' as const } : m
        ));
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, status: 'failed' as const } : m
      ));
    } finally {
      sendingRef.current = false;
    }
  };

  const handleRetry = async (msg: DmMessage) => {
    if (!user) return;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sending' } : m));
    try {
      const r = await fetch(`/api/dm/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'x-user-id': user.id, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg.content }),
      });
      const d = await r.json();
      if (d.success) {
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...d.data, isSelf: true, status: 'sent' as const } : m
        ));
        lastTsRef.current = d.data.createdAt;
      } else {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'failed' } : m));
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'failed' } : m));
    }
  };

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (authReady && !user) {
    router.replace('/login');
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-gray-900 truncate">{friendNickname}</h1>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            {pollError
              ? <><WifiOff size={10} className="text-amber-500" /><span className="text-amber-500">消息同步中断</span>
                  <button onClick={() => user && fetchMessages(user.id, lastTsRef.current)}
                    className="ml-1 text-blue-500 underline flex items-center gap-0.5"><RefreshCw size={10} />重试</button></>
              : <><span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" /><span className="text-green-500">已连接（3秒轮询）</span></>
            }
          </p>
        </div>
      </header>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-gray-300" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-16">还没有消息，发一条打招呼吧 👋</p>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex gap-2.5 ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
            {!msg.isSelf && (
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold self-start">
                {msg.senderNickname.slice(0, 1)}
              </div>
            )}
            <div className="max-w-[72%]">
              {!msg.isSelf && <p className="text-xs text-gray-400 mb-1 ml-1">{msg.senderNickname}</p>}
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                msg.isSelf
                  ? msg.status === 'failed'
                    ? 'bg-red-100 text-red-700 rounded-tr-sm'
                    : 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              <div className={`flex items-center gap-1.5 mt-1 ${msg.isSelf ? 'justify-end' : 'ml-1'}`}>
                <span className="text-xs text-gray-400">
                  {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.isSelf && msg.status === 'sending' && <Loader2 size={10} className="animate-spin text-gray-400" />}
                {msg.isSelf && msg.status === 'failed' && (
                  <button onClick={() => handleRetry(msg)} className="text-xs text-red-500 underline">重发</button>
                )}
              </div>
            </div>
            {msg.isSelf && (
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white text-sm font-bold self-start">
                {user?.nickname.slice(0, 1)}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`给 ${friendNickname} 发消息…`}
            rows={1}
            className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder-gray-400 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200 focus:border-blue-400 focus:bg-white transition-colors overflow-hidden"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-2xl transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </div>
  );
}
