import { useSyncExternalStore } from "react";

/**
 * Per-terminal input state shared with the autocomplete/ghost overlays.
 *
 * The parent `XTerminal` writes to this store synchronously on every keystroke
 * (via `set`) but never subscribes to it, so typing never re-renders the parent
 * (and, crucially, never reconciles the xterm canvas). Only the small overlay
 * bridges subscribe, so a keystroke updates just those leaf components.
 */
export interface TerminalInputSnapshot {
  /** The user-typed portion of the current prompt line. */
  buffer: string;
  /** Whether the suggestion box should be shown. */
  visible: boolean;
  /** Suggestion-box anchor, relative to the terminal container. */
  pos: { top: number; left: number };
  /** Suggestions already filtered for the current buffer. */
  suggestions: string[];
}

export interface TerminalInputStore {
  get: () => TerminalInputSnapshot;
  set: (patch: Partial<TerminalInputSnapshot>) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createTerminalInputStore(): TerminalInputStore {
  let snapshot: TerminalInputSnapshot = {
    buffer: "",
    visible: false,
    pos: { top: 0, left: 0 },
    suggestions: [],
  };
  const listeners = new Set<() => void>();

  return {
    get: () => snapshot,
    set: (patch) => {
      snapshot = { ...snapshot, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Subscribe a component to a terminal input store. */
export function useTerminalInput(store: TerminalInputStore): TerminalInputSnapshot {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
