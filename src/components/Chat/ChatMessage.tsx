import { Message } from '@/lib/store/chatStore';
import { User, Bot } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  // 调试日志
  if (!isUser) {
    console.log('AI message content:', message.content, 'length:', message.content.length);
  }
  
  // 如果是空内容的 AI 消息，显示输入中的提示
  if (!message.content && !isUser) {
    return (
      <div className="flex justify-start">
        <div className="flex items-start space-x-2 max-w-[80%]">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-orange-400">
            <Bot size={16} className="text-white" />
          </div>
          <div className="px-4 py-2 rounded-2xl bg-white text-gray-400 rounded-bl-none shadow-sm">
            <div className="flex items-center space-x-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce delay-100">●</span>
              <span className="animate-bounce delay-200">●</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start space-x-2 max-w-[80%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-500' : 'bg-orange-400'
        }`}>
          {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
        </div>
        <div className={`px-4 py-2 rounded-2xl ${
          isUser 
            ? 'bg-blue-500 text-white rounded-br-none' 
            : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
        }`}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
