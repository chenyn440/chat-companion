'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useAuthStore } from '@/lib/store/authStore';
import { chatStorage, StoredSession, StoredMessage } from '@/lib/storage/chatStorage';
import SessionManager from '@/components/Chat/SessionManager';
import MessageActions from '@/components/Chat/MessageActions';
import { Send, StopCircle, Download, Menu, X } from 'lucide-react';

export default function ChatV2Page() {
  const { isLoggedIn, user, checkAuth } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // 会话相关
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [showSessionManager, setShowSessionManager] = useState(true);
  
  // 输入相关
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const MAX_INPUT_LENGTH = 2000;

  // 初始化
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

  // 加载会话列表
  const loadSessions = () => {
    const storedSessions = chatStorage.getSessions();
    setSessions(storedSessions);
    
    // 如果没有当前会话，创建一个新的
    if (!currentSessionId && storedSessions.length === 0) {
      createNewSession();
    } else if (!currentSessionId && storedSessions.length > 0) {
      setCurrentSessionId(storedSessions[0].id);
    }
  };

  // 加载会话消息
  useEffect(() => {
    if (currentSessionId) {
      const storedMessages = chatStorage.getSessionMessages(currentSessionId);
      setMessages(storedMessages);
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [currentSessionId]);

  // 自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 创建新会话
  const createNewSession = () => {
    const newSession: StoredSession = {
      id: `session_${Date.now()}`,
      title: '新对话',
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    chatStorage.saveSession(newSession);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    loadSessions();
  };

  // 切换会话
  const handleSessionSelect = (sessionId: string) => {
    // 如果正在生成，先停止
    if (isLoading) {
      stopGeneration();
    }
    setCurrentSessionId(sessionId);
  };

  // 删除会话
  const handleDeleteSession = (sessionId: string) => {
    chatStorage.deleteSession(sessionId);
    if (currentSessionId === sessionId) {
      const remaining = chatStorage.getSessions();
      setCurrentSessionId(remaining[0]?.id || null);
      if (remaining.length === 0) {
        createNewSession();
      }
    }
    loadSessions();
  };

  // 重命名会话
  const handleRenameSession = (sessionId: string, newTitle: string) => {
    const sessions = chatStorage.getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.title = newTitle;
      session.updatedAt = Date.now();
      chatStorage.saveSession(session);
      loadSessions();
    }
  };

  // 置顶会话
  const handleTogglePin = (sessionId: string) => {
    chatStorage.toggleSessionPin(sessionId);
    loadSessions();
  };

  // 导出会话
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

  // 切换消息收藏
  const handleToggleFavorite = (messageId: string) => {
    if (!currentSessionId) return;
    chatStorage.toggleMessageFavorite(currentSessionId, messageId);
    const updatedMessages = chatStorage.getSessionMessages(currentSessionId);
    setMessages(updatedMessages);
  };

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentSessionId) return;

    if (input.length > MAX_INPUT_LENGTH) {
      alert(`输入内容过长，最多支持 ${MAX_INPUT_LENGTH} 个字符`);
      return;
    }

    const messageContent = input.trim();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 添加用户消息
    const userMessage: StoredMessage = {
      id: `msg_${Date.now()}`,
      sessionId: currentSessionId,
      role: 'user',
      content: messageContent,
      createdAt: Date.now(),
      favorited: false,
      requestId,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    chatStorage.saveMessage(userMessage);
    setInput('');
    setIsLoading(true);

    // 添加空的 AI 消息占位
    const aiMessageId = `msg_${Date.now()}_ai`;
    const aiMessage: StoredMessage = {
      id: aiMessageId,
      sessionId: currentSessionId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      favorited: false,
      requestId,
    };
    setMessages([...newMessages, aiMessage]);

    let accumulatedContent = '';
    abortControllerRef.current = new AbortController();

    try {
      await fetchEventSource('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          sessionId: currentSessionId,
          character: 'gentle',
          mode: 'companion',
          userId: user?.id,
          requestId,
        }),
        signal: abortControllerRef.current.signal,

        async onopen(response) {
          if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
            return;
          } else if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}`);
          }
        },

        onmessage(event) {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'content') {
              accumulatedContent += data.content;
              setMessages((prev) => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;
                if (lastIndex >= 0 && updated[lastIndex].id === aiMessageId) {
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    content: accumulatedContent,
                  };
                }
                return updated;
              });
            } else if (data.type === 'done') {
              // 保存完整的 AI 消息
              const finalMessage: StoredMessage = {
                id: aiMessageId,
                sessionId: currentSessionId,
                role: 'assistant',
                content: accumulatedContent,
                createdAt: Date.now(),
                favorited: false,
                requestId,
              };
              chatStorage.saveMessage(finalMessage);

              // 更新会话标题（如果是第一条消息）
              const session = chatStorage.getSessions().find(s => s.id === currentSessionId);
              if (session && session.title === '新对话') {
                session.title = messageContent.substring(0, 20) + (messageContent.length > 20 ? '...' : '');
                session.updatedAt = Date.now();
                chatStorage.saveSession(session);
                loadSessions();
              }
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        },

        onerror(err) {
          console.error('SSE error:', err);
          throw err;
        },
      });
    } catch (error: any) {
      console.error('Send error:', error);
      if (!accumulatedContent) {
        setMessages((prev) => prev.filter(m => m.id !== aiMessageId));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 停止生成
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 会话管理侧边栏 */}
      <div className={`${showSessionManager ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden border-r bg-white`}>
        <SessionManager
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSessionSelect={handleSessionSelect}
          onNewSession={createNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onTogglePin={handleTogglePin}
          onExport={handleExport}
        />
      </div>

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 头部 */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSessionManager(!showSessionManager)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {showSessionManager ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="font-medium text-gray-800">{currentSession?.title || '新对话'}</h2>
          </div>
          <button
            onClick={() => currentSessionId && handleExport(currentSessionId, 'md')}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="导出为 Markdown"
          >
            <Download size={20} />
          </button>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>开始新的对话吧</p>
            </div>
          )}

          {messages.map((message) => {
            if (message.role === 'assistant' && !message.content) {
              return (
                <div key={message.id} className="flex justify-start">
                  <div className="bg-white border px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="relative max-w-[70%]">
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white border text-gray-800 rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === 'assistant' && (
                    <div className="absolute -top-2 -right-2">
                      <MessageActions
                        messageId={message.id}
                        content={message.content}
                        favorited={message.favorited}
                        onToggleFavorite={() => handleToggleFavorite(message.id)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="bg-white border-t p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              disabled={isLoading}
              rows={1}
              className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:bg-gray-100"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            {isLoading ? (
              <button
                onClick={stopGeneration}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <StopCircle size={20} />
                停止
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send size={20} />
                发送
              </button>
            )}
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-400">按 Enter 发送，Shift + Enter 换行</p>
            <p className={`text-xs ${input.length > MAX_INPUT_LENGTH ? 'text-red-500' : 'text-gray-400'}`}>
              {input.length} / {MAX_INPUT_LENGTH}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
