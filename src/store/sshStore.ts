import { create } from 'zustand';

import { Socket } from 'socket.io-client';

interface SSHSession {
  sessionId: string;
  host: string;
  username: string;
  status: 'disconnected' | 'connected' | 'connecting' | 'error';
  error?: string;
  socket?: null | Socket;
  sftp_enabled: boolean
}

interface SSHTab {
  id: string;
  title: string;
  sessionId: string;
}

interface SSHStore {
  sessions: Record<string, SSHSession>;
  tabs: SSHTab[];
  activeTabId?: string;
  addSession: (session: SSHSession) => void;
  updateStatus: (sessionId: string, status: SSHSession['status'], error?: string) => void;
  updateSftpStatus: (sessionId: string, status: boolean) => void;
  removeSession: (sessionId: string) => void;
  setActiveTab: (tabId: string) => void;
  addTab: (tab: SSHTab) => void;
  removeTab: (tabId: string) => void;
}

export const useSSHStore = create<SSHStore>((set) => ({
  sessions: {},
  tabs: [],
  activeTabId: undefined,
  sftp_enabled: false,
  addSession: (session) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [session.sessionId]: session,
      },
    })),
  updateStatus: (sessionId, status, error) =>
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, status, error },
        },
      };
    }),
  updateSftpStatus: (sessionId, status) =>
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, sftp_enabled: status, },
        },
      };
    }),

  removeSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.sessions;
      return { sessions: rest };
    }),
  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    })),
  removeTab: (tabId) => set((state) => ({ tabs: state.tabs.filter((tab) => tab.id !== tabId)})),
  setActiveTab: (tabId) => set(() => ({ activeTabId: tabId })),
}));
