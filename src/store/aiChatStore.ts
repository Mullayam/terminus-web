import { create } from 'zustand';

export interface AIChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  /** Commands extracted from the assistant response for quick actions */
  commands?: string[];
}

interface AIChatSession {
  messages: AIChatMessage[];
  nextMsgId: number;
}

interface AIChatState {
  /** Per-session chat histories keyed by sessionId */
  sessions: Record<string, AIChatSession>;
  /** Whether the AI chat panel is open */
  isOpen: boolean;
  /** Whether a streaming response is in progress, keyed by sessionId */
  loading: Record<string, boolean>;
  /** Current user selection from terminal, keyed by sessionId */
  terminalSelection: Record<string, string>;

  toggle: () => void;
  open: () => void;
  close: () => void;
  setLoading: (sessionId: string, loading: boolean) => void;
  setTerminalSelection: (sessionId: string, selection: string) => void;
  addUserMessage: (sessionId: string, content: string) => number;
  addAssistantMessage: (sessionId: string) => number;
  updateAssistantMessage: (sessionId: string, msgId: number, content: string) => void;
  appendAssistantContent: (sessionId: string, msgId: number, delta: string) => void;
  setMessageCommands: (sessionId: string, msgId: number, commands: string[]) => void;
  clearSession: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
}

function getOrCreateSession(sessions: Record<string, AIChatSession>, sessionId: string): AIChatSession {
  return sessions[sessionId] || { messages: [], nextMsgId: 1 };
}

export const useAIChatStore = create<AIChatState>((set, get) => ({
  sessions: {},
  isOpen: false,
  loading: {},
  terminalSelection: {},

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  setLoading: (sessionId, loading) =>
    set((s) => ({ loading: { ...s.loading, [sessionId]: loading } })),

  setTerminalSelection: (sessionId, selection) =>
    set((s) => ({ terminalSelection: { ...s.terminalSelection, [sessionId]: selection } })),

  addUserMessage: (sessionId, content) => {
    const session = getOrCreateSession(get().sessions, sessionId);
    const id = session.nextMsgId;
    set((s) => ({
      sessions: {
        ...s.sessions,
        [sessionId]: {
          messages: [...session.messages, { id, role: 'user', content }],
          nextMsgId: id + 1,
        },
      },
    }));
    return id;
  },

  addAssistantMessage: (sessionId) => {
    const session = getOrCreateSession(get().sessions, sessionId);
    const id = session.nextMsgId;
    set((s) => ({
      sessions: {
        ...s.sessions,
        [sessionId]: {
          messages: [...session.messages, { id, role: 'assistant', content: '' }],
          nextMsgId: id + 1,
        },
      },
    }));
    return id;
  },

  updateAssistantMessage: (sessionId, msgId, content) =>
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return {};
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: session.messages.map((m) =>
              m.id === msgId ? { ...m, content } : m,
            ),
          },
        },
      };
    }),

  appendAssistantContent: (sessionId, msgId, delta) =>
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return {};
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: session.messages.map((m) =>
              m.id === msgId ? { ...m, content: m.content + delta } : m,
            ),
          },
        },
      };
    }),

  setMessageCommands: (sessionId, msgId, commands) =>
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return {};
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: session.messages.map((m) =>
              m.id === msgId ? { ...m, commands } : m,
            ),
          },
        },
      };
    }),

  clearSession: (sessionId) =>
    set((s) => ({
      sessions: {
        ...s.sessions,
        [sessionId]: { messages: [], nextMsgId: 1 },
      },
    })),

  removeSession: (sessionId) =>
    set((s) => {
      const { [sessionId]: _, ...rest } = s.sessions;
      const { [sessionId]: __, ...loadingRest } = s.loading;
      const { [sessionId]: ___, ...selectionRest } = s.terminalSelection;
      return { sessions: rest, loading: loadingRest, terminalSelection: selectionRest };
    }),
}));
