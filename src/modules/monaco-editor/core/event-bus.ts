/**
 * @module monaco-editor/core/event-bus
 *
 * Simple typed event bus for inter-plugin communication.
 */

import type { IDisposable } from "../types";

export class EventBus {
  private handlers = new Map<string, Set<(data?: unknown) => void>>();

  emit(event: string, data?: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  on(event: string, handler: (data?: unknown) => void): IDisposable {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return {
      dispose: () => {
        const set = this.handlers.get(event);
        if (set) {
          set.delete(handler);
          if (set.size === 0) this.handlers.delete(event);
        }
      },
    };
  }

  clear(): void {
    this.handlers.clear();
  }
}
