import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { SocketEventConstants } from "@/lib/sockets/event-constants";

// CSI / OSC escape sequences — log output is shown as plain text.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Z0-9]/g;

export interface ExecStream {
  /** Completed lines plus the in-progress last line, oldest first. */
  lines: string[];
  /** Lines dropped from the front once `maxLines` was exceeded. */
  dropped: number;
  live: boolean;
  exitCode: number | null;
  error: string | null;
  clear: () => void;
}

/**
 * Runs `cmd` on the server's streaming exec channel while it is non-null and
 * pushes output as it arrives. Changing `cmd` or `runKey` restarts the stream;
 * setting `cmd` to null or unmounting stops it (the server hangs up the remote
 * process). Renders are coalesced to one per animation frame.
 */
export function useExecStream(
  socket: Socket | null | undefined,
  cmd: string | null,
  runKey = 0,
  maxLines = 5000,
): ExecStream {
  const [lines, setLines] = useState<string[]>([]);
  const [dropped, setDropped] = useState(0);
  const [live, setLive] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bufRef = useRef<string[]>([]);
  const partialRef = useRef("");
  const droppedRef = useRef(0);

  useEffect(() => {
    // Stopping keeps the last output on screen; only a new stream resets it.
    if (!socket || !cmd) {
      setLive(false);
      return;
    }

    bufRef.current = [];
    partialRef.current = "";
    droppedRef.current = 0;
    setLines([]);
    setDropped(0);
    setExitCode(null);
    setError(null);

    const streamId = `xs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let raf = 0;

    const publish = () => {
      raf = 0;
      const buf = bufRef.current;
      setLines(partialRef.current ? [...buf, partialRef.current] : buf.slice());
      setDropped(droppedRef.current);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(publish); };

    const onData = (p: { streamId?: string; chunk?: string }) => {
      if (p?.streamId !== streamId || typeof p.chunk !== "string") return;
      const text = partialRef.current + p.chunk.replace(ANSI_RE, "").replace(/\r/g, "");
      const parts = text.split("\n");
      partialRef.current = parts.pop() ?? "";
      if (parts.length) {
        const buf = bufRef.current;
        buf.push(...parts);
        if (buf.length > maxLines) {
          const extra = buf.length - maxLines;
          buf.splice(0, extra);
          droppedRef.current += extra;
        }
      }
      schedule();
    };

    const onEnd = (p: { streamId?: string; code?: number | null; error?: string }) => {
      if (p?.streamId !== streamId) return;
      if (partialRef.current) {
        bufRef.current.push(partialRef.current);
        partialRef.current = "";
      }
      if (raf) cancelAnimationFrame(raf);
      publish();
      setLive(false);
      setExitCode(typeof p.code === "number" ? p.code : null);
      setError(p.error ?? null);
    };

    socket.on(SocketEventConstants.SSH_EXEC_STREAM_DATA, onData);
    socket.on(SocketEventConstants.SSH_EXEC_STREAM_END, onEnd);
    socket.emit(SocketEventConstants.SSH_EXEC_STREAM, { streamId, cmd });
    setLive(true);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      socket.off(SocketEventConstants.SSH_EXEC_STREAM_DATA, onData);
      socket.off(SocketEventConstants.SSH_EXEC_STREAM_END, onEnd);
      socket.emit(SocketEventConstants.SSH_EXEC_STREAM_STOP, { streamId });
    };
  }, [socket, cmd, runKey, maxLines]);

  const clear = useCallback(() => {
    bufRef.current = [];
    partialRef.current = "";
    droppedRef.current = 0;
    setLines([]);
    setDropped(0);
  }, []);

  return { lines, dropped, live, exitCode, error, clear };
}
