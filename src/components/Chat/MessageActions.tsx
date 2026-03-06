'use client';

import { Copy, Star, Download } from 'lucide-react';
import { useState } from 'react';

interface MessageActionsProps {
  messageId: string;
  content: string;
  favorited: boolean;
  onToggleFavorite: () => void;
}

export default function MessageActions({
  messageId,
  content,
  favorited,
  onToggleFavorite,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('复制失败');
    }
  };

  return (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
      <button
        onClick={handleCopy}
        className="p-1 hover:bg-gray-200 rounded"
        title={copied ? '已复制' : '复制'}
      >
        <Copy size={14} className={copied ? 'text-green-600' : 'text-gray-600'} />
      </button>
      <button
        onClick={onToggleFavorite}
        className="p-1 hover:bg-gray-200 rounded"
        title={favorited ? '取消收藏' : '收藏'}
      >
        <Star
          size={14}
          className={favorited ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}
        />
      </button>
    </div>
  );
}
