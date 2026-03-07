'use client';

import './styles.css';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { useSearchParams } from 'next/navigation';
import { chatStorage, StoredSession, StoredMessage, Variant } from '@/lib/storage/chatStorage';
import SessionManager from '@/components/Chat/SessionManager';
import MessageActions from '@/components/Chat/MessageActions';
import FavoritesPanel from '@/components/Chat/FavoritesPanel';
import ShareDialog from '@/components/Chat/ShareDialog';
import FriendsDialog from '@/components/Chat/FriendsDialog';
import {
  Send, StopCircle, Download, PenSquare, Share2, Users,
  ChevronLeft, ChevronRight, Star, MoreHorizontal, User,
  ChevronRight as ArrowRight, ChevronLeft as ArrowLeft,
  X, Share,
} from 'lucide-react';

function ChatV2Inner() {
  const { isLoggedIn, user, checkAuth, logout } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [deepThinking, setDeepThinking] = useState(false);

  // 转发相关
  const [forwardContent, setForwardContent] = useState<string | null>(null);
  const [forwardFriends, setForwardFriends] = useState<{ id: string; nickname: string }[]>([]);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [forwardToast, setForwardToast] = useState('');

  const showForwardToast = (msg: string) => {
    setForwardToast(msg);
    setTimeout(() => setForwardToast(''), 2500);
  };

  const openForward = async (content: string) => {
    setForwardContent(content);
    // 拉好友列表
    if (!user?.id) return;
    try {
      const r = await fetch('/api/friends', { headers: { 'x-user-id': user.id } });
      const d = await r.json();
      if (d.success) setForwardFriends(d.data);
    } catch { /* ignore */ }
  };

  const doForward = async (friendId: string, friendNickname: string) => {
    if (!user?.id || !forwardContent || forwardLoading) return;
    setForwardLoading(true);
    try {
      // 获取/创建会话
      const cr = await fetch('/api/dm/conversations', {
        method: 'POST',
        headers: { 'x-user-id': user.id, 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });
      const cd = await cr.json();
      if (!cd.success) { showForwardToast('转发失败，请重试'); return; }
      // 发送消息
      const mr = await fetch(`/api/dm/conversations/${cd.data.conversationId}/messages`, {
        method: 'POST',
        headers: { 'x-user-id': user.id, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: forwardContent, type: 'text' }),
      });
      const md = await mr.json();
      if (md.success) {
        showForwardToast(`已转发给 ${friendNickname}`);
        setForwardContent(null);
      } else {
        showForwardToast('转发失败，请重试');
      }
    } catch {
      showForwardToast('网络错误，请重试');
    } finally {
      setForwardLoading(false);
    }
  };

  const searchParams = useSearchParams();
  const [input, setInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('prompt');
      return p ? decodeURIComponent(p) : '';
    }
    return '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 高亮定位消息
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const MAX_INPUT_LENGTH = 2000;

  const [userAvatar, setUserAvatar] = useState('');

  useEffect(() => { checkAuth().then(() => setIsCheckingAuth(false)); }, []);

  // 加载用户头像
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/user/profile?userId=${user.id}`)
      .then(r => r.json())
      .then(data => { if (data.success && data.data.avatar) setUserAvatar(data.data.avatar); })
      .catch(() => {});
  }, [user?.id]);

  // 多标签页同步：监听其他标签页的退出事件
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'auth_event' && e.newValue) {
        const evt = JSON.parse(e.newValue);
        if (evt.type === 'logout') window.location.href = '/login';
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    if (isCheckingAuth) return;
    if (!isLoggedIn) { window.location.href = '/login'; return; }
    loadSessions();
  }, [isLoggedIn, isCheckingAuth]);

  useEffect(() => {
    if (currentSessionId) {
      setMessages(chatStorage.getSessionMessages(currentSessionId));
      setTimeout(scrollToBottom, 100);
    }
  }, [currentSessionId]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const loadSessions = () => {
    const stored = chatStorage.getSessions();
    setSessions(stored);
    if (!currentSessionId) {
      if (stored.length === 0) doCreateSession();
      else setCurrentSessionId(stored[0].id);
    }
  };

  const doCreateSession = () => {
    const s: StoredSession = {
      id: `session_${Date.now()}`, title: '新对话', pinned: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    chatStorage.saveSession(s);
    setCurrentSessionId(s.id);
    setMessages([]);
    setSessions(chatStorage.getSessions());
    return s.id;
  };

  const handleSessionSelect = (sid: string) => {
    if (isLoading) stopGeneration();
    setCurrentSessionId(sid);
    setShowFavorites(false);
  };

  const handleDeleteSession = (sid: string) => {
    chatStorage.deleteSession(sid);
    if (currentSessionId === sid) {
      const rem = chatStorage.getSessions();
      if (rem.length === 0) doCreateSession(); else setCurrentSessionId(rem[0].id);
    }
    setSessions(chatStorage.getSessions());
  };

  const handleRenameSession = (sid: string, title: string) => {
    const list = chatStorage.getSessions();
    const s = list.find(x => x.id === sid);
    if (s) { s.title = title; s.updatedAt = Date.now(); chatStorage.saveSession(s); }
    setSessions(chatStorage.getSessions());
  };

  const handleTogglePin = (sid: string) => {
    chatStorage.toggleSessionPin(sid);
    setSessions(chatStorage.getSessions());
  };

  const handleExport = (sid: string, fmt: 'txt' | 'md') => {
    const content = fmt === 'txt' ? chatStorage.exportSessionAsText(sid) : chatStorage.exportSessionAsMarkdown(sid);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `chat_${sid}.${fmt}`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleFavorite = (messageId: string) => {
    if (!currentSessionId) return;
    chatStorage.toggleMessageFavorite(currentSessionId, messageId);
    setMessages(chatStorage.getSessionMessages(currentSessionId));
  };

  // 跳转到指定会话的指定消息并高亮
  const handleJumpToMessage = (sessionId: string, messageId: string) => {
    setShowFavorites(false);
    if (currentSessionId !== sessionId) {
      setCurrentSessionId(sessionId);
      // 等待消息加载后跳转
      setTimeout(() => scrollAndHighlight(messageId), 300);
    } else {
      scrollAndHighlight(messageId);
    }
  };

  const scrollAndHighlight = (messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(messageId);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  };

  // ---- 核心发送逻辑 ----
  const doStream = useCallback(async (
    messageContent: string,
    sessId: string,
    aiMsgId: string,
    variantId?: string,
    reasoningMode: 'normal' | 'deep' = 'normal',
  ) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let accumulated = '';
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent, sessionId: sessId,
          character: 'gentle', mode: 'companion',
          userId: user?.id, requestId,
          reasoningMode,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('响应体为空');

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const raw = t.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === 'content' && typeof ev.content === 'string') {
              accumulated += ev.content;
              const snap = accumulated;

              if (variantId) {
                // 重新生成模式：更新 variant
                chatStorage.updateVariantContent(sessId, aiMsgId, variantId, snap);
                setMessages(chatStorage.getSessionMessages(sessId));
              } else {
                // 普通模式
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: snap } : m));
              }
            } else if (ev.type === 'done') {
              if (variantId) {
                chatStorage.updateVariantContent(sessId, aiMsgId, variantId, accumulated, 'done');
              } else {
                chatStorage.saveMessage({
                  id: aiMsgId, sessionId: sessId, role: 'assistant',
                  content: accumulated, createdAt: Date.now(), favorited: false, requestId,
                });
              }
              setMessages(chatStorage.getSessionMessages(sessId));

              // 自动命名会话
              const list = chatStorage.getSessions();
              const cur = list.find(x => x.id === sessId);
              if (cur && cur.title === '新对话') {
                cur.title = messageContent.slice(0, 20) + (messageContent.length > 20 ? '...' : '');
                cur.updatedAt = Date.now();
                chatStorage.saveSession(cur);
                setSessions(chatStorage.getSessions());
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // 用户停止：标记当前 variant 为 cancelled
        if (variantId) {
          chatStorage.updateVariantContent(sessId, aiMsgId, variantId, accumulated, 'cancelled');
          setMessages(chatStorage.getSessionMessages(sessId));
        }
      } else {
        console.error('Stream error:', err);
        if (variantId) {
          chatStorage.updateVariantContent(sessId, aiMsgId, variantId, accumulated, 'error');
          setMessages(chatStorage.getSessionMessages(sessId));
        } else if (!accumulated) {
          setMessages(prev => prev.filter(m => m.id !== aiMsgId));
        }
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [user?.id]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentSessionId) return;
    if (input.length > MAX_INPUT_LENGTH) { alert(`超过 ${MAX_INPUT_LENGTH} 字符限制`); return; }

    const content = input.trim();
    const sessId = currentSessionId;
    const currentReasoningMode = deepThinking ? 'deep' : 'normal';

    const userMsg: StoredMessage = {
      id: `msg_${Date.now()}`, sessionId: sessId, role: 'user', content,
      createdAt: Date.now(), favorited: false,
    };
    chatStorage.saveMessage(userMsg);
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setInput('');
    setDeepThinking(false); // 单次生效后恢复

    const aiMsgId = `msg_${Date.now() + 1}_ai`;
    const aiPlaceholder: StoredMessage = {
      id: aiMsgId, sessionId: sessId, role: 'assistant', content: '',
      createdAt: Date.now() + 1, favorited: false,
      deepThinking: currentReasoningMode === 'deep',
    } as any;
    chatStorage.saveMessage(aiPlaceholder);
    setMessages([...withUser, aiPlaceholder]);

    await doStream(content, sessId, aiMsgId, undefined, currentReasoningMode);
  };

  // 重新生成指定 assistant 消息
  const handleRegenerate = async (msg: StoredMessage) => {
    if (isLoading || !currentSessionId) return;
    const sessId = currentSessionId;

    // 找到该消息前最后一条 user 消息作为上下文
    const msgIndex = messages.findIndex(m => m.id === msg.id);
    const prevUser = [...messages].slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (!prevUser) return;

    // 添加新 variant
    const variantId = chatStorage.addVariant(sessId, msg.id, `req_${Date.now()}`);
    if (!variantId) return;
    setMessages(chatStorage.getSessionMessages(sessId));

    await doStream(prevUser.content, sessId, msg.id, variantId);
  };

  // 切换版本
  const handleSwitchVariant = (msg: StoredMessage, variantId: string) => {
    if (!currentSessionId) return;
    chatStorage.switchVariant(currentSessionId, msg.id, variantId);
    setMessages(chatStorage.getSessionMessages(currentSessionId));
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1C1C1E]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden">

      {/* ===== 收藏悬浮弹窗 ===== */}
      {showFavorites && (
        <>
          {/* 遮罩 */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setShowFavorites(false)}
          />
          {/* 弹窗主体 */}
          <div
            className="fixed z-50 bg-white rounded-2xl overflow-hidden flex flex-col"
            style={{
              left: sidebarCollapsed ? 80 : 272,
              top: 64,
              width: 380,
              height: 'calc(100vh - 96px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 6px 20px rgba(0,0,0,0.10)',
            }}
          >
            <FavoritesPanel
              onJumpToMessage={handleJumpToMessage}
              onClose={() => setShowFavorites(false)}
            />
          </div>
        </>
      )}

      {/* ===== 分享弹窗 ===== */}
      {showShare && currentSessionId && (
        <ShareDialog
          sessionId={currentSessionId}
          sessionTitle={currentSession?.title || '新对话'}
          messages={messages}
          userId={user?.id}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* ===== 好友弹窗 ===== */}
      {showFriends && user && (
        <FriendsDialog userId={user.id} onClose={() => setShowFriends(false)} />
      )}

      {/* ===== 左侧深色侧边栏 ===== */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 flex flex-col bg-[#1C1C1E] transition-all duration-300`}>
        {/* Logo + 折叠 */}
        <div className={`flex items-center border-b border-white/10 px-3 py-4 ${sidebarCollapsed ? 'flex-col gap-2' : 'justify-between px-4'}`}>
          {!sidebarCollapsed ? (
            <a href="/" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" title="返回首页">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
              <span className="text-white font-semibold text-sm">Chat 助手</span>
            </a>
          ) : (
            <a href="/" title="返回首页" className="hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">AI</div>
            </a>
          )}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* 新建对话 */}
        <div className="px-3 py-3 space-y-1">
          <button
            onClick={doCreateSession}
            className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <PenSquare size={16} />
            {!sidebarCollapsed && '新建对话'}
          </button>

          {/* 收藏入口 */}
          {!sidebarCollapsed && (
            <button
              onClick={() => setShowFavorites(v => !v)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-colors ${
                showFavorites ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Star size={16} className={showFavorites ? 'fill-amber-400' : ''} />
              收藏
            </button>
          )}
        </div>

        {/* 会话列表：始终显示，不受收藏弹窗影响 */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <SessionManager
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSessionSelect={handleSessionSelect}
              onNewSession={doCreateSession}
              onDeleteSession={handleDeleteSession}
              onRenameSession={handleRenameSession}
              onTogglePin={handleTogglePin}
              onExport={handleExport}
            />
          </div>
        )}

        {/* 收藏面板已移到悬浮弹窗，此处不再内嵌 */}

        {/* 折叠时的图标列表 */}
        {sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto py-2">
            <button
              onClick={() => setShowFavorites(v => !v)}
              className={`w-full flex justify-center py-2.5 mb-1 ${showFavorites ? 'text-amber-400' : 'text-gray-500 hover:text-white'}`}
            >
              <Star size={18} className={showFavorites ? 'fill-amber-400' : ''} />
            </button>
            {sessions.slice(0, 8).map(s => (
              <button
                key={s.id}
                onClick={() => handleSessionSelect(s.id)}
                className={`w-full flex justify-center py-2.5 hover:bg-white/10 transition-colors ${currentSessionId === s.id ? 'bg-white/15' : ''}`}
                title={s.title}
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-300 text-xs">
                  {s.title.slice(0, 1)}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 用户信息 + 菜单 */}
        <div className={`border-t border-white/10 px-3 py-3 relative ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className={`flex items-center gap-2 w-full rounded-xl px-2 py-1.5 hover:bg-white/10 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
              {userAvatar
                ? <img src={userAvatar} alt="avatar" className="w-full h-full object-cover" />
                : (user?.nickname?.slice(0, 1)?.toUpperCase() || 'U')
              }
            </div>
            {!sidebarCollapsed && (
              <>
                <span className="text-gray-300 text-sm truncate flex-1 text-left">{user?.nickname || '用户'}</span>
                <MoreHorizontal size={16} className="text-gray-500 flex-shrink-0" />
              </>
            )}
          </button>

          {/* 用户下拉菜单 */}
          {showUserMenu && (
            <div className="absolute bottom-14 left-2 w-44 bg-[#2C2C2E] rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50">
              <a
                href="/profile"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors"
              >
                <User size={15} />个人中心
              </a>
              <div className="border-t border-white/10" />
              <button
                onClick={() => { setShowFriends(true); setShowUserMenu(false); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors"
              >
                <Users size={15} />好友
              </button>
              <div className="border-t border-white/10" />
              <button
                onClick={() => { logout(false); setShowUserMenu(false); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors"
              >
                <ArrowRight size={15} />切换账号
              </button>
              <button
                onClick={() => {
                  if (confirm('确定退出登录？退出后将清除本地会话数据。')) {
                    logout(true);
                  }
                  setShowUserMenu(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 transition-colors"
              >
                <X size={15} />退出登录
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== 主聊天区域 ===== */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <h1 className="font-medium text-gray-900 text-base">
            {currentSession?.title || '新对话'}
          </h1>
          <div className="flex items-center gap-1">
            {isLoggedIn && user && (
              <button
                onClick={() => setShowFriends(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
              >
                <Users size={15} />好友
              </button>
            )}
            <button
              onClick={() => setShowShare(true)}
              disabled={!currentSessionId || messages.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Share2 size={15} />分享
            </button>
            <button
              onClick={() => currentSessionId && handleExport(currentSessionId, 'md')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download size={15} />导出
            </button>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 select-none">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">AI</div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-gray-800 mb-1">你好！我是 AI 助手</h2>
                  <p className="text-gray-500 text-sm">有什么我可以帮你的吗？</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 w-full max-w-md">
                  {['帮我写一首诗', '解释量子力学', '推荐几本好书', '帮我做个计划'].map(q => (
                    <button key={q} onClick={() => setInput(q)}
                      className="px-4 py-3 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 text-left transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => {
              const isUser = msg.role === 'user';
              const isEmpty = !msg.content && !isUser;
              const variants = msg.variants || [];
              const activeVariantId = msg.activeVariantId;
              const activeVariant = variants.find(v => v.variantId === activeVariantId);
              const activeIdx = variants.findIndex(v => v.variantId === activeVariantId);
              const isStreaming = activeVariant?.status === 'streaming';
              const isLastAssistant = !isUser && msg.id === [...messages].reverse().find(m => m.role === 'assistant')?.id;

              return (
                <div
                  key={msg.id}
                  ref={el => { messageRefs.current[msg.id] = el; }}
                  className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} transition-all duration-300 ${
                    highlightedMsgId === msg.id ? 'bg-amber-50 rounded-2xl px-3 py-2 -mx-3' : ''
                  }`}
                >
                  {/* AI 头像 */}
                  {!isUser && (
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm mt-0.5">AI</div>
                  )}

                  <div className={`group relative ${isUser ? 'max-w-[70%]' : 'flex-1 min-w-0'}`}>
                    {isUser ? (
                      <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ) : (
                      <div>
                        {/* 深度思考标签 */}
                        {msg.deepThinking && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-600 text-xs font-medium rounded-full border border-violet-200">
                              🧠 深度思考
                            </span>
                          </div>
                        )}
                        {(isEmpty || isStreaming && !activeVariant?.content) ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs text-gray-400 ml-1">正在思考...</span>
                          </div>
                        ) : isStreaming ? (
                          // 重新生成中：显示当前已流式输出的内容 + 光标
                          <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                            {activeVariant?.content || msg.content}
                            <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 align-middle animate-pulse" />
                          </div>
                        ) : (
                          <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        )}

                        {/* 版本切换控件 */}
                        {variants.length > 1 && (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              disabled={activeIdx <= 0}
                              onClick={() => handleSwitchVariant(msg, variants[activeIdx - 1].variantId)}
                              className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                            >
                              <ArrowLeft size={14} />
                            </button>
                            <span className="text-xs text-gray-400">{activeIdx + 1} / {variants.length}</span>
                            <button
                              disabled={activeIdx >= variants.length - 1}
                              onClick={() => handleSwitchVariant(msg, variants[activeIdx + 1].variantId)}
                              className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                            >
                              <ArrowRight size={14} />
                            </button>
                            {activeVariant?.status === 'cancelled' && (
                              <span className="text-xs text-gray-400 ml-1">已停止</span>
                            )}
                            {activeVariant?.status === 'error' && (
                              <span className="text-xs text-red-400 ml-1">生成失败</span>
                            )}
                          </div>
                        )}

                        {/* 操作栏 */}
                        {msg.content && (
                          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MessageActions
                              messageId={msg.id}
                              content={msg.content}
                              favorited={msg.favorited}
                              onToggleFavorite={() => handleToggleFavorite(msg.id)}
                              onRegenerate={isLastAssistant ? () => handleRegenerate(msg) : undefined}
                              isRegenerating={isStreaming}
                              onForward={isLoggedIn ? () => openForward(msg.content) : undefined}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 用户头像 */}
                  {isUser && (
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white text-xs font-bold shadow-sm mt-0.5">
                      {user?.nickname?.slice(0, 1)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 输入区域 */}
        <div className="border-t border-gray-100 bg-white px-6 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-end gap-3 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3 focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-md transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="给 AI 助手发送消息..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-800 placeholder-gray-400 disabled:text-gray-400"
                  style={{ minHeight: '24px', maxHeight: '160px' }}
                />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs ${input.length > MAX_INPUT_LENGTH * 0.9 ? (input.length > MAX_INPUT_LENGTH ? 'text-red-500' : 'text-amber-500') : 'text-gray-300'}`}>
                    {input.length > 0 ? `${input.length}/${MAX_INPUT_LENGTH}` : ''}
                  </span>
                  {isLoading ? (
                    <button onClick={stopGeneration}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-medium transition-colors">
                      <StopCircle size={15} />停止
                    </button>
                  ) : (
                    <button onClick={sendMessage} disabled={!input.trim()}
                      className="w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl transition-colors disabled:cursor-not-allowed">
                      <Send size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                {/* 深度思考按钮 */}
                <button
                  onClick={() => setDeepThinking(v => !v)}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    deepThinking
                      ? 'bg-violet-100 text-violet-700 border border-violet-300 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className={`text-sm ${deepThinking ? 'animate-pulse' : ''}`}>🧠</span>
                  深度思考
                  {deepThinking && <span className="text-violet-500 font-semibold">·</span>}
                </button>
                <p className="text-xs text-gray-400">Enter 发送 · Shift+Enter 换行</p>
              </div>
            </div>
          </div>
      </div>

      {/* 转发 Toast */}
      {forwardToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white text-sm px-5 py-2.5 rounded-full shadow-xl z-[80] whitespace-nowrap">
          {forwardToast}
        </div>
      )}

      {/* 转发好友选择弹窗 */}
      {forwardContent !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setForwardContent(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">转发给好友</h2>
              <button onClick={() => setForwardContent(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>
            {/* 消息预览 */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs text-gray-400 mb-1">转发内容</p>
              <p className="text-sm text-gray-700 line-clamp-3">{forwardContent}</p>
            </div>
            {/* 好友列表 */}
            <div className="flex-1 overflow-y-auto max-h-72 p-3">
              {forwardFriends.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">暂无好友</p>
              ) : (
                forwardFriends.map(f => (
                  <button
                    key={f.id}
                    onClick={() => doForward(f.id, f.nickname)}
                    disabled={forwardLoading}
                    className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {f.nickname.slice(0, 1)}
                    </div>
                    <span className="font-medium text-gray-800 text-sm">{f.nickname}</span>
                    <span className="ml-auto text-xs text-blue-600">发送</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatV2Page() {
  return (
    <Suspense fallback={null}>
      <ChatV2Inner />
    </Suspense>
  );
}
