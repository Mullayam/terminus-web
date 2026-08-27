import { useSSHStore } from '@/store/sshStore';
import { useTerminalStore } from '@/store/terminalStore';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { resolveKeySequence } from './useAgentExecutor';
import stripAnsi from 'strip-ansi';

/** Quiet period after which output is considered complete. */
const SETTLE_MS = 1200;
/** How long to wait for the first byte before assuming the command printed nothing. */
const NO_OUTPUT_MS = 3000;
const POLL_MS = 150;

export interface TerminalExecResult {
  output: string;
  exitCode?: number;
  timedOut: boolean;
}

function cleanOutput(raw: string, sentCommand: string): string {
  const lines = raw.split('\n');
  // Drop the echoed command line the shell writes back before its output.
  if (lines.length && lines[0].includes(sentCommand.slice(0, 40))) lines.shift();
  return lines.join('\n').trim();
}

/**
 * Run a command in the session's xterm and capture what it printed.
 *
 * The command is typed into the terminal exactly as-is — the same bytes the
 * Run button sends — so the session stays clean with no wrapper or marker
 * noise. Output is read back from the terminal log buffer.
 */
export function execInTerminal(
  sessionId: string,
  command: string,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<TerminalExecResult> {
  const socket = useSSHStore.getState().sessions[sessionId]?.socket;
  if (!socket) {
    return Promise.resolve({ output: 'No active terminal session.', exitCode: 127, timedOut: false });
  }

  // A key description ("Ctrl+C") must go out as real bytes, not typed text.
  const keys = resolveKeySequence(command);
  let consumed = useTerminalStore.getState().logSeq[sessionId] ?? 0;
  socket.emit(SocketEventConstants.SSH_EMIT_INPUT, keys ?? command + '\r');

  return new Promise<TerminalExecResult>((resolve) => {
    const start = Date.now();
    let lastChange = start;
    let sawOutput = false;
    let settled = false;
    let captured = '';

    /**
     * Pull chunks appended since the last drain. Counting appends instead of
     * indexing `logs` keeps the capture correct once the buffer is trimmed.
     */
    const drain = (): boolean => {
      const state = useTerminalStore.getState();
      const logs = state.logs[sessionId] ?? [];
      const seq = state.logSeq[sessionId] ?? 0;
      if (seq <= consumed) return false;
      const pending = Math.min(seq - consumed, logs.length);
      consumed = seq;
      if (pending === 0) return false;
      captured += logs.slice(logs.length - pending).join('');
      return true;
    };

    const onAbort = () => finish(false);

    function finish(timedOut: boolean) {
      if (settled) return;
      settled = true;
      abortSignal?.removeEventListener('abort', onAbort);
      drain();
      resolve({ output: cleanOutput(stripAnsi(captured), command), timedOut });
    }

    abortSignal?.addEventListener('abort', onAbort, { once: true });

    const tick = () => {
      if (settled) return;
      const now = Date.now();
      if (drain()) {
        lastChange = now;
        sawOutput = true;
      }

      if (now - start >= timeoutMs) {
        finish(true);
        return;
      }
      if (sawOutput && now - lastChange >= SETTLE_MS) {
        finish(false);
        return;
      }
      if (!sawOutput && now - start >= NO_OUTPUT_MS) {
        finish(false);
        return;
      }
      setTimeout(tick, POLL_MS);
    };

    setTimeout(tick, POLL_MS);
  });
}

/** Interrupt whatever is running in the session. */
export function interruptTerminal(sessionId: string) {
  useSSHStore.getState().sessions[sessionId]?.socket?.emit(SocketEventConstants.SSH_EMIT_INPUT, '\x03');
}

/** Type a command into the xterm, optionally pressing Enter. */
export function sendToTerminal(sessionId: string, command: string, execute: boolean) {
  const socket = useSSHStore.getState().sessions[sessionId]?.socket;
  if (!socket) return;
  socket.emit(SocketEventConstants.SSH_EMIT_INPUT, execute ? command + '\r' : command);
}
