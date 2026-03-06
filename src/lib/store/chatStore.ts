import { create } from 'zustand';

export type ChatMode = 'treehole' | 'advice' | 'companion';
export type Character = 'gentle' | 'rational' | 'funny' | 'elder';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatState {
  sessionId: string | null;
  messages: Message[];
  mode: ChatMode;
  character: Character;
  isLoading: boolean;
  
  // Actions
  setSessionId: (id: string | null) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  setMode: (mode: ChatMode) => void;
  setCharacter: (character: Character) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessionId: null,
  messages: [],
  mode: 'companion',
  character: 'gentle',
  isLoading: false,
  
  setSessionId: (id) => set({ sessionId: id }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  updateLastMessage: (content) => set((state) => {
    console.log('updateLastMessage called with:', content, 'length:', content.length);
    const messages = [...state.messages];
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log('Updating last message from:', lastMessage.content, 'to:', content);
      messages[messages.length - 1] = {
        ...lastMessage,
        content,
      };
    }
    return { messages };
  }),
  setMode: (mode) => set({ mode }),
  setCharacter: (character) => set({ character }),
  setLoading: (loading) => set({ isLoading: loading }),
  clearMessages: () => set({ messages: [], sessionId: null }),
}));
