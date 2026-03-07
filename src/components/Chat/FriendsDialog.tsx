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
  /** 转发模式：选中好友后触发转发，不跳转 */
  forwardMode?: boolean;
  onSelectFriend?: (friend: { id: string; nickname: string }) => void;
}

type Tab = 'list' | 'add' | 'requests';

export default function FriendsDialog({ userId, onClose, forwardMode, onSelectFriend }: FriendsDialogProps) {
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
  const [navLoading, setNavLoading] = useState<string | null>(null);

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

  /** 进入私信页（创建或获取会话） */
  const handleGoChat = async (friendId: string) => {
    if (navLoading) return;
    setNavLoading(friendId);
    try {
      const r = await fetch('/api/dm/conversations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ friendId }),
      });
      const d = await r.json();
      if (d.success) {
        onClose();
        router.push(`/dm/${d.data.conversationId}`);
      }
    } finally { setNavLoading(null); }
  };

  const filteredFriends = friendSearch
    ? friends.filter(f => f.nickname.includes(friendSearch) || f.phone.includes(friendSearch))
    : friends;

  const pendingCount = requests.received.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white w-full sm:max-w-lg flex flex-col overflow-hidden
          rounded-t-2xl sm:rounded-2xl"
        style={{ maxHeight: '88vh', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
      >
        {/* 移动端拖动条 */}
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">
              {forwardMode ? '选择好友转发' : '好友'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        {/* Tab（转发模式只显示好友列表） */}
        {!forwardMode && (
          <div className="flex border-b border-gray-100 px-4 flex-shrink-0">
            {([['list', '好友列表'], ['add', '添加好友'], ['requests', `申请${pendingCount > 0 ? ` (${pendingCount})` : ''}`]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
                  tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-3">

          {/* 好友列表 tab（或转发模式） */}
          {(tab === 'list' || forwardMode) && (
            <div className="space-y-1">
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={friendSearch} onChange={e => setFriendSearch(e.target.value)}
                  placeholder="搜索好友..." className="w-full pl-9 pr-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none" />
              </div>

              {filteredFriends.length === 0
                ? <p className="text-center text-gray-400 text-sm py-8">暂无好友</p>
                : filteredFriends.map(f => (
                  forwardMode ? (
                    /* 转发模式：整行点击触发转发，热区 ≥ 44px */
                    <button
                      key={f.id}
                      onClick={() => onSelectFriend?.({ id: f.id, nickname: f.nickname })}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition-colors text-left min-h-[56px]"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {f.avatar
                          ? <img src={f.avatar} alt={f.nickname} className="w-full h-full object-cover rounded-full" />
                          : f.nickname.slice(0, 1)
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-[14px]">{f.nickname}</p>
                        <p className="text-xs text-gray-400">{f.phone}</p>
                      </div>
                      <span className="text-xs text-blue-500 flex-shrink-0">发送</span>
                    </button>
                  ) : (
                    /* 普通模式：整行点击进入私信，操作按钮始终显示 */
                    <button
                      key={f.id}
                      onClick={() => handleGoChat(f.id)}
                      disabled={navLoading === f.id}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left min-h-[56px] disabled:opacity-60"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                        {f.avatar
                          ? <img src={f.avatar} alt={f.nickname} className="w-full h-full object-cover" />
                          : f.nickname.slice(0, 1)
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-[14px]">{f.nickname}</p>
                        <p className="text-xs text-gray-400">{f.phone}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {navLoading === f.id
                          ? <Loader2 size={15} className="animate-spin text-blue-500" />
                          : <MessageCircle size={16} className="text-blue-500" />
                        }
                        <span className="text-xs text-blue-500">私信</span>
                      </div>
                    </button>
                  )
                ))
              }

              {/* 普通模式：解除好友按钮单独放 */}
              {!forwardMode && filteredFriends.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  {filteredFriends.map(f => (
                    <div key={`remove-${f.id}`} className="flex items-center justify-between px-4 py-2">
                      <span className="text-[13px] text-gray-500">{f.nickname}</span>
                      <button onClick={() => handleRemove(f.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 min-h-[36px]">
                        解除好友
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 添加好友 */}
          {tab === 'add' && !forwardMode && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索昵称或手机号..."
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-blue-400" />
                </div>
                <button onClick={handleSearch} disabled={searching}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 min-h-[44px]">
                  {searching ? <Loader2 size={14} className="animate-spin" /> : null}
                  搜索
                </button>
              </div>

              {searchResults.map(u => {
                const status = addStatus[u.id];
                return (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 min-h-[56px]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {u.nickname.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{u.nickname}</p>
                      <p className="text-xs text-gray-400">{u.phone}</p>
                    </div>
                    <button onClick={() => handleAdd(u.id)} disabled={!!status}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors min-h-[36px] ${
                        status === 'sent' ? 'bg-green-100 text-green-600' :
                        status === 'loading' ? 'bg-gray-100 text-gray-400' :
                        status ? 'bg-red-50 text-red-500' :
                        'bg-blue-600 text-white hover:bg-blue-700'
                      }`}>
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
          {tab === 'requests' && !forwardMode && (
            <div className="space-y-4">
              {requests.received.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 mb-2">收到的申请</h3>
                  <div className="space-y-2">
                    {requests.received.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl min-h-[56px]">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {r.from?.nickname?.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm">{r.from?.nickname}</p>
                          <p className="text-xs text-gray-400">{r.from?.phone}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleAccept(r.id)} disabled={processing[r.id]}
                            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center">
                            <Check size={16} />
                          </button>
                          <button onClick={() => handleReject(r.id)} disabled={processing[r.id]}
                            className="p-2 bg-gray-200 text-gray-600 rounded-xl hover:bg-gray-300 disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center">
                            <X size={16} />
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
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl min-h-[56px]">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
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
