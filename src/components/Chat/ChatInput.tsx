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
      await fetchEventSource('/api/chat/send', {
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
        
        async onopen(response) {
          console.log('SSE Response status:', response.status);
          console.log('SSE Response content-type:', response.headers.get('content-type'));
          
          if (response.ok) {
            console.log('SSE connection opened successfully');
            return; // 一切正常
          } else {
            const errorText = await response.text();
            console.error('HTTP error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
        },
        
        onmessage(event) {
          console.log('SSE message received:', event.data);
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'session') {
              console.log('Session ID:', data.sessionId);
              setSessionId(data.sessionId);
            } else if (data.type === 'content') {
              accumulatedContent += data.content;
              console.log('Accumulated content:', accumulatedContent);
              updateLastMessage(accumulatedContent);
            } else if (data.type === 'done') {
              console.log('Stream completed');
            } else if (data.type === 'error') {
              console.error('Stream error:', data.error);
              updateLastMessage('抱歉，服务出错了：' + data.error);
            }
          } catch (e) {
            console.error('Parse error:', e, 'Raw data:', event.data);
          }
        },
        
        onerror(err) {
          console.error('SSE onerror triggered:', err);
          
          // 不要立即更新错误消息，等待看是否能恢复
          if (!accumulatedContent) {
            console.log('No content received yet, showing error');
            updateLastMessage('网络错误，请检查连接后重试');
          }
          
          // 抛出错误停止重连
          throw err;
        },
        
        onclose() {
          console.log('SSE connection closed');
        },
      });
    } catch (error: any) {
      console.error('fetchEventSource error:', error);
      if (error.name === 'AbortError') {
        console.log('Request aborted by user');
      } else if (!accumulatedContent) {
        console.log('Setting error message in catch block');
        updateLastMessage('抱歉，发送失败了，请再试一次。');
      }
    } finally {
      console.log('Finally block, setting loading to false');
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
