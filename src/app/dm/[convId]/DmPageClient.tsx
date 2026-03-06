'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { Send, ArrowLeft, Loader2, WifiOff, Wifi } from 'lucide-react';

interface DmMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  createdAt: number;
  isSelf: boolean;
}

export default function DmPageClient({ convId }: { convId: string }) {
  const router = useRouter();
  const { user, checkAuth } = useAuthStore();
  const [authReady, setAuthReady] = useState(false);
  const [friendNickname, setFriendNickname] = useState('私信');
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [wsState, setWsState] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCount = useRef(0);

  useEffect(() => {
    checkAuth().then(() => setAuthReady(true));
  }, []);

  const connect = useCallback((userId: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/dm/${convId}?userId=${userId}`);
    wsRef.current = ws;
    setWsState('connecting');

    ws.onopen = () => {
      setWsState('open');
      reconnectCount.current = 0;
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'history') {
        setMessages(data.messages);
        // 从历史消息推断对方昵称
        const other = data.messages.find((m: DmMessage) => !m.isSelf);
        if (other) setFriendNickname(other.senderNickname);
      } else if (data.type === 'message') {
        const msg = data.message;
        const isSelf = msg.senderId === userId;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, { ...msg, isSelf }];
        });
        if (!isSelf) setFriendNickname(msg.senderNickname);
      }
    };

    ws.onclose = () => {
      setWsState('closed');
      wsRef.current = null;
      // 自动重连（最多 5 次，指数退避）
      if (reconnectCount.current < 5) {
        const delay = Math.min(1000 * 2 ** reconnectCount.current, 15000);
        reconnectCount.current++;
        reconnectTimerRef.current = setTimeout(() => connect(userId), delay);
      } else {
        setWsState('error');
      }
    };

    ws.onerror = () => setWsState('error');
  }, [convId]);

  useEffect(() => {
    if (!authReady || !user) return;
    connect(user.id);
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [authReady, user, connect]);

  // 自动滚底
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (!content || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'send', content }));
    setInput('');
  };

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 顶栏 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-white">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900">{friendNickname}</h1>
          <p className="text-xs flex items-center gap-1">
            {wsState === 'open' && <><Wifi size={11} className="text-green-500" /><span className="text-green-500">已连接</span></>}
            {wsState === 'connecting' && <><Loader2 size={11} className="animate-spin text-gray-400" /><span className="text-gray-400">连接中…</span></>}
            {wsState === 'closed' && <><WifiOff size={11} className="text-amber-500" /><span className="text-amber-500">重连中…</span></>}
            {wsState === 'error' && (
              <>
                <WifiOff size={11} className="text-red-500" />
                <span className="text-red-500">连接失败</span>
                <button
                  onClick={() => { reconnectCount.current = 0; connect(user.id); }}
                  className="ml-1 text-blue-500 underline"
                >
                  重试
                </button>
              </>
            )}
          </p>
        </div>
      </header>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {messages.length === 0 && wsState === 'open' && (
          <p className="text-center text-gray-400 text-sm py-12">还没有消息，发一条打个招呼吧 👋</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
            {!msg.isSelf && (
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold mt-0.5">
                {msg.senderNickname.slice(0, 1)}
              </div>
            )}
            <div className={`max-w-[72%]`}>
              {!msg.isSelf && (
                <p className="text-xs text-gray-400 mb-1 ml-1">{msg.senderNickname}</p>
              )}
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.isSelf
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              <p className={`text-xs text-gray-400 mt-1 ${msg.isSelf ? 'text-right' : 'ml-1'}`}>
                {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {msg.isSelf && (
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white text-sm font-bold mt-0.5">
                {user.nickname.slice(0, 1)}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t bg-white px-4 py-3 safe-area-bottom">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={wsState === 'open' ? `给 ${friendNickname} 发消息…` : '等待连接…'}
            rows={1}
            disabled={wsState !== 'open'}
            className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder-gray-400 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200 focus:border-blue-400 focus:bg-white transition-colors disabled:opacity-50"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || wsState !== 'open'}
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
