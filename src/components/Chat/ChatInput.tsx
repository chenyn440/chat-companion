'use client';

import { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useChatStore } from '@/lib/store/chatStore';
import { useAuthStore } from '@/lib/store/authStore';

class RetriableError extends Error {}
class FatalError extends Error {}

export default function ChatInput() {
  const [input, setInput] = useState('');
  const { sessionId, mode, character, addMessage, setSessionId, setLoading, updateLastMessage } = useChatStore();
  const { user } = useAuthStore();
  const abortControllerRef = useRef<AbortController | null>(null);

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
    
    // 添加空的 AI 消息占位
    addMessage({
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });
    
    setLoading(true);
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    
    let accumulatedContent = '';

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          mode,
          character,
          userId: user?.id || 'guest',
        }),
        signal: abortControllerRef.current.signal,
      });

      console.log('Response status:', response.status);
      console.log('Response content-type:', response.headers.get('content-type'));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream finished');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          const data = trimmedLine.slice(6).trim();
          console.log('Received SSE data:', data);

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'session') {
              console.log('Session ID:', parsed.sessionId);
              setSessionId(parsed.sessionId);
            } else if (parsed.type === 'content') {
              accumulatedContent += parsed.content;
              console.log('Accumulated:', accumulatedContent);
              updateLastMessage(accumulatedContent);
            } else if (parsed.type === 'done') {
              console.log('Stream completed');
            } else if (parsed.type === 'error') {
              console.error('Stream error:', parsed.error);
              updateLastMessage('抱歉，服务出错了：' + parsed.error);
            }
          } catch (e) {
            console.error('Parse error:', e, 'Raw:', data);
          }
        }
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      if (error.name === 'AbortError') {
        console.log('Request aborted');
      } else if (!accumulatedContent) {
        updateLastMessage('抱歉，发送失败了，请再试一次。');
      }
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
      abortControllerRef.current = null;
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
