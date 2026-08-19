import { useRef, useSyncExternalStore } from "react";

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

/** Shallow-equality over a plain object's own enumerable keys. */
export function shallowEqualObj<T extends Record<string, unknown>>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

/**
 * Subscribe a component to a terminal input store. Pass a `selector` (+ optional
 * equality) so a bridge only re-renders when the slice it cares about changes —
 * e.g. arg-hint/collab bridges read just `buffer` and ignore `pos`/`visible`
 * updates that fire on cursor moves or box open/close.
 */
export function useTerminalInput(store: TerminalInputStore): TerminalInputSnapshot;
export function useTerminalInput<T>(
  store: TerminalInputStore,
  selector: (s: TerminalInputSnapshot) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useTerminalInput<T>(
  store: TerminalInputStore,
  selector: (s: TerminalInputSnapshot) => T = (s) => s as unknown as T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  // Cache the last selected value so getSnapshot stays referentially stable
  // when the selected slice is unchanged (required by useSyncExternalStore).
  const cacheRef = useRef<{ value: T } | null>(null);
  const getSnapshot = (): T => {
    const next = selector(store.get());
    const cache = cacheRef.current;
    if (cache && isEqual(cache.value, next)) return cache.value;
    cacheRef.current = { value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
