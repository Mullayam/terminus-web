import { create } from 'zustand';

import { Socket } from 'socket.io-client';
import { ThemeName } from '@/pages/ssh-v/components/themes';
import { idb } from '@/lib/idb';

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
  sessionThemes: Record<string, ThemeName>;
  addSession: (session: SSHSession) => void;
  updateStatus: (sessionId: string, status: SSHSession['status'], error?: string) => void;
  updateSftpStatus: (sessionId: string, status: boolean) => void;
  removeSession: (sessionId: string) => void;
  setActiveTab: (tabId: string) => void;
  addTab: (tab: SSHTab) => void;
  removeTab: (tabId: string) => void;
  setSessionTheme: (sessionId: string, theme: ThemeName) => void;
  getSessionTheme: (sessionId: string) => ThemeName;
  loadSessionTheme: (sessionId: string) => Promise<void>;
}

export const useSSHStore = create<SSHStore>((set, get) => ({
  sessions: {},
  tabs: [],
  activeTabId: undefined,
  sftp_enabled: false,
  sessionThemes: {},
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
  setSessionTheme: (sessionId, theme) => {
    set((state) => ({
      sessionThemes: { ...state.sessionThemes, [sessionId]: theme },
    }));
    // Persist to IndexedDB
    idb.has('session_themes', sessionId as any).then((exists) => {
      if (exists) {
        idb.updateItem('session_themes', sessionId as any, { theme } as any);
      } else {
        idb.addNestedItem('session_themes', sessionId, { sessionId, theme } as any);
      }
    }).catch(console.error);
  },
  getSessionTheme: (sessionId) => {
    return get().sessionThemes[sessionId] || 'default';
  },
  loadSessionTheme: async (sessionId) => {
    try {
      const record = await idb.getRawDb().session_themes.get(sessionId);
      if (record?.theme) {
        set((state) => ({
          sessionThemes: { ...state.sessionThemes, [sessionId]: record.theme as ThemeName },
        }));
      }
    } catch (e) {
      console.error('Failed to load session theme:', e);
    }
  },
}));
