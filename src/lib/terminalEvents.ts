/**
 * Minimal typed event bus for terminal cross-cutting events (decouples the
 * keystroke detector from feature listeners like filesystem autocomplete).
 *
 * Emits are synchronous fan-out to registered handlers only — they never touch
 * React state or the xterm canvas, so publishing from the keystroke path is
 * cheap. Heavy/async work (network) is the listener's responsibility.
 */

/** Terminal event keys — follows the same `@@`-prefixed enum convention as SocketEventConstants. */
export enum TerminalEventKey {
  /** User is typing a `cd`/`ls`-style command; carries the partial path. */
  FILESYSTEM_COMMAND = "@@command:filesystem",
}

export interface FilesystemCommandPayload {
  /** The filesystem command detected, e.g. "cd" or "ls". */
  command: string;
  /** The partial path argument the user has typed so far. */
  path: string;
  /** Owning terminal session id. */
  sessionId: string;
}

interface EventMap {
  [TerminalEventKey.FILESYSTEM_COMMAND]: FilesystemCommandPayload;
}

type Handler<T> = (payload: T) => void;

class TerminalEventBus {
  private listeners = new Map<keyof EventMap, Set<Handler<unknown>>>();

  on<K extends keyof EventMap>(key: K, handler: Handler<EventMap[K]>): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(handler as Handler<unknown>);
    return () => { set!.delete(handler as Handler<unknown>); };
  }

  emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
    this.listeners.get(key)?.forEach((h) => (h as Handler<EventMap[K]>)(payload));
  }
}

export const terminalEvents = new TerminalEventBus();
