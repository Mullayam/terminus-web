import { create } from 'zustand';

import { Socket } from 'socket.io-client';
import { ThemeName } from '@/pages/ssh-v/components/themes';
import { idb } from '@/lib/idb';

export interface SessionFontSettings {
  fontSize: number;
  fontWeight: string;
  fontWeightBold: string;
}

const DEFAULT_FONT_SETTINGS: SessionFontSettings = {
  fontSize: 15,
  fontWeight: '400',
  fontWeightBold: '700',
};

const LS_FONT_KEY = 'terminus-session-fonts';

function loadAllFontsFromLS(): Record<string, SessionFontSettings> {
  try {
    const raw = localStorage.getItem(LS_FONT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveFontsToLS(fonts: Record<string, SessionFontSettings>) {
  localStorage.setItem(LS_FONT_KEY, JSON.stringify(fonts));
}

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
  splitMode: 'none' | 'horizontal' | 'vertical';
  splitTabId: string | null;
  sessionThemes: Record<string, ThemeName>;
  sessionFonts: Record<string, SessionFontSettings>;
  /** Sessions with unseen output that arrived while the tab was not visible. */
  sessionActivity: Record<string, boolean>;
  addSession: (session: SSHSession) => void;
  updateStatus: (sessionId: string, status: SSHSession['status'], error?: string) => void;
  updateSftpStatus: (sessionId: string, status: boolean) => void;
  removeSession: (sessionId: string) => void;
  setActiveTab: (tabId: string) => void;
  addTab: (tab: SSHTab) => void;
  removeTab: (tabId: string) => void;
  markSessionActivity: (sessionId: string) => void;
  clearSessionActivity: (sessionId: string) => void;
  setSplit: (mode: 'horizontal' | 'vertical', tabId: string) => void;
  clearSplit: () => void;
  setSessionTheme: (sessionId: string, theme: ThemeName) => void;
  getSessionTheme: (sessionId: string) => ThemeName;
  loadSessionTheme: (sessionId: string) => Promise<void>;
  setSessionFont: (sessionId: string, font: Partial<SessionFontSettings>) => void;
  getSessionFont: (sessionId: string) => SessionFontSettings;
  loadSessionFont: (sessionId: string) => void;
}

export const useSSHStore = create<SSHStore>((set, get) => ({
  sessions: {},
  tabs: [],
  activeTabId: undefined,
  sftp_enabled: false,
  splitMode: 'none',
  splitTabId: null,
  sessionThemes: {},
  sessionFonts: loadAllFontsFromLS(),
  sessionActivity: {},
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
      const { [sessionId]: __, ...restActivity } = state.sessionActivity;
      return { sessions: rest, sessionActivity: restActivity };
    }),
  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      sessionActivity: { ...state.sessionActivity, [tab.sessionId]: false },
    })),
  removeTab: (tabId) => set((state) => {
    const closingTab = state.tabs.find((tab) => tab.id === tabId);
    const remaining = state.tabs.filter((tab) => tab.id !== tabId);
    const newActive =
      state.activeTabId === tabId
        ? remaining[remaining.length - 1]?.id
        : state.activeTabId;
    // Clear split if the removed tab was in the split pane
    const shouldClearSplit = state.splitTabId === tabId || state.activeTabId === tabId;
    const sessionActivity = { ...state.sessionActivity };
    if (closingTab) delete sessionActivity[closingTab.sessionId];
    return {
      tabs: remaining,
      activeTabId: newActive,
      sessionActivity,
      ...(shouldClearSplit ? { splitMode: 'none' as const, splitTabId: null } : {}),
    };
  }),
  setSplit: (mode, tabId) => set({ splitMode: mode, splitTabId: tabId }),
  clearSplit: () => set({ splitMode: 'none', splitTabId: null }),
  setActiveTab: (tabId) => set((state) => {
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return { activeTabId: tabId };
    return {
      activeTabId: tabId,
      sessionActivity: { ...state.sessionActivity, [tab.sessionId]: false },
    };
  }),
  markSessionActivity: (sessionId) => set((state) => {
    if (state.sessionActivity[sessionId]) return state;
    return { sessionActivity: { ...state.sessionActivity, [sessionId]: true } };
  }),
  clearSessionActivity: (sessionId) => set((state) => {
    if (!state.sessionActivity[sessionId]) return state;
    return { sessionActivity: { ...state.sessionActivity, [sessionId]: false } };
  }),
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
  setSessionFont: (sessionId, font) => {
    const current = get().sessionFonts[sessionId] || { ...DEFAULT_FONT_SETTINGS };
    const updated = { ...current, ...font };
    const newFonts = { ...get().sessionFonts, [sessionId]: updated };
    set({ sessionFonts: newFonts });
    saveFontsToLS(newFonts);
  },
  getSessionFont: (sessionId) => {
    return get().sessionFonts[sessionId] || { ...DEFAULT_FONT_SETTINGS };
  },
  loadSessionFont: (sessionId) => {
    const all = loadAllFontsFromLS();
    if (all[sessionId]) {
      set((state) => ({
        sessionFonts: { ...state.sessionFonts, [sessionId]: all[sessionId] },
      }));
    }
  },
}));
