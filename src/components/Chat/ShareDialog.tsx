'use client';

import { useState } from 'react';
import { X, Link, Copy, Check, Loader2, AlertCircle, Share2 } from 'lucide-react';
import { StoredMessage } from '@/lib/storage/chatStorage';

interface ShareDialogProps {
  sessionId: string;
  sessionTitle: string;
  messages: StoredMessage[];
  userId?: string;
  onClose: () => void;
}

type State = 'idle' | 'loading' | 'success' | 'error';

export default function ShareDialog({ sessionId, sessionTitle, messages, userId, onClose }: ShareDialogProps) {
  const [state, setState] = useState<State>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [shareId, setShareId] = useState('');
  const [copied, setCopied] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [revoking, setRevoking] = useState(false);

  const handleCreate = async () => {
    setState('loading');
    setErrMsg('');
    try {
      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          title: sessionTitle,
          messages: messages.filter(m => m.role !== 'system' && m.content),
          userId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShareUrl(data.shareUrl);
        setShareId(data.shareId);
        setState('success');
      } else {
        setErrMsg(data.error || '生成失败');
        setState('error');
      }
    } catch {
      setErrMsg('网络错误，请重试');
      setState('error');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!confirm('确定关闭分享？链接将立即失效。')) return;
    setRevoking(true);
    try {
      await fetch(`/api/share/${shareId}`, { method: 'POST' });
      onClose();
    } catch {
      alert('操作失败，请重试');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 弹窗 */}
      <div
        className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.2), 0 6px 20px rgba(0,0,0,0.12)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">分享此会话</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5 space-y-4">
          {/* 会话信息 */}
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-gray-800 truncate">{sessionTitle}</p>
            <p className="text-xs text-gray-400 mt-0.5">{messages.filter(m => m.content).length} 条消息</p>
          </div>

          {/* 说明 */}
          <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 px-3 py-2.5 rounded-lg">
            <Link size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <span>任何拿到链接的人都可以访问，无需登录（仅链接可见）</span>
          </div>

          {/* idle：生成按钮 */}
          {state === 'idle' && (
            <button
              onClick={handleCreate}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors"
            >
              生成分享链接
            </button>
          )}

          {/* loading */}
          {state === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-3 text-gray-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">生成中...</span>
            </div>
          )}

          {/* error */}
          {state === 'error' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-lg">
                <AlertCircle size={15} />
                <span>{errMsg}</span>
              </div>
              <button onClick={handleCreate} className="w-full py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm transition-colors">
                重试
              </button>
            </div>
          )}

          {/* success */}
          {state === 'success' && (
            <div className="space-y-3">
              {/* 链接展示 + 复制 */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
                <span className="flex-1 text-sm text-gray-700 truncate font-mono">{shareUrl}</span>
                <button
                  onClick={handleCopy}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    copied ? 'bg-green-100 text-green-600' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copied ? <><Check size={12} />已复制</> : <><Copy size={12} />复制</>}
                </button>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={() => window.open(shareUrl, '_blank')}
                  className="flex-1 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm transition-colors"
                >
                  预览
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="flex-1 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {revoking ? '关闭中...' : '关闭分享'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
