'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import {
  Send, ArrowLeft, Loader2, WifiOff, RefreshCw,
  Smile, Paperclip, Phone, Video, MoreHorizontal,
  Search, UserPlus, X,
} from 'lucide-react';
import CallModal from '@/components/Chat/CallModal';

// 常用 emoji
const EMOJI_LIST = [
  '😀','😂','🥰','😍','🤩','😎','🥳','😅','😭','😤',
  '🤔','😏','🙄','😴','🤯','🥺','😬','🤗','🙃','😇',
  '👍','👎','👏','🙌','🤝','💪','🤞','✌️','🫶','❤️',
  '🔥','✨','💯','🎉','🎊','🎁','🎈','🌟','💥','💫',
  '🐶','🐱','🐼','🐨','🦊','🐸','🦋','🌸','🍀','🌈',
  '🍕','🍔','🍜','🍣','🍦','🎂','🍵','☕','🥤','🍺',
];

interface DmMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  type?: 'text' | 'image';
  createdAt: number;
  isSelf: boolean;
  status?: 'sending' | 'sent' | 'failed';
}

interface ConvItem {
  conversationId: string;
  friend: { id: string; nickname: string; avatar?: string };
  lastMessage: string;
  updatedAt: number;
}

// 头像组件：优先显示图片
function Avatar({ name, size = 32, gradient = 'from-blue-500 to-violet-600', avatar }: {
  name: string; size?: number; gradient?: string; avatar?: string;
}) {
  return (
    <div
      className={`rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-medium flex-shrink-0 overflow-hidden`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {avatar
        ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
        : name.slice(0, 1)
      }
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export default function DmPageClient({ convId: initConvId }: { convId: string }) {
  const router = useRouter();
  const { user, checkAuth } = useAuthStore();
  const [authReady, setAuthReady] = useState(false);

  const [convList, setConvList] = useState<ConvItem[]>([]);
  const [convSearch, setConvSearch] = useState('');
  const [activeConvId, setActiveConvId] = useState(initConvId);

  // 当前会话消息
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [pollError, setPollError] = useState(false);

  // emoji & 图片
  const [showEmoji, setShowEmoji] = useState(false);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 通话
  const [showCallModal, setShowCallModal] = useState(false);
  const [pendingCall, setPendingCall] = useState<'audio' | 'video' | null>(null);
  const [callFriend, setCallFriend] = useState<{ id: string; nickname: string } | null>(null);
  const incomingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const incomingAfterRef = useRef(Date.now());

  // 移动端
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [showMobileConvList, setShowMobileConvList] = useState(false);
  const [userAvatar, setUserAvatar] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => { checkAuth().then(() => setAuthReady(true)); }, []);

  // 加载自己的头像
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/user/profile?userId=${user.id}`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data.avatar) setUserAvatar(d.data.avatar); })
      .catch(() => {});
  }, [user?.id]);

  // 点击外部关闭 emoji 面板
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiPanelRef.current && !emojiPanelRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 插入 emoji 到光标位置
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) { setInput(prev => prev + emoji); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = input.slice(0, start) + emoji + input.slice(end);
    setInput(newVal);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    }, 0);
    setShowEmoji(false);
  };

  // 粘贴图片
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setPastedImage(ev.target?.result as string);
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  // 选择图片文件
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('图片不能超过 10MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPastedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 发送图片
  const handleSendImage = async (base64: string) => {
    if (!user || sendingImage) return;
    setPastedImage(null);
    setSendingImage(true);
    try {
      const r = await fetch(`/api/dm/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'x-user-id': user.id, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: base64, type: 'image' }),
      });
      const d = await r.json();
      if (d.success) {
        setMessages(prev => [...prev, { ...d.data, isSelf: true, status: 'sent' as const, senderNickname: user.nickname }]);
        lastTsRef.current = d.data.createdAt;
        setConvList(prev => prev.map(c =>
          c.conversationId === activeConvId ? { ...c, lastMessage: '[图片]', updatedAt: Date.now() } : c
        ));
      }
    } catch { /* ignore */ }
    finally { setSendingImage(false); }
  };

  // 加载会话列表
  const loadConvList = useCallback(async (userId: string) => {
    try {
      const r = await fetch('/api/dm/conversations', { headers: { 'x-user-id': userId } });
      const d = await r.json();
      if (d.success) setConvList(d.data);
    } catch { /* ignore */ }
  }, []);

  // 拉取消息（增量）
  const fetchMessages = useCallback(async (userId: string, convId: string, since = 0) => {
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
            return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
          });
          lastTsRef.current = newMsgs[newMsgs.length - 1].createdAt;
        }
      } else { setPollError(true); }
    } catch { setPollError(true); }
  }, []);

  // 切换/初始化会话
  const switchConv = useCallback(async (userId: string, convId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setLoading(true);
    setMessages([]);
    lastTsRef.current = 0;
    setPollError(false);
    setActiveConvId(convId);

    await fetchMessages(userId, convId, 0);
    setLoading(false);

    pollTimerRef.current = setInterval(() => {
      fetchMessages(userId, convId, lastTsRef.current);
    }, 3000);
  }, [fetchMessages]);

  useEffect(() => {
    if (!authReady || !user) return;
    loadConvList(user.id);
    switchConv(user.id, initConvId);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [authReady, user]);

  // 来电监听（当 CallModal 未显示时轮询）
  useEffect(() => {
    if (!authReady || !user || showCallModal) return;
    incomingAfterRef.current = Date.now() - 2000;
    incomingPollRef.current = setInterval(async () => {
      try {
        const r = await fetch(
          `/api/dm/call?conversationId=${activeConvId}&after=${incomingAfterRef.current}`,
          { headers: { 'x-user-id': user.id } }
        );
        const d = await r.json();
        if (d.success && d.data.length > 0) {
          incomingAfterRef.current = d.data[d.data.length - 1].createdAt;
          const offer = d.data.find((s: any) => s.type === 'offer');
          if (offer && activeConv) {
            setCallFriend(activeConv.friend);
            setShowCallModal(true);
          }
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => { if (incomingPollRef.current) clearInterval(incomingPollRef.current); };
  }, [authReady, user, activeConvId, showCallModal]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const doSend = async (content: string, tempId: string, convId: string) => {
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
        // 更新会话列表 lastMessage
        setConvList(prev => prev.map(c =>
          c.conversationId === convId
            ? { ...c, lastMessage: content.slice(0, 50), updatedAt: Date.now() }
            : c
        ));
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
    doSend(content, tempId, activeConvId);
  };

  const handleRetry = (msg: DmMessage) => {
    if (!user || sendingRef.current) return;
    sendingRef.current = true;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sending' } : m));
    doSend(msg.content, msg.id, activeConvId);
  };

  const activeConv = convList.find(c => c.conversationId === activeConvId);
  const displayName = activeConv?.friend.nickname || '私信';

  const filteredConvs = convSearch
    ? convList.filter(c => c.friend.nickname.includes(convSearch))
    : convList;

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 size={22} className="animate-spin text-gray-300" />
      </div>
    );
  }
  if (authReady && !user) { router.replace('/login'); return null; }

  return (
    <>
    <div className="flex h-screen bg-white" style={{ fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' }}>

      {/* ═══ 移动端：会话列表抽屉 ═══ */}
      {showMobileConvList && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowMobileConvList(false)} />
          <div className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#F7F8FA] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 bg-white">
              <span className="font-semibold text-gray-800 text-[15px]">消息</span>
              <button onClick={() => setShowMobileConvList(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-200">
                <Search size={13} className="text-gray-400 flex-shrink-0" />
                <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="搜索好友"
                  className="flex-1 text-[13px] text-gray-700 outline-none bg-transparent placeholder-gray-400" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredConvs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-sm gap-2">
                  <UserPlus size={28} className="text-gray-200" /><span>还没有私信</span>
                </div>
              )}
              {filteredConvs.map(conv => (
                <button key={conv.conversationId}
                  onClick={() => { user && switchConv(user.id, conv.conversationId); setShowMobileConvList(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-200 transition-colors ${activeConvId === conv.conversationId ? 'bg-white border-r-2 border-blue-500' : ''}`}
                >
                  <Avatar name={conv.friend.nickname} size={36} gradient="from-blue-400 to-violet-500" avatar={conv.friend.avatar} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-gray-800 truncate">{conv.friend.nickname}</span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0 ml-1">{formatTime(conv.updatedAt)}</span>
                    </div>
                    <p className="text-[12px] text-gray-400 truncate mt-0.5">{conv.lastMessage || '暂无消息'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══ 移动端：更多 Action Sheet ═══ */}
      {showMobileMore && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowMobileMore(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-2" />
            {[
              { icon: <Phone size={18} className="text-blue-500" />, label: '语音通话', action: () => { if (activeConv) { setCallFriend(activeConv.friend); setPendingCall('audio'); setShowCallModal(true); } setShowMobileMore(false); } },
              { icon: <Video size={18} className="text-violet-500" />, label: '视频通话', action: () => { if (activeConv) { setCallFriend(activeConv.friend); setPendingCall('video'); setShowCallModal(true); } setShowMobileMore(false); } },
            ].map(item => (
              <button key={item.label} onClick={item.action}
                className="flex items-center gap-3 w-full px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50">
                {item.icon}<span className="text-[15px] text-gray-800">{item.label}</span>
              </button>
            ))}
            <button onClick={() => setShowMobileMore(false)} className="flex items-center justify-center w-full py-4 text-gray-400 text-sm">取消</button>
          </div>
        </>
      )}

      {/* ═══ 左侧：会话列表（PC 专用） ═══ */}
      <div className="hidden md:flex w-64 flex-shrink-0 border-r border-gray-100 flex-col bg-[#F7F8FA]">
        {/* 左侧顶栏 */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-[15px]">消息</span>
          <button onClick={() => router.push('/chat-v2')}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition-colors" title="返回">
            <ArrowLeft size={16} />
          </button>
        </div>

        {/* 搜索 */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-200">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="搜索好友"
              className="flex-1 text-[13px] text-gray-700 outline-none bg-transparent placeholder-gray-400" />
          </div>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-sm gap-2">
              <UserPlus size={28} className="text-gray-200" /><span>还没有私信</span>
            </div>
          )}
          {filteredConvs.map(conv => (
            <button key={conv.conversationId}
              onClick={() => user && switchConv(user.id, conv.conversationId)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-200 transition-colors ${activeConvId === conv.conversationId ? 'bg-white border-r-2 border-blue-500' : ''}`}
            >
              <Avatar name={conv.friend.nickname} size={36} gradient="from-blue-400 to-violet-500" avatar={conv.friend.avatar} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-gray-800 truncate">{conv.friend.nickname}</span>
                  <span className="text-[11px] text-gray-400 flex-shrink-0 ml-1">{formatTime(conv.updatedAt)}</span>
                </div>
                <p className="text-[12px] text-gray-400 truncate mt-0.5">{conv.lastMessage || '暂无消息'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ 右侧：聊天区 ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 移动端 Header */}
        <header className="flex md:hidden items-center justify-between px-3 h-14 border-b border-gray-100 bg-white flex-shrink-0">
          <button onClick={() => setShowMobileConvList(true)} className="p-2 -ml-1 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {activeConv && <Avatar name={displayName} size={28} gradient="from-blue-500 to-violet-500" avatar={activeConv.friend.avatar} />}
            <h1 className="font-semibold text-gray-900 text-[15px] truncate max-w-[45vw]">{displayName}</h1>
          </div>
          <button onClick={() => setShowMobileMore(true)} className="p-2 -mr-1 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </header>

        {/* PC 端顶栏 */}
        <header className="hidden md:flex items-center justify-between px-5 h-14 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {activeConv && <Avatar name={displayName} size={32} gradient="from-blue-500 to-violet-500" avatar={activeConv.friend.avatar} />}
            <div>
              <h1 className="font-medium text-gray-900 text-[15px] leading-tight">{displayName}</h1>
              <p className="text-[11px] leading-tight">
                {pollError
                  ? <span className="text-amber-500 flex items-center gap-0.5">
                      <WifiOff size={9} />同步中断
                      <button onClick={() => user && fetchMessages(user.id, activeConvId, lastTsRef.current)}
                        className="ml-0.5 text-blue-500"><RefreshCw size={9} /></button>
                    </span>
                  : <span className="text-gray-400">3秒同步</span>
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 text-gray-400">
            <button
              onClick={() => { if (activeConv) { setCallFriend(activeConv.friend); setPendingCall('audio'); setShowCallModal(true); } }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              title="语音通话"
            ><Phone size={16} /></button>
            <button
              onClick={() => { if (activeConv) { setCallFriend(activeConv.friend); setPendingCall('video'); setShowCallModal(true); } }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              title="视频通话"
            ><Video size={16} /></button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"><MoreHorizontal size={16} /></button>
          </div>
        </header>

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto bg-[#F7F8FA] px-3 md:px-6 py-4 space-y-1">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          )}
          {!loading && messages.length === 0 && (
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
            const isContinue = prev &&
              prev.senderId === msg.senderId &&
              msg.createdAt - prev.createdAt < 2 * 60 * 1000;

            // 时间分割线（超过5分钟显示）
            const showTimeDivider = !prev || msg.createdAt - prev.createdAt > 5 * 60 * 1000;

            return (
              <div key={msg.id || i}>
                {showTimeDivider && (
                  <div className="flex items-center justify-center py-2">
                    <span className="text-[11px] text-gray-400 bg-gray-200/60 rounded-full px-3 py-0.5">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div className={`flex ${msg.isSelf ? 'flex-row-reverse' : 'flex-row'} items-end gap-2.5 ${isContinue ? 'mt-0.5' : 'mt-3'}`}>
                  <div className="flex-shrink-0 w-8" style={{ alignSelf: 'flex-start', marginTop: isContinue ? 0 : 2 }}>
                    {!isContinue && (
                      <Avatar
                        name={msg.senderNickname}
                        size={32}
                        gradient={msg.isSelf ? 'from-pink-500 to-orange-400' : 'from-blue-500 to-violet-500'}
                        avatar={msg.isSelf ? userAvatar : activeConv?.friend.avatar}
                      />
                    )}
                  </div>
                  <div className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'} max-w-[80%] md:max-w-[65%]`}>
                    {!isContinue && !msg.isSelf && (
                      <span className="text-[11px] text-gray-400 mb-1 ml-0.5">{msg.senderNickname}</span>
                    )}
                    <div className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed break-words select-text cursor-text ${
                      msg.isSelf
                        ? msg.status === 'failed'
                          ? 'bg-red-100 text-red-700 rounded-br-sm'
                          : 'bg-[#3272F6] text-white rounded-br-sm'
                        : 'bg-white text-gray-800 rounded-bl-sm shadow-[0_1px_3px_rgba(0,0,0,0.07)] border border-gray-100/80'
                    }`}>
                      {msg.type === 'image' ? (
                        <img
                          src={msg.content}
                          alt="图片"
                          className="max-w-full max-h-48 rounded-lg object-contain cursor-pointer"
                          onClick={() => setLightboxImg(msg.content)}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    <div className={`flex items-center gap-1.5 mt-0.5 px-0.5 ${msg.isSelf ? 'flex-row-reverse' : ''}`}>
                      {!showTimeDivider && (
                        <span className="text-[11px] text-gray-400">
                          {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {msg.isSelf && msg.status === 'sending' && <Loader2 size={10} className="animate-spin text-gray-400" />}
                      {msg.isSelf && msg.status === 'failed' && (
                        <button onClick={() => handleRetry(msg)} className="text-[11px] text-red-500 hover:underline flex items-center gap-0.5">
                          <RefreshCw size={9} />重发
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="bg-white border-t border-gray-100 flex-shrink-0">
          {/* 图片预览 */}
          {pastedImage && (
            <div className="px-4 pt-3 flex items-end gap-3 border-b border-gray-100 pb-3">
              <img src={pastedImage} alt="预览" className="h-20 rounded-lg object-contain border border-gray-200" />
              <div className="flex gap-2">
                <button
                  onClick={() => setPastedImage(null)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200"
                >取消</button>
                <button
                  onClick={() => handleSendImage(pastedImage)}
                  disabled={sendingImage}
                  className="px-3 py-1.5 text-xs text-white bg-[#3272F6] hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-1"
                >
                  {sendingImage ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  发送图片
                </button>
              </div>
            </div>
          )}

          {/* 工具栏 */}
          <div className="flex items-center gap-0.5 px-4 pt-2.5 text-gray-400 relative" ref={emojiPanelRef}>
            <button
              onClick={() => setShowEmoji(v => !v)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showEmoji ? 'bg-blue-50 text-blue-500' : 'hover:bg-gray-100'}`}
            >
              <Smile size={16} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              title="发送图片"
            >
              <Paperclip size={16} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

            {/* Emoji 面板 */}
            {showEmoji && (
              <div className="absolute bottom-10 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-20 w-72">
                <div className="grid grid-cols-10 gap-0.5">
                  {EMOJI_LIST.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="text-xl hover:bg-gray-100 rounded-lg p-0.5 transition-colors leading-none"
                    >{emoji}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 px-3 md:px-4 pb-4 pt-1.5">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              onPaste={handlePaste}
              placeholder={`发消息给 ${displayName}…`}
              rows={1}
              className="flex-1 resize-none outline-none text-[14px] text-gray-800 placeholder-gray-400 leading-relaxed overflow-hidden bg-transparent"
              style={{ minHeight: '22px', maxHeight: '160px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors mb-0.5 ${
                input.trim() ? 'bg-[#3272F6] hover:bg-blue-700 text-white' : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              <Send size={15} />
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-300 pb-3 -mt-2">Enter 发送 · Shift+Enter 换行 · 支持粘贴图片</p>
        </div>
      </div>
    </div>

      {/* 图片灯箱 */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxImg(null)}
        >
          <img
            src={lightboxImg}
            alt="查看图片"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2"
            onClick={() => setLightboxImg(null)}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* 通话弹窗 */}
      {showCallModal && user && callFriend && (
        <CallModal
          userId={user.id}
          conversationId={activeConvId}
          friend={callFriend}
          initiateCall={pendingCall}
          onCallInitiated={() => setPendingCall(null)}
          onClose={() => { setShowCallModal(false); setPendingCall(null); setCallFriend(null); }}
        />
      )}
    </>
  );
}
