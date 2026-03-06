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

export interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  favorited: boolean;
  requestId?: string;
}

const SESSIONS_KEY = 'chat_sessions';
const MESSAGES_KEY = 'chat_messages';
const MAX_SESSIONS = 50; // 最多保存 50 个会话
const MAX_MESSAGES_PER_SESSION = 100; // 每个会话最多 100 条消息

class ChatStorage {
  // 获取所有会话
  getSessions(): StoredSession[] {
    try {
      const data = localStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  // 保存会话
  saveSession(session: StoredSession): void {
    try {
      const sessions = this.getSessions();
      const index = sessions.findIndex(s => s.id === session.id);
      
      if (index >= 0) {
        sessions[index] = session;
      } else {
        sessions.unshift(session);
        // 限制会话数量
        if (sessions.length > MAX_SESSIONS) {
          const removed = sessions.pop();
          if (removed) {
            this.deleteSessionMessages(removed.id);
          }
        }
      }
      
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save session:', error);
      alert('存储空间不足，请清理部分历史会话');
    }
  }

  // 删除会话
  deleteSession(sessionId: string): void {
    try {
      const sessions = this.getSessions().filter(s => s.id !== sessionId);
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      this.deleteSessionMessages(sessionId);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  // 获取会话消息
  getSessionMessages(sessionId: string): StoredMessage[] {
    try {
      const data = localStorage.getItem(`${MESSAGES_KEY}_${sessionId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  }

  // 保存消息
  saveMessage(message: StoredMessage): void {
    try {
      const messages = this.getSessionMessages(message.sessionId);
      const index = messages.findIndex(m => m.id === message.id);
      
      if (index >= 0) {
        messages[index] = message;
      } else {
        messages.push(message);
        // 限制消息数量
        if (messages.length > MAX_MESSAGES_PER_SESSION) {
          messages.shift();
        }
      }
      
      localStorage.setItem(`${MESSAGES_KEY}_${message.sessionId}`, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }

  // 批量保存消息
  saveMessages(sessionId: string, messages: StoredMessage[]): void {
    try {
      const limited = messages.slice(-MAX_MESSAGES_PER_SESSION);
      localStorage.setItem(`${MESSAGES_KEY}_${sessionId}`, JSON.stringify(limited));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }

  // 删除会话的所有消息
  deleteSessionMessages(sessionId: string): void {
    try {
      localStorage.removeItem(`${MESSAGES_KEY}_${sessionId}`);
    } catch (error) {
      console.error('Failed to delete messages:', error);
    }
  }

  // 切换消息收藏状态
  toggleMessageFavorite(sessionId: string, messageId: string): void {
    try {
      const messages = this.getSessionMessages(sessionId);
      const message = messages.find(m => m.id === messageId);
      if (message) {
        message.favorited = !message.favorited;
        this.saveMessages(sessionId, messages);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  }

  // 切换会话置顶状态
  toggleSessionPin(sessionId: string): void {
    try {
      const sessions = this.getSessions();
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        session.pinned = !session.pinned;
        this.saveSession(session);
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  }

  // 搜索消息
  searchMessages(keyword: string): Array<{ session: StoredSession; message: StoredMessage }> {
    try {
      const sessions = this.getSessions();
      const results: Array<{ session: StoredSession; message: StoredMessage }> = [];
      
      for (const session of sessions) {
        const messages = this.getSessionMessages(session.id);
        for (const message of messages) {
          if (message.content.toLowerCase().includes(keyword.toLowerCase())) {
            results.push({ session, message });
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('Failed to search messages:', error);
      return [];
    }
  }

  // 导出会话为文本
  exportSessionAsText(sessionId: string): string {
    try {
      const sessions = this.getSessions();
      const session = sessions.find(s => s.id === sessionId);
      const messages = this.getSessionMessages(sessionId);
      
      if (!session) return '';
      
      let text = `# ${session.title}\n`;
      text += `创建时间: ${new Date(session.createdAt).toLocaleString()}\n`;
      text += `更新时间: ${new Date(session.updatedAt).toLocaleString()}\n\n`;
      text += '---\n\n';
      
      for (const message of messages) {
        const time = new Date(message.createdAt).toLocaleString();
        const role = message.role === 'user' ? '用户' : 'AI';
        text += `[${time}] ${role}:\n${message.content}\n\n`;
      }
      
      return text;
    } catch (error) {
      console.error('Failed to export session:', error);
      return '';
    }
  }

  // 导出会话为 Markdown
  exportSessionAsMarkdown(sessionId: string): string {
    try {
      const sessions = this.getSessions();
      const session = sessions.find(s => s.id === sessionId);
      const messages = this.getSessionMessages(sessionId);
      
      if (!session) return '';
      
      let md = `# ${session.title}\n\n`;
      md += `**创建时间:** ${new Date(session.createdAt).toLocaleString()}  \n`;
      md += `**更新时间:** ${new Date(session.updatedAt).toLocaleString()}\n\n`;
      md += '---\n\n';
      
      for (const message of messages) {
        const time = new Date(message.createdAt).toLocaleString();
        const role = message.role === 'user' ? '👤 用户' : '🤖 AI';
        md += `### ${role} (${time})\n\n`;
        md += `${message.content}\n\n`;
      }
      
      return md;
    } catch (error) {
      console.error('Failed to export session:', error);
      return '';
    }
  }

  // 清理所有数据
  clearAll(): void {
    try {
      const sessions = this.getSessions();
      for (const session of sessions) {
        this.deleteSessionMessages(session.id);
      }
      localStorage.removeItem(SESSIONS_KEY);
    } catch (error) {
      console.error('Failed to clear all:', error);
    }
  }
}

export const chatStorage = new ChatStorage();
