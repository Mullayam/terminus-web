import { create } from 'zustand';
import { __config } from '@/lib/config';

export interface AgentStatus {
  /** Whether the agentic loop is currently running */
  running: boolean;
  /** Current step/attempt number */
  step: number;
  /** Max retries allowed */
  maxSteps: number;
  /** Description of current action */
  action: string;
  /** Whether the last command succeeded */
  lastResult?: 'success' | 'error' | 'running';
}

export type AgentAction = 'executing' | 'waiting' | 'success' | 'error' | 'replanning' | 'blocked' | 'stopped' | 'info';

export interface AIChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'agent';
  content: string;
  /** Commands extracted from the assistant response for quick actions */
  commands?: string[];
  /** Agent step metadata (only for role === 'agent') */
  agentAction?: AgentAction;
  /** Step number in the agent loop */
  agentStep?: number;
  /** Max steps for the loop */
  agentMaxSteps?: number;
  /** The command being executed */
  agentCommand?: string;
  /** Terminal output captured */
  agentOutput?: string;
}

interface AIChatSession {
  messages: AIChatMessage[];
  nextMsgId: number;
}

export interface AIModelOption {
  providerId: string;
  modelId: string;
  label: string;
}

export interface AIProvider {
  id: string;
  name: string;
  icon?: string;
  models: { id: string; name: string; maxTokens?: number }[];
  available: boolean;
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
  /** Full visible terminal screen content, keyed by sessionId */
  terminalContent: Record<string, string>;
  /** Selected AI model per session */
  selectedModel: Record<string, AIModelOption>;
  /** AI-generated ghost command to display in xterm, keyed by sessionId */
  ghostCommand: Record<string, string>;
  /** Whether auto-execute is enabled for each session (session-scoped) */
  autoExecute: Record<string, boolean>;
  /** Agentic loop status per session */
  agentStatus: Record<string, AgentStatus>;
  /** Providers fetched from the API */
  providers: AIProvider[];
  /** Whether providers are being fetched */
  providersFetching: boolean;
  /** Whether providers have been fetched at least once */
  providersFetched: boolean;

  toggle: () => void;
  open: () => void;
  close: () => void;
  setLoading: (sessionId: string, loading: boolean) => void;
  setTerminalSelection: (sessionId: string, selection: string) => void;
  setTerminalContent: (sessionId: string, content: string) => void;
  setSelectedModel: (sessionId: string, model: AIModelOption) => void;
  fetchProviders: () => Promise<void>;
  addUserMessage: (sessionId: string, content: string) => number;
  addAssistantMessage: (sessionId: string) => number;
  updateAssistantMessage: (sessionId: string, msgId: number, content: string) => void;
  appendAssistantContent: (sessionId: string, msgId: number, delta: string) => void;
  setMessageCommands: (sessionId: string, msgId: number, commands: string[]) => void;
  addAgentMessage: (sessionId: string, content: string, meta?: Partial<Pick<AIChatMessage, 'agentAction' | 'agentStep' | 'agentMaxSteps' | 'agentCommand' | 'agentOutput'>>) => number;
  updateAgentMessage: (sessionId: string, msgId: number, content: string, meta?: Partial<Pick<AIChatMessage, 'agentAction' | 'agentStep' | 'agentMaxSteps' | 'agentCommand' | 'agentOutput'>>) => void;
  setGhostCommand: (sessionId: string, command: string) => void;
  clearGhostCommand: (sessionId: string) => void;
  setAutoExecute: (sessionId: string, enabled: boolean) => void;
  setAgentStatus: (sessionId: string, status: AgentStatus) => void;
  clearAgentStatus: (sessionId: string) => void;
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
  terminalContent: {},
  selectedModel: {},
  ghostCommand: {},
  autoExecute: {},
  agentStatus: {},
  providers: [],
  providersFetching: false,
  providersFetched: false,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  setLoading: (sessionId, loading) =>
    set((s) => ({ loading: { ...s.loading, [sessionId]: loading } })),

  setTerminalSelection: (sessionId, selection) =>
    set((s) => ({ terminalSelection: { ...s.terminalSelection, [sessionId]: selection } })),

  setTerminalContent: (sessionId, content) =>
    set((s) => ({ terminalContent: { ...s.terminalContent, [sessionId]: content } })),

  setSelectedModel: (sessionId, model) =>
    set((s) => ({ selectedModel: { ...s.selectedModel, [sessionId]: model } })),

  fetchProviders: async () => {
    const state = get();
    if (state.providersFetching) return;
    set({ providersFetching: true });
    try {
      const res = await fetch(`${__config.API_URL}/api/ai/providers`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const providers: AIProvider[] = Array.isArray(data.data)
        ? data.data
        : data?.data?.providers && Array.isArray(data.data.providers)
          ? data.data.providers
          : [];
      set({ providers, providersFetched: true });
    } catch {
      // Mark fetch failed so the auto-effect won't retry, but manual refresh can
      set({ providersFetched: false });
    } finally {
      set({ providersFetching: false });
    }
  },

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

  addAgentMessage: (sessionId, content, meta) => {
    const session = getOrCreateSession(get().sessions, sessionId);
    const id = session.nextMsgId;
    set((s) => ({
      sessions: {
        ...s.sessions,
        [sessionId]: {
          messages: [...session.messages, { id, role: 'agent', content, ...meta }],
          nextMsgId: id + 1,
        },
      },
    }));
    return id;
  },

  updateAgentMessage: (sessionId, msgId, content, meta) =>
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return {};
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: session.messages.map((m) =>
              m.id === msgId ? { ...m, content, ...meta } : m,
            ),
          },
        },
      };
    }),

  setGhostCommand: (sessionId, command) =>
    set((s) => ({ ghostCommand: { ...s.ghostCommand, [sessionId]: command } })),

  clearGhostCommand: (sessionId) =>
    set((s) => {
      const { [sessionId]: _, ...rest } = s.ghostCommand;
      return { ghostCommand: rest };
    }),

  setAutoExecute: (sessionId, enabled) =>
    set((s) => ({ autoExecute: { ...s.autoExecute, [sessionId]: enabled } })),

  setAgentStatus: (sessionId, status) =>
    set((s) => ({ agentStatus: { ...s.agentStatus, [sessionId]: status } })),

  clearAgentStatus: (sessionId) =>
    set((s) => {
      const { [sessionId]: _, ...rest } = s.agentStatus;
      return { agentStatus: rest };
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
      const { [sessionId]: ____, ...modelRest } = s.selectedModel;
      const { [sessionId]: _____, ...ghostRest } = s.ghostCommand;
      const { [sessionId]: ______, ...autoExecRest } = s.autoExecute;
      const { [sessionId]: _______, ...agentRest } = s.agentStatus;
      return { sessions: rest, loading: loadingRest, terminalSelection: selectionRest, selectedModel: modelRest, ghostCommand: ghostRest, autoExecute: autoExecRest, agentStatus: agentRest };
    }),
}));

/** Flatten providers into a list of AIModelOption */
export function getModelOptions(providers: AIProvider[]): AIModelOption[] {
  return providers
    .filter((p) => p.available)
    .flatMap((p) =>
      p.models.map((m) => ({
        providerId: p.id,
        modelId: m.id,
        label: m.name,
      })),
    );
}

/** Get the default model option from current providers */
export function getDefaultModel(providers: AIProvider[]): AIModelOption | undefined {
  return getModelOptions(providers)[0];
}
