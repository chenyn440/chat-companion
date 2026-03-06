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
          console.log('SSE Response headers:', response.headers);
          
          if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
            console.log('SSE connection opened successfully');
            return; // 一切正常
          } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            // 客户端错误，不重试
            const errorText = await response.text();
            console.error('Client error:', response.status, errorText);
            throw new FatalError(`请求错误 (${response.status}): ${errorText}`);
          } else {
            // 服务器错误或其他问题，可以重试
            const errorText = await response.text();
            console.error('Server error:', response.status, errorText);
            throw new RetriableError(`服务器错误 (${response.status})`);
          }
        },
        
        onmessage(event) {
          console.log('SSE message received:', event.data);
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'session') {
              setSessionId(data.sessionId);
            } else if (data.type === 'content') {
              accumulatedContent += data.content;
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
          console.error('SSE error:', err);
          
          if (err instanceof FatalError) {
            updateLastMessage('抱歉，请求失败：' + err.message);
            throw err; // 停止重连
          }
          
          // 对于其他错误，显示友好提示但允许重试
          if (!accumulatedContent) {
            updateLastMessage('网络错误，正在重试...');
          }
          
          // 抛出错误以停止重连（我们不想无限重试）
          throw err;
        },
        
        onclose() {
          console.log('SSE connection closed');
        },
      });
    } catch (error: any) {
      console.error('Send message error:', error);
      if (error.name === 'AbortError') {
        console.log('Request aborted by user');
      } else if (!accumulatedContent) {
        updateLastMessage('抱歉，发送失败了，请再试一次。');
      }
    } finally {
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
