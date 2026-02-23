import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import { __config } from '@/lib/config';
import type { SFTP_FILES_LIST } from '@/pages/sftp/components/interface';

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
  password?: string;
  authMethod: string;
  // Per-tab view state — lives in store so it never leaks across tabs
  isConnecting: boolean;
  isConnected: boolean;
  isSftpConnected: boolean;
  loading: boolean;
  isError: boolean;
  currentDir: string;
  homeDir: string;
  title: string;
  remoteFiles: Partial<SFTP_FILES_LIST[]>;
}

/**
 * Persistent socket registry — lives outside React so sockets survive
 * component unmount / remount and route navigation.
 */
const socketRegistry = new Map<string, Socket>();

export function getOrCreateSocket(tabId: string): Socket {
  let socket = socketRegistry.get(tabId);
  if (socket) {
    // Socket object exists — reconnect if needed
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }
  socket = io(__config.API_URL, {
    query: { sessionId: tabId },
    autoConnect: true,
  });
  socketRegistry.set(tabId, socket);
  return socket;
}

export function destroySocket(tabId: string) {
  const socket = socketRegistry.get(tabId);
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socketRegistry.delete(tabId);
  }
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

export const useSFTPStore = create<SFTPStore>()(
  persist(
    (set) => ({
      tabs: [],
      sessions: {},
      activeTabId: undefined,

      addTab: (tab) =>
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id,
        })),

      removeTab: (tabId) => {
        // Destroy the socket when tab is explicitly closed
        destroySocket(tabId);
        // Clean up per-tab localStorage
        localStorage.removeItem(`sftp_current_dir_${tabId}`);
        set((state) => {
          const remaining = state.tabs.filter((t) => t.id !== tabId);
          const newActive =
            state.activeTabId === tabId
              ? remaining[remaining.length - 1]?.id
              : state.activeTabId;
          const { [tabId]: _, ...restSessions } = state.sessions;
          return { tabs: remaining, activeTabId: newActive, sessions: restSessions };
        });
      },

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
    }),
    {
      name: 'terminus-sftp-tabs',
      // Only persist tabs, activeTabId, and session metadata (not sockets/transient state)
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        sessions: Object.fromEntries(
          Object.entries(state.sessions).map(([k, v]) => [
            k,
            {
              tabId: v.tabId,
              host: v.host,
              username: v.username,
              status: 'idle' as const,
              isConnecting: false,
              isConnected: false,
              isSftpConnected: false,
              loading: false,
              isError: false,
              currentDir: '',
              homeDir: '',
              title: v.title || '',
              remoteFiles: [],
            },
          ])
        ),
      }),
    }
  )
);
