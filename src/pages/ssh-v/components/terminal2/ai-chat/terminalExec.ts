import { useSSHStore } from '@/store/sshStore';
import { useTerminalStore } from '@/store/terminalStore';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import stripAnsi from 'strip-ansi';

/** Marker printed after a command so the exit code and completion are unambiguous. */
const EC_PREFIX = '__TX_EC:';
const EC_SUFFIX = ':__';
const EC_RE = new RegExp(`${EC_PREFIX}(-?\\d+)${EC_SUFFIX}`);

/** Quiet period after which output is considered complete when no marker arrives. */
const SETTLE_MS = 1200;
const POLL_MS = 150;

export interface TerminalExecResult {
  output: string;
  exitCode?: number;
  timedOut: boolean;
}

/** A command can carry the exit-code marker only if it is a single self-contained line. */
function canInstrument(command: string): boolean {
  return !command.includes('\n') && !/&\s*$/.test(command.trim());
}

function cleanOutput(raw: string, sentCommand: string): string {
  const withoutMarker = raw.replace(new RegExp(`${EC_PREFIX}-?\\d+${EC_SUFFIX}`, 'g'), '');
  const lines = withoutMarker.split('\n');
  // Drop the echoed command line the shell writes back before its output.
  if (lines.length && lines[0].includes(sentCommand.slice(0, 40))) lines.shift();
  return lines.join('\n').trim();
}

/**
 * Run a command in the SSH session and capture its output.
 *
 * Resolves as soon as the exit-code marker appears, otherwise once output has
 * been quiet for `SETTLE_MS`, and always before `timeoutMs` so the backend is
 * still waiting when the result is posted.
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

  const instrument = canInstrument(command);
  const line = instrument ? `${command}; printf '\\n${EC_PREFIX}%s${EC_SUFFIX}\\n' "$?"` : command;
  const startLen = (useTerminalStore.getState().logs[sessionId] ?? []).length;
  socket.emit(SocketEventConstants.SSH_EMIT_INPUT, line + '\r');

  return new Promise<TerminalExecResult>((resolve) => {
    const start = Date.now();
    let lastLen = startLen;
    let lastChange = start;
    let settled = false;

    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      const logs = useTerminalStore.getState().logs[sessionId] ?? [];
      const raw = stripAnsi(logs.slice(startLen).join(''));
      const match = raw.match(EC_RE);
      resolve({
        output: cleanOutput(raw, command),
        exitCode: match ? Number(match[1]) : undefined,
        timedOut,
      });
    };

    const onAbort = () => finish(false);
    abortSignal?.addEventListener('abort', onAbort, { once: true });

    const tick = () => {
      if (settled) return;
      const logs = useTerminalStore.getState().logs[sessionId] ?? [];
      const now = Date.now();
      if (logs.length !== lastLen) {
        lastLen = logs.length;
        lastChange = now;
      }

      if (instrument && EC_RE.test(stripAnsi(logs.slice(startLen).join('')))) {
        abortSignal?.removeEventListener('abort', onAbort);
        finish(false);
        return;
      }
      if (now - start >= timeoutMs) {
        abortSignal?.removeEventListener('abort', onAbort);
        finish(true);
        return;
      }
      if (!instrument && logs.length > startLen && now - lastChange >= SETTLE_MS) {
        abortSignal?.removeEventListener('abort', onAbort);
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
