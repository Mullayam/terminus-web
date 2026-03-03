/**
 * @module monaco-editor/extensions/extensionStatusStore
 *
 * Tiny Zustand store that tracks GitHub extension activation status.
 *
 * Consumed by the status bar component to show:
 *   - "Activating Extensions…" with a spinner while loading
 *   - Folder name currently being activated
 *   - Error state
 *
 * Also exposes `showExtNotification()` for success/failure toasts
 * via the editor notification system.
 */

import { create } from "zustand";

/* ── Types ─────────────────────────────────────────────────── */

export type ExtActivationPhase =
  | "idle"           // Nothing happening
  | "indexing"       // Fetching top-level extension index
  | "activating"     // Loading a specific extension folder
  | "done"           // Finished (auto-resets to idle after a delay)
  | "error";         // Something failed

export interface ExtensionStatusState {
  phase: ExtActivationPhase;
  /** The folder currently being loaded (e.g. "python", "typescript-basics") */
  activeFolder: string | null;
  /** Number of folders loaded in this session */
  loadedCount: number;
  /** Last error message (cleared on next activation) */
  lastError: string | null;

  /* ── Actions ───────────────────────────────────────────── */

  /** Signal that the extension index is being fetched */
  setIndexing: () => void;
  /** Signal that a specific folder is being activated */
  setActivating: (folder: string) => void;
  /** Signal successful load of a folder */
  setDone: (folder: string) => void;
  /** Signal an error */
  setError: (folder: string, message: string) => void;
  /** Reset to idle */
  reset: () => void;
}

/* ── Auto-reset timer ──────────────────────────────────────── */

let resetTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReset(set: (partial: Partial<ExtensionStatusState>) => void) {
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    set({ phase: "idle", activeFolder: null });
    resetTimer = null;
  }, 3000);
}

/* ── Store ─────────────────────────────────────────────────── */

export const useExtensionStatusStore = create<ExtensionStatusState>((set) => ({
  phase: "idle",
  activeFolder: null,
  loadedCount: 0,
  lastError: null,

  setIndexing: () =>
    set({ phase: "indexing", activeFolder: null, lastError: null }),

  setActivating: (folder) =>
    set({ phase: "activating", activeFolder: folder, lastError: null }),

  setDone: (folder) =>
    set((state) => {
      scheduleReset(set);
      return {
        phase: "done",
        activeFolder: folder,
        loadedCount: state.loadedCount + 1,
        lastError: null,
      };
    }),

  setError: (folder, message) =>
    set(() => {
      scheduleReset(set);
      return {
        phase: "error",
        activeFolder: folder,
        lastError: message,
      };
    }),

  reset: () => {
    if (resetTimer) clearTimeout(resetTimer);
    set({ phase: "idle", activeFolder: null, lastError: null });
  },
}));

/* ── Imperative helpers (for non-React code) ──────────────── */

/**
 * Get the store actions directly (usable outside React components).
 */
export function getExtensionStatus() {
  return useExtensionStatusStore.getState();
}
