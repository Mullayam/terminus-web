import { create } from 'zustand';
import { Socket } from 'socket.io-client';

export interface SFTPTab {
  id: string;
  title: string;
  socketId?: string;
}

export interface SFTPSession {
  tabId: string;
  host: string;
  username: string;
  status: 'idle' | 'connecting' | 'connected' | 'error';
  error?: string;
  socket?: Socket | null;
}

interface SFTPStore {
  tabs: SFTPTab[];
  sessions: Record<string, SFTPSession>;
  activeTabId?: string;

  addTab: (tab: SFTPTab) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  addSession: (session: SFTPSession) => void;
  updateSession: (tabId: string, patch: Partial<SFTPSession>) => void;
  removeSession: (tabId: string) => void;
}

export const useSFTPStore = create<SFTPStore>((set) => ({
  tabs: [],
  sessions: {},
  activeTabId: undefined,

  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    })),

  removeTab: (tabId) =>
    set((state) => {
      const remaining = state.tabs.filter((t) => t.id !== tabId);
      const newActive =
        state.activeTabId === tabId
          ? remaining[remaining.length - 1]?.id
          : state.activeTabId;
      return { tabs: remaining, activeTabId: newActive };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  addSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.tabId]: session },
    })),

  updateSession: (tabId, patch) =>
    set((state) => {
      const existing = state.sessions[tabId];
      if (!existing) return state;
      return {
        sessions: { ...state.sessions, [tabId]: { ...existing, ...patch } },
      };
    }),

  removeSession: (tabId) =>
    set((state) => {
      const { [tabId]: _, ...rest } = state.sessions;
      return { sessions: rest };
    }),
}));
