'use client';

import { useChatStore, Message } from '@/lib/store/chatStore';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ChatHeader from './ChatHeader';

export default function ChatContainer() {
  const { messages, isLoading } = useChatStore();

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ChatHeader />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg">开始和小暖聊天吧</p>
            <p className="text-sm mt-2">我在这里倾听你的一切</p>
          </div>
        ) : (
          messages.map((message: Message, index: number) => (
            <ChatMessage key={index} message={message} />
          ))
        )}
        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-400">
            <div className="animate-bounce">●</div>
            <div className="animate-bounce delay-100">●</div>
            <div className="animate-bounce delay-200">●</div>
          </div>
        )}
      </div>
      
      <ChatInput />
    </div>
  );
}
