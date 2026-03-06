'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useAuthStore } from '@/lib/store/authStore';
import { useChatStore } from '@/lib/store/chatStore';
import TopicSuggestions from '@/components/Chat/TopicSuggestions';

interface Message {
  _id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Character {
  _id: string;
  name: string;
  avatar: string;
  greeting: string;
}

interface Session {
  id: string;
  title: string;
  mode: string;
  character: string;
  updatedAt: string;
  lastMessage: string;
  messageCount: number;
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn, user, checkAuth } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // 检查登录状态
    checkAuth().then(() => setIsCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (isCheckingAuth) return;
    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    loadCharacters();
    if (user?.id) {
      loadSessions();
    }
  }, [isLoggedIn, isCheckingAuth, user?.id]);

  // 角色加载完成后，应用用户默认偏好
  useEffect(() => {
    if (characters.length > 0 && user?.preferences?.defaultCharacter) {
      const defaultChar = characters.find(c => c._id === user.preferences!.defaultCharacter);
      if (defaultChar) setSelectedCharacter(defaultChar);
    } else if (characters.length > 0 && !selectedCharacter) {
      setSelectedCharacter(characters[0]);
    }
  }, [characters, user?.preferences?.defaultCharacter]);

  const loadSessions = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/chat/sessions?userId=' + user.id);
      const data = await res.json();
      if (data.success) {
        setSessions(data.data.sessions);
      }
    } catch (error) {
      console.error('Load sessions error:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadCharacters = async () => {
    try {
      const res = await fetch('/api/characters');
      const data = await res.json();
      if (data.success) {
        setCharacters(data.characters);
        if (data.characters.length > 0) {
          setSelectedCharacter(data.characters[0]);
        }
      }
    } catch (error) {
      console.error('Load characters error:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !selectedCharacter) return;

    // 保存消息内容，避免被清空
    const messageContent = input;

    const userMessage: Message = {
      _id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // 添加空的 AI 消息占位
    const aiMessageId = Date.now().toString() + '_ai';
    const aiMessage: Message = {
      _id: aiMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMessage]);

    let accumulatedContent = '';
    const abortController = new AbortController();

    try {
      await fetchEventSource('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageContent,
          sessionId,
          character: selectedCharacter._id,
          mode: 'companion',
          userId: user?.id,
        }),
        signal: abortController.signal,

        async onopen(response) {
          if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
            console.log('SSE connection opened');
            return;
          } else if (response.status === 401) {
            alert('请先登录');
            window.location.href = '/login';
            throw new Error('Unauthorized');
          } else if (response.status >= 400) {
            const errorText = await response.text();
            alert('服务异常：' + errorText);
            throw new Error(`HTTP ${response.status}`);
          }
        },

        onmessage(event) {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'session') {
              setSessionId(data.sessionId);
            } else if (data.type === 'content') {
              accumulatedContent += data.content;
              
              // 更新最后一条消息
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                if (lastIndex >= 0 && newMessages[lastIndex]._id === aiMessageId) {
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    content: accumulatedContent,
                  };
                }
                return newMessages;
              });
            } else if (data.type === 'done') {
              console.log('Stream completed');
              // 刷新会话列表
              if (user?.id) {
                loadSessions();
              }
            } else if (data.type === 'error') {
              console.error('Stream error:', data.error);
              alert('AI 服务出错：' + data.error);
            }
          } catch (e) {
            console.error('Parse error:', e, 'Raw data:', event.data);
          }
        },

        onerror(err) {
          console.error('SSE error:', err);
          if (!accumulatedContent) {
            alert('网络错误，请检查连接后重试');
            // 移除空的 AI 消息
            setMessages((prev) => prev.filter(m => m._id !== aiMessageId));
          }
          throw err;
        },

        onclose() {
          console.log('SSE connection closed');
        },
      });
    } catch (error: any) {
      console.error('Send message error:', error);
      if (!accumulatedContent) {
        // 移除空的 AI 消息
        setMessages((prev) => prev.filter(m => m._id !== aiMessageId));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setShowSessions(false);
  };

  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || '加载对话失败');
        return;
      }

      if (data.success && data.data.session) {
        const session = data.data.session;
        setSessionId(session.id);
        setMessages(session.messages.map((m: any, index: number) => ({
          _id: index.toString(),
          role: m.role,
          content: m.content,
          createdAt: m.timestamp,
        })));
        // 设置角色
        const char = characters.find(c => c._id === session.character);
        if (char) setSelectedCharacter(char);
        setShowSessions(false);
      } else {
        alert('对话数据加载失败');
      }
    } catch (error) {
      console.error('Load session error:', error);
      alert('网络错误，请重试');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">AI 陪聊</h1>
          <p className="text-sm text-gray-500">随时陪伴你的朋友</p>
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={startNewChat}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + 新对话
          </button>
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            {showSessions ? '隐藏历史' : '历史对话'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {showSessions ? (
            <>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">历史对话</h3>
              <div className="space-y-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition"
                  >
                    <p className="font-medium text-gray-800 truncate">{session.title}</p>
                    <p className="text-xs text-gray-500 truncate">{session.lastMessage || '无消息'}</p>
                    <p className="text-xs text-gray-400 mt-1">{session.messageCount} 条消息</p>
                  </button>
                ))}
                {sessions.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">暂无历史对话</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase mb-3">选择角色</h3>
                <div className="space-y-2">
                  {characters.map((char) => (
                    <button
                      key={char._id}
                      onClick={() => setSelectedCharacter(char)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left ${selectedCharacter?._id === char._id
                        ? 'bg-blue-50 border-blue-200 border'
                        : 'hover:bg-gray-50'
                        }`}
                    >
                      <span className="text-2xl">{char.avatar}</span>
                      <div>
                        <p className="font-medium text-gray-800">{char.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 话题推荐 */}
              <TopicSuggestions
                onSelectTopic={(topic) => setInput(topic)}
                characterId={selectedCharacter?._id}
              />
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <a href="/profile" className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
              {user?.nickname?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{user?.nickname}</p>
              <p className="text-xs text-gray-500">点击编辑资料</p>
            </div>
          </a>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{selectedCharacter?.avatar}</span>
            <div>
              <h2 className="font-medium text-gray-800">{selectedCharacter?.name}</h2>
              <p className="text-xs text-gray-500">AI 助手</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && selectedCharacter && (
            <div className="text-center py-12">
              <span className="text-6xl">{selectedCharacter.avatar}</span>
              <h3 className="text-xl font-medium text-gray-800 mt-4">{selectedCharacter.name}</h3>
              <p className="text-gray-500 mt-2">{selectedCharacter.greeting}</p>
            </div>
          )}

          {messages.map((message) => {
            // 如果是空的 AI 消息，显示输入中动画
            if (message.role === 'assistant' && !message.content) {
              return (
                <div key={message._id} className="flex justify-start">
                  <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message._id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-3 rounded-2xl ${message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                    }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              rows={1}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              发送
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">按 Enter 发送，Shift + Enter 换行</p>
        </div>
      </div>
    </div>
  );
}
