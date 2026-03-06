'use client';

import { useState, useEffect } from 'react';
import { useChatStore, ChatMode, Character } from '@/lib/store/chatStore';
import { useAuthStore } from '@/lib/store/authStore';
import { Trash2, User, LogOut, History } from 'lucide-react';
import Link from 'next/link';
import LoginModal from '@/components/Auth/LoginModal';

const modes: { value: ChatMode; label: string }[] = [
  { value: 'companion', label: '陪伴' },
  { value: 'treehole', label: '树洞' },
  { value: 'advice', label: '建议' },
];

const characters: { value: Character; label: string }[] = [
  { value: 'gentle', label: '温柔知心' },
  { value: 'rational', label: '理性分析' },
  { value: 'funny', label: '幽默风趣' },
  { value: 'elder', label: '长辈关怀' },
];

export default function ChatHeader() {
  const { mode, character, setMode, setCharacter, clearMessages } = useChatStore();
  const { user, isLoggedIn, logout } = useAuthStore();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">小暖</h1>
          <div className="flex items-center space-x-2">
            {mounted && isLoggedIn ? (
              <div className="flex items-center space-x-2">
                <Link
                  href="/profile"
                  className="flex items-center space-x-1 text-sm text-gray-600 hover:text-blue-500"
                >
                  <User size={16} />
                  <span>{user?.nickname}</span>
                </Link>
                <button
                  onClick={() => logout(true)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="退出登录"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                登录
              </button>
            )}
            <Link
              href="/sessions"
              className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
              title="历史对话"
            >
              <History size={20} />
            </Link>
            <button
              onClick={clearMessages}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="清空对话"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 mt-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">模式：</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ChatMode)}
              className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {modes.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">角色：</span>
            <select
              value={character}
              onChange={(e) => setCharacter(e.target.value as Character)}
              className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {characters.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  );
}
