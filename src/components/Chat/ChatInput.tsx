'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useChatStore } from '@/lib/store/chatStore';
import { useAuthStore } from '@/lib/store/authStore';

export default function ChatInput() {
  const [input, setInput] = useState('');
  const { sessionId, mode, character, addMessage, setSessionId, setLoading } = useChatStore();
  const { user } = useAuthStore();

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    
    // 添加用户消息到本地
    addMessage({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          mode,
          character,
          userId: user?.id || 'guest',
        }),
      });
      
      const data = await res.json();
      console.log('API 响应:', data);
      
      if (data.success) {
        setSessionId(data.data.sessionId);
        addMessage({
          role: 'assistant',
          content: data.data.aiReply,
          timestamp: data.data.timestamp,
        });
      } else {
        console.error('API 返回错误:', data.error);
        addMessage({
          role: 'assistant',
          content: '抱歉，服务器返回错误：' + data.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Send message error:', error);
      addMessage({
        role: 'assistant',
        content: '抱歉，发送失败了，请再试一次。',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-white border-t">
      <div className="flex items-center space-x-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          className="flex-1 px-4 py-2 border rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={1}
        />
        <button
          onClick={handleSend}
          className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
