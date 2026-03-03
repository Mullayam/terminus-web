import { create } from 'zustand';
import type { DiagnosticEntry, DiagnosticCounts } from '@/pages/ssh-v/components/terminal2/diagnostics';

interface SessionDiagnostics {
  entries: DiagnosticEntry[];
  counts: DiagnosticCounts;
}

interface DiagnosticsStore {
  /** Per-session diagnostics keyed by sessionId */
  sessions: Record<string, SessionDiagnostics>;

  /** Whether the diagnostics chat modal is open */
  showDiagChat: boolean;
  /** Pre-selected filter when opening from status bar */
  diagFilter: 'error' | 'warning' | 'all';

  /** Open the diagnostics chat modal with an optional filter */
  openDiagChat: (filter?: 'error' | 'warning' | 'all') => void;
  /** Close the diagnostics chat modal */
  closeDiagChat: () => void;

  /** Update entries + counts for a session */
  setSessionDiagnostics: (sessionId: string, entries: DiagnosticEntry[], counts: DiagnosticCounts) => void;

  /** Clear diagnostics for a session */
  clearSession: (sessionId: string) => void;
}

export const useDiagnosticsStore = create<DiagnosticsStore>()((set) => ({
  sessions: {},
  showDiagChat: false,
  diagFilter: 'all' as const,

  openDiagChat: (filter = 'all') => set({ showDiagChat: true, diagFilter: filter }),
  closeDiagChat: () => set({ showDiagChat: false }),

  setSessionDiagnostics: (sessionId, entries, counts) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: { entries, counts },
      },
    })),

  clearSession: (sessionId) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: { entries: [], counts: { errors: 0, warnings: 0 } },
      },
    })),
}));
