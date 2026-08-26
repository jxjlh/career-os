/**
 * Chat Store — Zustand store for multi-turn conversation state.
 *
 * Manages: message list, streaming state, provider selection,
 * and conversation history.
 */
import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: string;
  createdAt: number;
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface ChatState {
  // ── State ─────────────────────────────────────────────────
  conversations: Conversation[];
  activeConversationId: string | null;
  currentProvider: string;
  isStreaming: boolean;
  error: string | null;

  // ── Derived ────────────────────────────────────────────────
  activeConversation: () => Conversation | null;
  activeMessages: () => Message[];

  // ── Actions ────────────────────────────────────────────────
  createConversation: (title?: string) => string;
  deleteConversation: (id: string) => void;
  selectConversation: (id: string) => void;
  setProvider: (provider: string) => void;

  addMessage: (msg: Omit<Message, "id" | "createdAt">) => string;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  appendToMessage: (id: string, content: string) => void;

  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Store ────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  currentProvider: "xunfei",
  isStreaming: false,
  error: null,

  activeConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  },

  activeMessages: () => {
    const conv = get().activeConversation();
    return conv?.messages ?? [];
  },

  createConversation: (title = "New Conversation") => {
    const id = generateId();
    const conv: Conversation = {
      id,
      title,
      messages: [],
      createdAt: Date.now(),
    };
    set((state) => ({
      conversations: [conv, ...state.conversations],
      activeConversationId: id,
      error: null,
    }));
    return id;
  },

  deleteConversation: (id) => {
    set((state) => {
      const remaining = state.conversations.filter((c) => c.id !== id);
      return {
        conversations: remaining,
        activeConversationId:
          state.activeConversationId === id
            ? (remaining[0]?.id ?? null)
            : state.activeConversationId,
      };
    });
  },

  selectConversation: (id) => set({ activeConversationId: id, error: null }),

  setProvider: (provider) => set({ currentProvider: provider }),

  addMessage: (msg) => {
    const id = generateId();
    const message: Message = {
      ...msg,
      id,
      createdAt: Date.now(),
    };
    set((state) => {
      const convId = state.activeConversationId;
      if (!convId) return {};
      return {
        conversations: state.conversations.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, message] }
            : c,
        ),
      };
    });
    return id;
  },

  updateMessage: (id, patch) => {
    set((state) => {
      const convId = state.activeConversationId;
      if (!convId) return {};
      return {
        conversations: state.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === id ? { ...m, ...patch } : m,
                ),
              }
            : c,
        ),
      };
    });
  },

  appendToMessage: (id, content) => {
    set((state) => {
      const convId = state.activeConversationId;
      if (!convId) return {};
      return {
        conversations: state.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === id
                    ? { ...m, content: m.content + content }
                    : m,
                ),
              }
            : c,
        ),
      };
    });
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
