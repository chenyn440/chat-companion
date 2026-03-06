'use client';

import './styles.css';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { chatStorage, StoredSession, StoredMessage } from '@/lib/storage/chatStorage';
import SessionManager from '@/components/Chat/SessionManager';
import MessageActions from '@/components/Chat/MessageActions';
import { Send, StopCircle, Download, Menu, X, Star } from 'lucide-react';

export default function ChatV2Page() {
  const { isLoggedIn, user, checkAuth } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [showSessionManager, setShowSessionManager] = useState(true);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const MAX_INPUT_LENGTH = 2000;

  useEffect(() => {
    checkAuth().then(() => setIsCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (isCheckingAuth) return;
    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    loadSessions();
  }, [isLoggedIn, isCheckingAuth]);

  useEffect(() => {
    if (currentSessionId) {
      const stored = chatStorage.getSessionMessages(currentSessionId);
      setMessages(stored);
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [currentSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessions = () => {
    const stored = chatStorage.getSessions();
    setSessions(stored);
    if (!currentSessionId) {
      if (stored.length === 0) {
        doCreateSession();
      } else {
        setCurrentSessionId(stored[0].id);
      }
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
    const updated = chatStorage.getSessions();
    setSessions(updated);
    return s.id;
  };

  const handleSessionSelect = (sessionId: string) => {
    if (isLoading) stopGeneration();
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    chatStorage.deleteSession(sessionId);
    if (currentSessionId === sessionId) {
      const remaining = chatStorage.getSessions();
      if (remaining.length === 0) doCreateSession();
      else setCurrentSessionId(remaining[0].id);
    }
    setSessions(chatStorage.getSessions());
  };

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    const list = chatStorage.getSessions();
    const s = list.find(x => x.id === sessionId);
    if (s) {
      s.title = newTitle;
      s.updatedAt = Date.now();
      chatStorage.saveSession(s);
      setSessions(chatStorage.getSessions());
    }
  };

  const handleTogglePin = (sessionId: string) => {
    chatStorage.toggleSessionPin(sessionId);
    setSessions(chatStorage.getSessions());
  };

  const handleExport = (sessionId: string, format: 'txt' | 'md') => {
    const content = format === 'txt'
      ? chatStorage.exportSessionAsText(sessionId)
      : chatStorage.exportSessionAsMarkdown(sessionId);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${sessionId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleFavorite = (messageId: string) => {
    if (!currentSessionId) return;
    chatStorage.toggleMessageFavorite(currentSessionId, messageId);
    setMessages(chatStorage.getSessionMessages(currentSessionId));
  };

  // ---- 核心发送逻辑：原生 fetch + 手动解析 SSE ----
  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentSessionId) return;
    if (input.length > MAX_INPUT_LENGTH) {
      alert(`输入内容超过 ${MAX_INPUT_LENGTH} 字符限制`);
      return;
    }

    const messageContent = input.trim();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const sessId = currentSessionId; // 捕获闭包值

    // 保存用户消息
    const userMsg: StoredMessage = {
      id: `msg_${Date.now()}`,
      sessionId: sessId,
      role: 'user',
      content: messageContent,
      createdAt: Date.now(),
      favorited: false,
      requestId,
    };
    chatStorage.saveMessage(userMsg);
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setInput('');
    setIsLoading(true);

    // AI 占位消息
    const aiMsgId = `msg_${Date.now() + 1}_ai`;
    const aiPlaceholder: StoredMessage = {
      id: aiMsgId,
      sessionId: sessId,
      role: 'assistant',
      content: '',
      createdAt: Date.now() + 1,
      favorited: false,
      requestId,
    };
    setMessages([...withUser, aiPlaceholder]);

    let accumulated = '';
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          sessionId: sessId,
          character: 'gentle',
          mode: 'companion',
          userId: user?.id,
          requestId,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`请求失败: HTTP ${res.status}`);
      }
      if (!res.body) {
        throw new Error('响应体为空');
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      // eslint-disable-next-line no-constant-condition
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
              setMessages(prev =>
                prev.map(m => m.id === aiMsgId ? { ...m, content: snap } : m)
              );
            } else if (ev.type === 'done') {
              // 持久化完整 AI 消息
              const finalMsg: StoredMessage = {
                id: aiMsgId,
                sessionId: sessId,
                role: 'assistant',
                content: accumulated,
                createdAt: Date.now(),
                favorited: false,
                requestId,
              };
              chatStorage.saveMessage(finalMsg);

              // 自动命名会话
              const list = chatStorage.getSessions();
              const cur = list.find(x => x.id === sessId);
              if (cur && cur.title === '新对话') {
                cur.title = messageContent.slice(0, 20) + (messageContent.length > 20 ? '...' : '');
                cur.updatedAt = Date.now();
                chatStorage.saveSession(cur);
                setSessions(chatStorage.getSessions());
              }
            } else if (ev.type === 'error') {
              console.error('Server stream error:', ev.error);
            }
          } catch {
            // 单条解析失败，跳过
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // 用户手动停止，正常
      } else {
        console.error('sendMessage error:', err);
        if (!accumulated) {
          // 没有任何回复时清理占位
          setMessages(prev => prev.filter(m => m.id !== aiMsgId));
        }
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 侧边栏 */}
      <div
        className={`${showSessionManager ? 'w-72' : 'w-0'} flex-shrink-0 transition-all duration-300 overflow-hidden bg-white shadow-md`}
      >
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

      {/* 主区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-5 py-3 bg-white shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSessionManager(v => !v)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              {showSessionManager ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <h1 className="font-semibold text-gray-800 text-base leading-tight">
                {currentSession?.title || '新对话'}
              </h1>
              <p className="text-xs text-gray-400">AI 助手</p>
            </div>
          </div>
          <button
            onClick={() => currentSessionId && handleExport(currentSessionId, 'md')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="导出 Markdown"
          >
            <Download size={16} />
            导出
          </button>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 select-none">
              <span className="text-5xl">💬</span>
              <p className="text-base font-medium">开始新对话吧</p>
              <p className="text-sm">AI 助手随时为你服务</p>
            </div>
          )}

          {messages.map(msg => {
            const isUser = msg.role === 'user';
            const isEmpty = !msg.content && !isUser;

            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`group relative max-w-[75%] ${isUser ? '' : 'flex gap-2'}`}>
                  {/* AI 头像 */}
                  {!isUser && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm mt-1">
                      AI
                    </div>
                  )}

                  <div>
                    {/* 气泡 */}
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-sm shadow-sm'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      {isEmpty ? (
                        <div className="flex gap-1 py-0.5">
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* 收藏标记 */}
                    {msg.favorited && !isUser && (
                      <div className="flex items-center gap-1 mt-1 ml-1 text-xs text-amber-500">
                        <Star size={11} className="fill-amber-400" />
                        已收藏
                      </div>
                    )}
                  </div>

                  {/* 操作按钮（AI 消息悬停显示） */}
                  {!isUser && msg.content && (
                    <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MessageActions
                        messageId={msg.id}
                        content={msg.content}
                        favorited={msg.favorited}
                        onToggleFavorite={() => handleToggleFavorite(msg.id)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入栏 */}
        <div className="bg-white border-t px-5 py-4 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息…（Enter 发送，Shift+Enter 换行）"
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
              style={{ minHeight: '48px', maxHeight: '140px' }}
            />
            {isLoading ? (
              <button
                onClick={stopGeneration}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                <StopCircle size={18} />
                停止
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-medium transition-colors shadow-sm disabled:cursor-not-allowed"
              >
                <Send size={18} />
                发送
              </button>
            )}
          </div>
          <div className="flex justify-end mt-2">
            <span className={`text-xs ${input.length > MAX_INPUT_LENGTH ? 'text-red-500' : 'text-gray-400'}`}>
              {input.length} / {MAX_INPUT_LENGTH}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
