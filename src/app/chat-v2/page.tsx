'use client';

import './styles.css';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { chatStorage, StoredSession, StoredMessage } from '@/lib/storage/chatStorage';
import SessionManager from '@/components/Chat/SessionManager';
import MessageActions from '@/components/Chat/MessageActions';
import {
  Send, StopCircle, Download, PenSquare,
  ChevronLeft, ChevronRight, MoreHorizontal
} from 'lucide-react';

export default function ChatV2Page() {
  const { isLoggedIn, user, checkAuth } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_INPUT_LENGTH = 2000;

  useEffect(() => {
    checkAuth().then(() => setIsCheckingAuth(false));
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

  // 自适应 textarea 高度
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
      id: `session_${Date.now()}`,
      title: '新对话',
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
  };

  const handleDeleteSession = (sid: string) => {
    chatStorage.deleteSession(sid);
    if (currentSessionId === sid) {
      const rem = chatStorage.getSessions();
      if (rem.length === 0) doCreateSession();
      else setCurrentSessionId(rem[0].id);
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
    const content = fmt === 'txt'
      ? chatStorage.exportSessionAsText(sid)
      : chatStorage.exportSessionAsMarkdown(sid);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `chat_${sid}.${fmt}`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleFavorite = (msgId: string) => {
    if (!currentSessionId) return;
    chatStorage.toggleMessageFavorite(currentSessionId, msgId);
    setMessages(chatStorage.getSessionMessages(currentSessionId));
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentSessionId) return;
    if (input.length > MAX_INPUT_LENGTH) { alert(`超过 ${MAX_INPUT_LENGTH} 字符限制`); return; }

    const content = input.trim();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const sessId = currentSessionId;

    const userMsg: StoredMessage = {
      id: `msg_${Date.now()}`,
      sessionId: sessId, role: 'user', content,
      createdAt: Date.now(), favorited: false, requestId,
    };
    chatStorage.saveMessage(userMsg);
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setInput('');
    setIsLoading(true);

    const aiMsgId = `msg_${Date.now() + 1}_ai`;
    setMessages([...withUser, {
      id: aiMsgId, sessionId: sessId, role: 'assistant', content: '',
      createdAt: Date.now() + 1, favorited: false, requestId,
    }]);

    let accumulated = '';
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content, sessionId: sessId,
          character: 'gentle', mode: 'companion',
          userId: user?.id, requestId,
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
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: snap } : m));
            } else if (ev.type === 'done') {
              chatStorage.saveMessage({
                id: aiMsgId, sessionId: sessId, role: 'assistant',
                content: accumulated, createdAt: Date.now(), favorited: false, requestId,
              });
              const list = chatStorage.getSessions();
              const cur = list.find(x => x.id === sessId);
              if (cur && cur.title === '新对话') {
                cur.title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
                cur.updatedAt = Date.now();
                chatStorage.saveSession(cur);
                setSessions(chatStorage.getSessions());
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('sendMessage error:', err);
        if (!accumulated) setMessages(prev => prev.filter(m => m.id !== aiMsgId));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="mt-3 text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden">

      {/* ===== 左侧深色侧边栏 ===== */}
      <div
        className={`${sidebarCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 flex flex-col bg-[#1C1C1E] transition-all duration-300 ease-in-out`}
      >
        {/* Logo + 折叠 */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                AI
              </div>
              <span className="text-white font-semibold text-sm">Chat 助手</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors ml-auto"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* 新建对话按钮 */}
        <div className="px-3 py-3">
          <button
            onClick={doCreateSession}
            className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
            title="新建对话"
          >
            <PenSquare size={16} />
            {!sidebarCollapsed && '新建对话'}
          </button>
        </div>

        {/* 会话列表区域 */}
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

        {sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto py-2">
            {sessions.slice(0, 10).map(s => (
              <button
                key={s.id}
                onClick={() => handleSessionSelect(s.id)}
                className={`w-full flex items-center justify-center py-2.5 hover:bg-white/10 transition-colors ${currentSessionId === s.id ? 'bg-white/15' : ''}`}
                title={s.title}
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-300 text-xs">
                  {s.title.slice(0, 1)}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 底部用户信息 */}
        <div className={`border-t border-white/10 px-3 py-3 flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
            {user?.nickname?.slice(0, 1)?.toUpperCase() || 'U'}
          </div>
          {!sidebarCollapsed && (
            <span className="text-gray-300 text-sm truncate flex-1">{user?.nickname || '用户'}</span>
          )}
        </div>
      </div>

      {/* ===== 右侧主聊天区域 ===== */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">

        {/* 顶栏 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h1 className="font-medium text-gray-900 text-base">
              {currentSession?.title || '新对话'}
            </h1>
            {currentSession?.pinned && (
              <span className="text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">已置顶</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => currentSessionId && handleExport(currentSessionId, 'md')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download size={15} />
              导出
            </button>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 select-none">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  AI
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-gray-800 mb-1">你好！我是 AI 助手</h2>
                  <p className="text-gray-500 text-sm">有什么我可以帮你的吗？</p>
                </div>
                {/* 建议问题 */}
                <div className="grid grid-cols-2 gap-3 mt-4 w-full max-w-md">
                  {['帮我写一首诗', '解释量子力学', '推荐几本好书', '帮我做个计划'].map(q => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="px-4 py-3 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 text-left transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => {
              const isUser = msg.role === 'user';
              const isEmpty = !msg.content && !isUser;

              return (
                <div key={msg.id} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {/* AI 头像 */}
                  {!isUser && (
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm mt-0.5">
                      AI
                    </div>
                  )}

                  <div className={`group relative ${isUser ? 'max-w-[70%]' : 'flex-1 min-w-0'}`}>
                    {isUser ? (
                      /* 用户消息气泡 */
                      <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ) : (
                      /* AI 消息：无气泡，直接文字 */
                      <div>
                        {isEmpty ? (
                          <div className="flex items-center gap-1.5 py-2">
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs text-gray-400 ml-1">正在思考...</span>
                          </div>
                        ) : (
                          <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        )}

                        {/* 底部操作栏 */}
                        {msg.content && (
                          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MessageActions
                              messageId={msg.id}
                              content={msg.content}
                              favorited={msg.favorited}
                              onToggleFavorite={() => handleToggleFavorite(msg.id)}
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

        {/* ===== 底部输入区域 ===== */}
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
                  <button
                    onClick={stopGeneration}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-medium transition-colors"
                  >
                    <StopCircle size={15} />
                    停止
                  </button>
                ) : (
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl transition-colors disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              Enter 发送 · Shift+Enter 换行
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
