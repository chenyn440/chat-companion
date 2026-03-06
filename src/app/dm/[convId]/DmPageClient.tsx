'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { Send, ArrowLeft, Loader2, WifiOff, Wifi } from 'lucide-react';

type MsgStatus = 'sending' | 'sent' | 'failed';

interface DmMessage {
  serverMsgId?: string;
  clientMsgId?: string;
  fromUserId: string;
  senderNickname: string;
  content: string;
  createdAt: number;
  isSelf: boolean;
  status: MsgStatus;
}

type WsStatus = 'connecting' | 'open' | 'reconnecting' | 'error';

function genClientMsgId() {
  return `cm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function DmPageClient({ convId }: { convId: string }) {
  const router = useRouter();
  const { user, checkAuth } = useAuthStore();
  const [authReady, setAuthReady] = useState(false);
  const [friendNickname, setFriendNickname] = useState('私信');
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCount = useRef(0);
  const joinedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkAuth().then(() => setAuthReady(true));
  }, []);

  const wsConnect = useCallback((userId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/dm?userId=${userId}`);
    wsRef.current = ws;
    joinedRef.current = false;
    setWsStatus('connecting');

    ws.onopen = () => {
      reconnectCount.current = 0;
      // 发送 dm:join
      ws.send(JSON.stringify({ type: 'dm:join', conversationId: convId }));
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === 'dm:joined') {
        joinedRef.current = true;
        setWsStatus('open');
      }

      else if (data.type === 'dm:history') {
        const msgs: DmMessage[] = data.messages.map((m: any) => ({
          serverMsgId: m.serverMsgId,
          clientMsgId: m.clientMsgId,
          fromUserId: m.fromUserId,
          senderNickname: m.senderNickname,
          content: m.content,
          createdAt: m.createdAt,
          isSelf: m.fromUserId === userId,
          status: 'sent' as MsgStatus,
        }));
        setMessages(msgs);
        const other = msgs.find(m => !m.isSelf);
        if (other) setFriendNickname(other.senderNickname);
      }

      else if (data.type === 'dm:send_ack') {
        const { clientMsgId, serverMsgId, createdAt } = data;
        setMessages(prev => prev.map(m =>
          m.clientMsgId === clientMsgId
            ? { ...m, serverMsgId, createdAt, status: 'sent' }
            : m
        ));
      }

      else if (data.type === 'dm:message_new') {
        const msg = data;
        setMessages(prev => {
          if (prev.some(m => m.serverMsgId === msg.serverMsgId)) return prev;
          return [...prev, {
            serverMsgId: msg.serverMsgId,
            fromUserId: msg.fromUserId,
            senderNickname: msg.senderNickname,
            content: msg.content,
            createdAt: msg.createdAt,
            isSelf: false,
            status: 'sent',
          }];
        });
        setFriendNickname(msg.senderNickname);
      }

      else if (data.type === 'dm:error') {
        console.error('[ws] server error', data);
        if (data.code === 4001) {
          // 未鉴权，跳登录
          router.replace('/login');
        }
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      joinedRef.current = false;
      if (reconnectCount.current < 6) {
        setWsStatus('reconnecting');
        const delay = Math.min(1000 * 2 ** reconnectCount.current, 20000);
        reconnectCount.current++;
        reconnectTimerRef.current = setTimeout(() => wsConnect(userId), delay);
      } else {
        setWsStatus('error');
      }
    };

    ws.onerror = () => { /* onclose will handle */ };
  }, [convId, router]);

  useEffect(() => {
    if (!authReady || !user) return;
    wsConnect(user.id);
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [authReady, user, wsConnect]);

  // 滚底
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

  const handleSend = () => {
    const content = input.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !joinedRef.current) return;

    const clientMsgId = genClientMsgId();
    const optimistic: DmMessage = {
      clientMsgId,
      fromUserId: user!.id,
      senderNickname: user!.nickname,
      content,
      createdAt: Date.now(),
      isSelf: true,
      status: 'sending',
    };

    setMessages(prev => [...prev, optimistic]);
    setInput('');

    wsRef.current.send(JSON.stringify({
      type: 'dm:send',
      conversationId: convId,
      clientMsgId,
      content,
    }));

    // 5秒内未收到 ack 标为失败
    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.clientMsgId === clientMsgId && m.status === 'sending'
          ? { ...m, status: 'failed' }
          : m
      ));
    }, 5000);
  };

  // 重发失败消息
  const handleRetry = (msg: DmMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setMessages(prev => prev.map(m =>
      m.clientMsgId === msg.clientMsgId ? { ...m, status: 'sending' } : m
    ));
    wsRef.current.send(JSON.stringify({
      type: 'dm:send',
      conversationId: convId,
      clientMsgId: msg.clientMsgId,
      content: msg.content,
    }));
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
          <p className="text-xs flex items-center gap-1 mt-0.5">
            {wsStatus === 'open'         && <><Wifi size={11} className="text-green-500" /><span className="text-green-500">已连接</span></>}
            {wsStatus === 'connecting'   && <><Loader2 size={11} className="animate-spin text-gray-400" /><span className="text-gray-400">连接中…</span></>}
            {wsStatus === 'reconnecting' && <><WifiOff size={11} className="text-amber-500" /><span className="text-amber-500">重连中…</span></>}
            {wsStatus === 'error'        && (
              <>
                <WifiOff size={11} className="text-red-500" /><span className="text-red-500">连接失败</span>
                <button onClick={() => { reconnectCount.current = 0; wsConnect(user!.id); }}
                  className="ml-1 text-blue-500 text-xs underline">重试</button>
              </>
            )}
          </p>
        </div>
      </header>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
        {messages.length === 0 && wsStatus === 'open' && (
          <p className="text-center text-gray-400 text-sm py-16">还没有消息，发一条打招呼吧 👋</p>
        )}

        {messages.map((msg, i) => (
          <div key={msg.serverMsgId || msg.clientMsgId || i}
            className={`flex gap-2.5 ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
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
              <div className={`flex items-center gap-1.5 mt-1 ${msg.isSelf ? 'justify-end' : 'justify-start ml-1'}`}>
                <span className="text-xs text-gray-400">
                  {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.isSelf && msg.status === 'sending' && (
                  <Loader2 size={10} className="animate-spin text-gray-400" />
                )}
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
            placeholder={wsStatus === 'open' ? `给 ${friendNickname} 发消息…` : '连接中，请稍候…'}
            rows={1}
            disabled={wsStatus !== 'open'}
            className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder-gray-400 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200 focus:border-blue-400 focus:bg-white transition-colors disabled:opacity-50 overflow-hidden"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || wsStatus !== 'open'}
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
