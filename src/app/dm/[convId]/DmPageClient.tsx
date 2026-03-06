'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import {
  Send, ArrowLeft, Loader2, WifiOff, RefreshCw,
  Smile, Paperclip, Phone, Video, MoreHorizontal,
} from 'lucide-react';

interface DmMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  createdAt: number;
  isSelf: boolean;
  status?: 'sending' | 'sent' | 'failed';
}

function Avatar({ name, size = 32, gradient = 'from-blue-500 to-violet-600' }: {
  name: string; size?: number; gradient?: string;
}) {
  return (
    <div
      className={`rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-medium flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function DmPageClient({ convId }: { convId: string }) {
  const router = useRouter();
  const { user, checkAuth } = useAuthStore();
  const [authReady, setAuthReady] = useState(false);
  const [friendNickname, setFriendNickname] = useState('');
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [pollError, setPollError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => { checkAuth().then(() => setAuthReady(true)); }, []);

  const fetchMessages = useCallback(async (userId: string, since = 0) => {
    try {
      const url = `/api/dm/conversations/${convId}/messages${since ? `?after=${since}` : ''}`;
      const r = await fetch(url, { headers: { 'x-user-id': userId } });
      const d = await r.json();
      if (d.success) {
        setPollError(false);
        const newMsgs: DmMessage[] = d.data.map((m: any) => ({
          ...m, isSelf: m.senderId === userId, status: 'sent' as const,
        }));
        if (newMsgs.length > 0) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const fresh = newMsgs.filter(m => !ids.has(m.id));
            const other = fresh.find(m => !m.isSelf);
            if (other) setFriendNickname(other.senderNickname);
            return [...prev, ...fresh];
          });
          lastTsRef.current = newMsgs[newMsgs.length - 1].createdAt;
        }
      } else { setPollError(true); }
    } catch { setPollError(true); }
  }, [convId]);

  useEffect(() => {
    if (!authReady || !user) return;
    fetchMessages(user.id, 0).finally(() => setLoading(false));
    pollTimerRef.current = setInterval(() => fetchMessages(user.id, lastTsRef.current), 3000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [authReady, user, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const doSend = async (content: string, tempId: string) => {
    if (!user) return;
    try {
      const r = await fetch(`/api/dm/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'x-user-id': user.id, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const d = await r.json();
      if (d.success) {
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...d.data, isSelf: true, status: 'sent' as const } : m
        ));
        lastTsRef.current = d.data.createdAt;
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m));
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m));
    } finally { sendingRef.current = false; }
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content || !user || sendingRef.current) return;
    sendingRef.current = true;
    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId, senderId: user.id, senderNickname: user.nickname,
      content, createdAt: Date.now(), isSelf: true, status: 'sending',
    }]);
    setInput('');
    doSend(content, tempId);
  };

  const handleRetry = (msg: DmMessage) => {
    if (!user || sendingRef.current) return;
    sendingRef.current = true;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sending' } : m));
    doSend(msg.content, msg.id);
  };

  if (!authReady || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 size={22} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (authReady && !user) { router.replace('/login'); return null; }

  const displayName = friendNickname || '私信';

  return (
    <div className="flex flex-col h-screen bg-white select-none" style={{ fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' }}>

      {/* ── 顶栏（飞书风格） ── */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-gray-100 bg-white flex-shrink-0">
        {/* 左侧：返回 + 头像 + 名字 */}
        <div className="flex items-center gap-2.5">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors mr-1">
            <ArrowLeft size={18} />
          </button>
          <Avatar name={displayName} size={34} gradient="from-blue-500 to-violet-500" />
          <div>
            <h1 className="font-medium text-gray-900 text-[15px] leading-tight">{displayName}</h1>
            <p className="text-[11px] leading-tight flex items-center gap-1">
              {pollError
                ? <span className="text-amber-500 flex items-center gap-0.5">
                    <WifiOff size={9} />同步中断
                    <button onClick={() => user && fetchMessages(user.id, lastTsRef.current)}
                      className="ml-0.5 text-blue-500 flex items-center gap-0.5"><RefreshCw size={9} />重试</button>
                  </span>
                : <span className="text-gray-400">3秒同步</span>
              }
            </p>
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-1 text-gray-400">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors" title="语音通话（敬请期待）">
            <Phone size={17} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors" title="视频通话（敬请期待）">
            <Video size={17} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <MoreHorizontal size={17} />
          </button>
        </div>
      </header>

      {/* ── 消息列表 ── */}
      <div className="flex-1 overflow-y-auto bg-[#F7F8FA] px-6 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-sm">
              {displayName.slice(0, 1)}
            </div>
            <p className="text-gray-500 font-medium">{displayName}</p>
            <p className="text-gray-400 text-sm mt-1">发一条消息开始对话吧</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          // 相邻同一发送者且时间差 < 2 分钟，折叠头像和昵称
          const isContinue = prev &&
            prev.senderId === msg.senderId &&
            msg.createdAt - prev.createdAt < 2 * 60 * 1000;

          return (
            <div key={msg.id || i}
              className={`flex ${msg.isSelf ? 'flex-row-reverse' : 'flex-row'} items-end gap-2.5 ${isContinue ? 'mt-0.5' : 'mt-4'}`}>

              {/* 头像（连续消息折叠） */}
              <div className="flex-shrink-0 w-8" style={{ alignSelf: 'flex-start', marginTop: isContinue ? 0 : 4 }}>
                {!isContinue && (
                  <Avatar
                    name={msg.senderNickname}
                    size={32}
                    gradient={msg.isSelf ? 'from-pink-500 to-orange-400' : 'from-blue-500 to-violet-500'}
                  />
                )}
              </div>

              {/* 消息体 */}
              <div className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'} max-w-[65%]`}>
                {/* 昵称（非连续时展示） */}
                {!isContinue && !msg.isSelf && (
                  <span className="text-xs text-gray-400 mb-1 ml-0.5">{msg.senderNickname}</span>
                )}

                {/* 气泡 */}
                <div className={`relative px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed break-words select-text cursor-text ${
                  msg.isSelf
                    ? msg.status === 'failed'
                      ? 'bg-red-100 text-red-700 rounded-br-sm'
                      : 'bg-[#3272F6] text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-100'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* 时间 + 状态 */}
                <div className={`flex items-center gap-1.5 mt-1 px-0.5 ${msg.isSelf ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[11px] text-gray-400">{formatTime(msg.createdAt)}</span>
                  {msg.isSelf && msg.status === 'sending' && <Loader2 size={10} className="animate-spin text-gray-400" />}
                  {msg.isSelf && msg.status === 'failed' && (
                    <button onClick={() => handleRetry(msg)}
                      className="text-[11px] text-red-500 hover:underline flex items-center gap-0.5">
                      <RefreshCw size={10} />发送失败，点击重发
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── 输入区（飞书风格） ── */}
      <div className="bg-white border-t border-gray-100 flex-shrink-0">
        {/* 工具栏 */}
        <div className="flex items-center gap-0.5 px-4 pt-2.5 text-gray-400">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors" title="表情">
            <Smile size={17} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors" title="文件（敬请期待）">
            <Paperclip size={17} />
          </button>
        </div>

        {/* 文本输入 + 发送 */}
        <div className="flex items-end gap-2 px-4 pb-4 pt-1.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={`发消息给 ${displayName}…`}
            rows={1}
            className="flex-1 resize-none outline-none text-[14px] text-gray-800 placeholder-gray-400 leading-relaxed overflow-hidden"
            style={{ minHeight: '22px', maxHeight: '160px', background: 'transparent' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors mb-0.5 ${
              input.trim()
                ? 'bg-[#3272F6] hover:bg-blue-700 text-white'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <Send size={15} />
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-300 pb-3 -mt-2">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </div>
  );
}
