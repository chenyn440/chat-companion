'use client';

import { useState } from 'react';
import { Copy, Star, Check } from 'lucide-react';

interface MessageActionsProps {
  messageId: string;
  content: string;
  favorited: boolean;
  onToggleFavorite: () => void;
}

export default function MessageActions({ content, favorited, onToggleFavorite }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('复制失败');
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      {/* 复制按钮 */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="复制"
      >
        {copied ? (
          <><Check size={13} className="text-green-500" /><span className="text-green-500">已复制</span></>
        ) : (
          <><Copy size={13} /><span>复制</span></>
        )}
      </button>

      {/* 收藏按钮 */}
      <button
        onClick={onToggleFavorite}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
          favorited
            ? 'text-amber-500 hover:bg-amber-50'
            : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
        }`}
        title={favorited ? '取消收藏' : '收藏'}
      >
        <Star size={13} className={favorited ? 'fill-amber-400' : ''} />
        <span>{favorited ? '已收藏' : '收藏'}</span>
      </button>
    </div>
  );
}
