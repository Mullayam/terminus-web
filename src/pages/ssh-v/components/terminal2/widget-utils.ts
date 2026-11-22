import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useAIChatStore } from "@/store/aiChatStore";

/* Non-component helpers shared by the floating infrastructure widgets. */

export const TAIL_OPTIONS = ["100", "500", "1000", "all"] as const;
export type Tail = (typeof TAIL_OPTIONS)[number];

/** POSIX single-quote a value for safe use inside a remote shell command. */
export function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Put text in front of the AI chat as context and open the panel. */
export function askAI(sessionId: string, text: string) {
  const chat = useAIChatStore.getState();
  chat.setTerminalSelection(sessionId, text);
  chat.open();
}

/** Type a line into the session's interactive terminal and run it. */
export function sendToTerminal(socket: Socket | null | undefined, line: string, run = true) {
  if (!socket) return;
  socket.emit(SocketEventConstants.SSH_EMIT_INPUT, run ? `${line}\r` : line);
}

/** Non-hook one-shot silent exec; resolves "" on timeout. */
export function execOnce(socket: Socket | null | undefined, cmd: string, timeoutMs = 8000): Promise<string> {
  if (!socket) return Promise.resolve("");
  const requestId = `once-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    const done = (out: string) => {
      clearTimeout(timer);
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
      resolve(out.replace(/\r/g, ""));
    };
    const onOutput = (p: { requestId?: string; output?: string }) => {
      if (p?.requestId === requestId) done(p.output ?? "");
    };
    const timer = setTimeout(() => done(""), timeoutMs);
    socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId, cmd });
  });
}

/**
 * One-shot silent exec on a side channel (never touches the xterm).
 * `run(cmd)` resolves with the command's combined output; replies are matched
 * by requestId so several widgets can share the socket.
 */
export function useSilentExec(socket: Socket | null | undefined, prefix: string) {
  const pending = useRef(new Map<string, (out: string) => void>());

  useEffect(() => {
    if (!socket) return;
    const map = pending.current;
    const onOutput = (p: { requestId?: string; output?: string }) => {
      const id = p?.requestId;
      if (typeof id !== "string" || !map.has(id)) return;
      const resolve = map.get(id)!;
      map.delete(id);
      resolve((p.output ?? "").replace(/\r/g, ""));
    };
    socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    return () => {
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
      // Settle anything in flight so awaiting callers don't hang.
      for (const resolve of map.values()) resolve("");
      map.clear();
    };
  }, [socket]);

  return useCallback((cmd: string): Promise<string> => {
    if (!socket) return Promise.resolve("");
    const requestId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      pending.current.set(requestId, resolve);
      socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId, cmd });
    });
  }, [socket, prefix]);
}
