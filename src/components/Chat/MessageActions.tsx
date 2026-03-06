'use client';

import { useState } from 'react';
import { Copy, Star, Check, RefreshCw } from 'lucide-react';

interface MessageActionsProps {
  messageId: string;
  content: string;
  favorited: boolean;
  onToggleFavorite: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export default function MessageActions({
  content,
  favorited,
  onToggleFavorite,
  onRegenerate,
  isRegenerating,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex items-center gap-0.5">
      {/* 复制 */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="复制"
      >
        {copied
          ? <><Check size={13} className="text-green-500" /><span className="text-green-500">已复制</span></>
          : <><Copy size={13} /><span>复制</span></>
        }
      </button>

      {/* 收藏 */}
      <button
        onClick={onToggleFavorite}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
          favorited ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
        }`}
        title={favorited ? '取消收藏' : '收藏'}
      >
        <Star size={13} className={favorited ? 'fill-amber-400' : ''} />
        <span>{favorited ? '已收藏' : '收藏'}</span>
      </button>

      {/* 重新生成 */}
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="重新生成"
        >
          <RefreshCw size={13} className={isRegenerating ? 'animate-spin' : ''} />
          <span>{isRegenerating ? '生成中' : '重新生成'}</span>
        </button>
      )}
    </div>
  );
}
