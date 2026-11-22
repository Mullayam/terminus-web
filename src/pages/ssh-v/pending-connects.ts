import type { FormValues } from './TerminalTab';

/**
 * One-shot hand-off from "restore workspace" to a tab that hasn't mounted
 * yet: connect automatically with `creds`, or just pre-fill the connect form
 * when no saved login exists; then `cd` into `cwd` once the shell is ready.
 * Memory only — never persisted.
 */
export interface PendingConnect {
  creds?: FormValues;
  prefill?: Partial<FormValues>;
  cwd?: string;
}

const pending = new Map<string, PendingConnect>();
const pendingCwd = new Map<string, string>();

export function setPendingConnect(sessionId: string, p: PendingConnect) {
  pending.set(sessionId, p);
}

/** Take the pending connect for a tab (removes it). */
export function takePendingConnect(sessionId: string): PendingConnect | undefined {
  const p = pending.get(sessionId);
  pending.delete(sessionId);
  if (p?.cwd) pendingCwd.set(sessionId, p.cwd);
  return p;
}

/** Take the folder to `cd` into once the shell is ready (removes it). */
export function takePendingCwd(sessionId: string): string | undefined {
  const cwd = pendingCwd.get(sessionId);
  pendingCwd.delete(sessionId);
  return cwd;
}
