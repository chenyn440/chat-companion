'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, Check, X, Users, Loader2, MessageCircle } from 'lucide-react';

interface UserInfo {
  id: string;
  nickname: string;
  phone: string;
  avatar?: string;
}

interface FriendsDialogProps {
  userId: string;
  onClose: () => void;
}

type Tab = 'list' | 'add' | 'requests';

export default function FriendsDialog({ userId, onClose }: FriendsDialogProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('list');
  const [friends, setFriends] = useState<(UserInfo & { createdAt: number })[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<UserInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [addStatus, setAddStatus] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<{ received: any[]; sent: any[] }>({ received: [], sent: [] });
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [friendSearch, setFriendSearch] = useState('');

  const headers = { 'x-user-id': userId, 'Content-Type': 'application/json' };

  useEffect(() => { loadFriends(); loadRequests(); }, []);

  const loadFriends = async () => {
    const r = await fetch('/api/friends', { headers });
    const d = await r.json();
    if (d.success) setFriends(d.data);
  };

  const loadRequests = async () => {
    const r = await fetch('/api/friends/request', { headers });
    const d = await r.json();
    if (d.success) setRequests(d.data);
  };

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(searchQ)}&userId=${userId}`);
      const d = await r.json();
      if (d.success) setSearchResults(d.data);
    } finally { setSearching(false); }
  };

  const handleAdd = async (toUserId: string) => {
    setAddStatus(p => ({ ...p, [toUserId]: 'loading' }));
    try {
      const r = await fetch('/api/friends/request', { method: 'POST', headers, body: JSON.stringify({ toUserId }) });
      const d = await r.json();
      setAddStatus(p => ({ ...p, [toUserId]: d.success ? 'sent' : (d.error || 'error') }));
    } catch { setAddStatus(p => ({ ...p, [toUserId]: '网络错误' })); }
  };

  const handleAccept = async (requestId: string) => {
    setProcessing(p => ({ ...p, [requestId]: true }));
    try {
      await fetch(`/api/friends/request/${requestId}/accept`, { method: 'POST', headers });
      await loadFriends(); await loadRequests();
    } finally { setProcessing(p => ({ ...p, [requestId]: false })); }
  };

  const handleReject = async (requestId: string) => {
    setProcessing(p => ({ ...p, [requestId]: true }));
    try {
      await fetch(`/api/friends/request/${requestId}/reject`, { method: 'POST', headers });
      await loadRequests();
    } finally { setProcessing(p => ({ ...p, [requestId]: false })); }
  };

  const handleRemove = async (friendId: string) => {
    if (!confirm('确定解除好友关系？')) return;
    await fetch(`/api/friends/${friendId}/remove`, { method: 'POST', headers });
    await loadFriends();
  };

  const filteredFriends = friendSearch
    ? friends.filter(f => f.nickname.includes(friendSearch) || f.phone.includes(friendSearch))
    : friends;

  const pendingCount = requests.received.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">好友</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Tab */}
        <div className="flex border-b border-gray-100 px-4">
          {([['list', '好友列表'], ['add', '添加好友'], ['requests', `申请${pendingCount > 0 ? ` (${pendingCount})` : ''}`]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 好友列表 */}
          {tab === 'list' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={friendSearch} onChange={e => setFriendSearch(e.target.value)}
                  placeholder="搜索好友..." className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-sm outline-none" />
              </div>
              {filteredFriends.length === 0
                ? <p className="text-center text-gray-400 text-sm py-8">暂无好友</p>
                : filteredFriends.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 group">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {f.nickname.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{f.nickname}</p>
                      <p className="text-xs text-gray-400">{f.phone}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={async () => {
                        // 先创建/获取会话，再跳转
                        const r = await fetch('/api/dm/conversations', {
                          method: 'POST',
                          headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ friendId: f.id }),
                        });
                        const d = await r.json();
                        if (d.success) {
                          onClose();
                          router.push(`/dm/${d.data.conversationId}`);
                        }
                      }}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg">
                        <MessageCircle size={12} />私信
                      </button>
                      <button onClick={() => handleRemove(f.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
                        解除
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* 添加好友 */}
          {tab === 'add' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索昵称或手机号..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-sm outline-none border border-gray-200 focus:border-blue-400" />
                </div>
                <button onClick={handleSearch} disabled={searching}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                  {searching ? <Loader2 size={14} className="animate-spin" /> : null}
                  搜索
                </button>
              </div>

              {searchResults.map(u => {
                const status = addStatus[u.id];
                return (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white text-sm font-bold">
                      {u.nickname.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{u.nickname}</p>
                      <p className="text-xs text-gray-400">{u.phone}</p>
                    </div>
                    <button
                      onClick={() => handleAdd(u.id)}
                      disabled={!!status}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        status === 'sent' ? 'bg-green-100 text-green-600' :
                        status === 'loading' ? 'bg-gray-100 text-gray-400' :
                        status ? 'bg-red-50 text-red-500' :
                        'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {status === 'sent' ? <><Check size={12} />已发送</> :
                       status === 'loading' ? <Loader2 size={12} className="animate-spin" /> :
                       status ? status :
                       <><UserPlus size={12} />添加</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 好友申请 */}
          {tab === 'requests' && (
            <div className="space-y-4">
              {requests.received.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 mb-2">收到的申请</h3>
                  <div className="space-y-2">
                    {requests.received.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
                          {r.from?.nickname?.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm">{r.from?.nickname}</p>
                          <p className="text-xs text-gray-400">{r.from?.phone}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleAccept(r.id)} disabled={processing[r.id]}
                            className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            <Check size={14} />
                          </button>
                          <button onClick={() => handleReject(r.id)} disabled={processing[r.id]}
                            className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 disabled:opacity-50">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {requests.sent.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 mb-2">发出的申请</h3>
                  <div className="space-y-2">
                    {requests.sent.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-sm font-bold">
                          {r.to?.nickname?.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm">{r.to?.nickname}</p>
                          <p className="text-xs text-gray-400">{r.to?.phone}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          r.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                        }`}>
                          {r.status === 'pending' ? '等待中' : '已拒绝'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {requests.received.length === 0 && requests.sent.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">暂无好友申请</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
