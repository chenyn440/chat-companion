// 本地存储服务 - 使用 localStorage 存储会话和消息

export interface StoredSession {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  character?: string;
  mode?: string;
}

export interface Variant {
  variantId: string;
  content: string;
  createdAt: number;
  status: 'streaming' | 'done' | 'error' | 'cancelled';
  requestId?: string;
  error?: { code: string; message: string };
}

export interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;         // 当前展示内容（activeVariant 的 content 或原始内容）
  createdAt: number;
  favorited: boolean;
  requestId?: string;
  variants?: Variant[];    // 仅 assistant 消息使用
  activeVariantId?: string;
}

const SESSIONS_KEY = 'chat_sessions';
const MESSAGES_KEY = 'chat_messages';
const MAX_SESSIONS = 50;
const MAX_MESSAGES_PER_SESSION = 100;
const MAX_VARIANTS_PER_MESSAGE = 5;

class ChatStorage {
  getSessions(): StoredSession[] {
    try {
      const data = localStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveSession(session: StoredSession): void {
    try {
      const sessions = this.getSessions();
      const index = sessions.findIndex(s => s.id === session.id);
      if (index >= 0) {
        sessions[index] = session;
      } else {
        sessions.unshift(session);
        if (sessions.length > MAX_SESSIONS) {
          const removed = sessions.pop();
          if (removed) this.deleteSessionMessages(removed.id);
        }
      }
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch {
      alert('存储空间不足，请清理部分历史会话');
    }
  }

  deleteSession(sessionId: string): void {
    try {
      const sessions = this.getSessions().filter(s => s.id !== sessionId);
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      this.deleteSessionMessages(sessionId);
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  }

  getSessionMessages(sessionId: string): StoredMessage[] {
    try {
      const data = localStorage.getItem(`${MESSAGES_KEY}_${sessionId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveMessage(message: StoredMessage): void {
    try {
      const messages = this.getSessionMessages(message.sessionId);
      const index = messages.findIndex(m => m.id === message.id);
      if (index >= 0) {
        messages[index] = message;
      } else {
        messages.push(message);
        if (messages.length > MAX_MESSAGES_PER_SESSION) messages.shift();
      }
      localStorage.setItem(`${MESSAGES_KEY}_${message.sessionId}`, JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save message:', e);
    }
  }

  saveMessages(sessionId: string, messages: StoredMessage[]): void {
    try {
      localStorage.setItem(`${MESSAGES_KEY}_${sessionId}`, JSON.stringify(messages.slice(-MAX_MESSAGES_PER_SESSION)));
    } catch (e) {
      console.error('Failed to save messages:', e);
    }
  }

  deleteSessionMessages(sessionId: string): void {
    try { localStorage.removeItem(`${MESSAGES_KEY}_${sessionId}`); } catch { /* ignore */ }
  }

  toggleMessageFavorite(sessionId: string, messageId: string): void {
    try {
      const messages = this.getSessionMessages(sessionId);
      const msg = messages.find(m => m.id === messageId);
      if (msg) { msg.favorited = !msg.favorited; this.saveMessages(sessionId, messages); }
    } catch (e) { console.error(e); }
  }

  toggleSessionPin(sessionId: string): void {
    try {
      const sessions = this.getSessions();
      const s = sessions.find(x => x.id === sessionId);
      if (s) { s.pinned = !s.pinned; this.saveSession(s); }
    } catch (e) { console.error(e); }
  }

  // ---- Variant 相关 ----

  /** 给 assistant 消息添加一个新 variant，返回新 variantId */
  addVariant(sessionId: string, messageId: string, requestId: string): string {
    const messages = this.getSessionMessages(sessionId);
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return '';

    const variantId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (!msg.variants) msg.variants = [];

    // 限制最多 5 个版本
    if (msg.variants.length >= MAX_VARIANTS_PER_MESSAGE) {
      // 移除最早的非 streaming 版本
      const oldIdx = msg.variants.findIndex(v => v.status !== 'streaming');
      if (oldIdx >= 0) msg.variants.splice(oldIdx, 1);
    }

    msg.variants.push({ variantId, content: '', createdAt: Date.now(), status: 'streaming', requestId });
    msg.activeVariantId = variantId;
    this.saveMessages(sessionId, messages);
    return variantId;
  }

  /** 更新指定 variant 的内容（流式追加时用） */
  updateVariantContent(sessionId: string, messageId: string, variantId: string, content: string, status?: Variant['status']): void {
    const messages = this.getSessionMessages(sessionId);
    const msg = messages.find(m => m.id === messageId);
    if (!msg?.variants) return;
    const v = msg.variants.find(x => x.variantId === variantId);
    if (!v) return;
    v.content = content;
    if (status) v.status = status;
    // 同步 content（activeVariant 的内容）
    if (msg.activeVariantId === variantId) msg.content = content;
    this.saveMessages(sessionId, messages);
  }

  /** 切换 activeVariantId */
  switchVariant(sessionId: string, messageId: string, variantId: string): void {
    const messages = this.getSessionMessages(sessionId);
    const msg = messages.find(m => m.id === messageId);
    if (!msg?.variants) return;
    const v = msg.variants.find(x => x.variantId === variantId);
    if (!v) return;
    msg.activeVariantId = variantId;
    msg.content = v.content;
    this.saveMessages(sessionId, messages);
  }

  // ---- 收藏列表 ----

  /** 获取所有收藏消息（跨会话） */
  getFavoriteMessages(): Array<{ session: StoredSession; message: StoredMessage }> {
    try {
      const sessions = this.getSessions();
      const results: Array<{ session: StoredSession; message: StoredMessage }> = [];
      for (const session of sessions) {
        const messages = this.getSessionMessages(session.id);
        for (const msg of messages) {
          if (msg.favorited) results.push({ session, message: msg });
        }
      }
      // 按收藏时间倒序（用 createdAt 近似）
      return results.sort((a, b) => b.message.createdAt - a.message.createdAt);
    } catch {
      return [];
    }
  }

  // ---- 搜索 ----

  searchMessages(keyword: string): Array<{ session: StoredSession; message: StoredMessage }> {
    try {
      const sessions = this.getSessions();
      const results: Array<{ session: StoredSession; message: StoredMessage }> = [];
      for (const session of sessions) {
        for (const msg of this.getSessionMessages(session.id)) {
          if (msg.content.toLowerCase().includes(keyword.toLowerCase())) {
            results.push({ session, message: msg });
          }
        }
      }
      return results;
    } catch { return []; }
  }

  // ---- 导出 ----

  exportSessionAsText(sessionId: string): string {
    const session = this.getSessions().find(s => s.id === sessionId);
    if (!session) return '';
    const messages = this.getSessionMessages(sessionId);
    let text = `# ${session.title}\n创建: ${new Date(session.createdAt).toLocaleString()}\n\n---\n\n`;
    for (const m of messages) {
      text += `[${new Date(m.createdAt).toLocaleString()}] ${m.role === 'user' ? '用户' : 'AI'}:\n${m.content}\n\n`;
    }
    return text;
  }

  exportSessionAsMarkdown(sessionId: string): string {
    const session = this.getSessions().find(s => s.id === sessionId);
    if (!session) return '';
    const messages = this.getSessionMessages(sessionId);
    let md = `# ${session.title}\n\n**创建:** ${new Date(session.createdAt).toLocaleString()}\n\n---\n\n`;
    for (const m of messages) {
      md += `### ${m.role === 'user' ? '👤 用户' : '🤖 AI'} (${new Date(m.createdAt).toLocaleString()})\n\n${m.content}\n\n`;
    }
    return md;
  }

  clearAll(): void {
    try {
      for (const s of this.getSessions()) this.deleteSessionMessages(s.id);
      localStorage.removeItem(SESSIONS_KEY);
    } catch { /* ignore */ }
  }
}

export const chatStorage = new ChatStorage();
