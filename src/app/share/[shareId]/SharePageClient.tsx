'use client';

import { useEffect, useState } from 'react';
import { Copy, Download, Check, AlertCircle } from 'lucide-react';

interface ShareMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ShareData {
  shareId: string;
  title: string;
  messages: ShareMessage[];
  createdAt: number;
}

export default function SharePageClient({ shareId }: { shareId: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${shareId}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res.data);
        else setError(res.error || '加载失败');
      })
      .catch(() => setError('网络错误，请稍后重试'))
      .finally(() => setLoading(false));
  }, [shareId]);

  const handleCopyAll = async () => {
    if (!data) return;
    const text = data.messages
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}：\n${m.content}`)
      .join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMd = () => {
    if (!data) return;
    let md = `# ${data.title}\n\n`;
    md += `> 分享时间：${new Date(data.createdAt).toLocaleString('zh-CN')}\n\n---\n\n`;
    for (const m of data.messages) {
      md += `### ${m.role === 'user' ? '👤 用户' : '🤖 AI'}\n\n${m.content}\n\n`;
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertCircle size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">{error}</h2>
          <p className="text-sm text-gray-400">该分享链接可能已失效或不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
              AI
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-base">{data?.title}</h1>
              <p className="text-xs text-gray-400">
                分享于 {data ? new Date(data.createdAt).toLocaleDateString('zh-CN') : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              {copied ? '已复制' : '复制全文'}
            </button>
            <button
              onClick={handleExportMd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download size={14} />
              导出
            </button>
          </div>
        </div>
      </header>

      {/* 消息列表 */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {data?.messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm mt-0.5">
                  AI
                </div>
              )}
              <div className={`${isUser ? 'max-w-[70%]' : 'flex-1'}`}>
                {isUser ? (
                  <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : (
                  <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                )}
              </div>
              {isUser && (
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white text-xs font-bold shadow-sm mt-0.5">
                  用
                </div>
              )}
            </div>
          );
        })}

        {/* 底部水印 */}
        <div className="pt-8 pb-4 text-center">
          <p className="text-xs text-gray-300">
            由 <span className="font-medium">Chat 助手</span> 生成 · 只读分享
          </p>
        </div>
      </main>
    </div>
  );
}
