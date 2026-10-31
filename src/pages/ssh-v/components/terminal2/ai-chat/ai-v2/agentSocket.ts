// ─────────────────────────────────────────────────────────────
// AI Agent v2 — REAL connector
//
// Live wiring for the `/ai-agent` Socket.IO namespace + the `/api/ai/agent/*`
// HTTP endpoints described in the integration guide. This replaces the former
// local mock: prompts, confirmations and aborts now hit the real agent, which
// operates on the terminal's own PTY (sessionId = the SSH session id).
// ─────────────────────────────────────────────────────────────

import { io, Socket } from 'socket.io-client';
import { __config } from '@/lib/config';
import { AGENT_NAMESPACE, AgentEventName } from './constants';
import type { AgentEvent, AgentModelCatalog, AgentSettings, ConfirmRequest } from './types';

// ── One shared namespace socket for all sessions (events carry sessionId) ──
let _socket: Socket | null = null;

export function getAgentSocket(): Socket {
  if (!_socket) {
    _socket = io(`${__config.API_URL.replace(/\/$/, '')}${AGENT_NAMESPACE}`, {
      withCredentials: true,
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return _socket;
}

// ── Client → server emits ──
export function emitPrompt(sessionId: string, prompt: string, model?: string): void {
  getAgentSocket().emit(AgentEventName.PROMPT, { sessionId, prompt, model });
}

export function emitConfirmReply(confirmId: string, approved: boolean): void {
  getAgentSocket().emit(AgentEventName.CONFIRM_REPLY, { confirmId, approved });
}

export function emitAbort(sessionId: string): void {
  getAgentSocket().emit(AgentEventName.ABORT, { sessionId });
}

// ── Server → client subscriptions. Each returns an unsubscribe fn. ──
export function onAgentEvent(handler: (e: AgentEvent) => void): () => void {
  const s = getAgentSocket();
  s.on(AgentEventName.EVENT, handler);
  return () => s.off(AgentEventName.EVENT, handler);
}

export function onConfirmRequest(handler: (req: ConfirmRequest) => void): () => void {
  const s = getAgentSocket();
  s.on(AgentEventName.CONFIRM_REQUEST, handler);
  return () => s.off(AgentEventName.CONFIRM_REQUEST, handler);
}

export function onConnectionChange(handler: (connected: boolean) => void): () => void {
  const s = getAgentSocket();
  const onConnect = () => handler(true);
  const onDisconnect = () => handler(false);
  s.on('connect', onConnect);
  s.on('disconnect', onDisconnect);
  return () => {
    s.off('connect', onConnect);
    s.off('disconnect', onDisconnect);
  };
}

export function isAgentConnected(): boolean {
  return !!_socket?.connected;
}

// ── HTTP: settings & model catalog (guide §5) ──
function apiUrl(path: string): string {
  return `${__config.API_URL.replace(/\/$/, '')}${path}`;
}

/** Backend wraps most JSON responses in `{ data: … }`. */
function unwrap<T>(json: any): T {
  return (json?.data ?? json) as T;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.message ?? body?.error ?? body?.data?.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

const EMPTY_CATALOG: AgentModelCatalog = { providers: [], configured: [] };

const str = (...vals: unknown[]): string => {
  for (const v of vals) if (typeof v === 'string' && v) return v;
  for (const v of vals) if (typeof v === 'number') return String(v);
  return '';
};

/**
 * The server's model catalog shape isn't guaranteed to match the guide — a
 * provider may be `{ id, label, models }`, `{ id, name, available, models }`,
 * `{ name, data }`, or the whole set an object map. Normalize all of them into
 * `{ providers: [{ id, label, models: [{id,label}] }], configured: [id] }`.
 */
function normalizeCatalog(raw: any): AgentModelCatalog {
  const root = raw?.providers ?? raw ?? [];
  const entries: any[] = Array.isArray(root)
    ? root
    : root && typeof root === 'object'
      ? Object.entries(root).map(([k, v]) => ({ id: k, ...(v && typeof v === 'object' ? v : { models: v }) }))
      : [];

  const configuredIn: string[] = Array.isArray(raw?.configured) ? raw.configured.map((c: unknown) => str(c)) : [];

  const providers = entries.map((p, i) => {
    const id = str(p?.id, p?.providerId, p?.key, p?.name, p?.label) || `p${i}`;
    const label = str(p?.label, p?.name, id);
    const rawModels = p?.models ?? p?.data ?? [];
    const models = (Array.isArray(rawModels) ? rawModels : []).map((m: any, j: number) => {
      if (typeof m === 'string') return { id: m, label: m };
      const mid = str(m?.id, m?.modelId, m?.value, m?.model, m?.name) || `${id}-m${j}`;
      return { id: mid, label: str(m?.label, m?.name, mid) };
    });
    return { id, label, models, _available: p?.available };
  });

  // configured: explicit list wins; otherwise any provider not flagged unavailable.
  const configured = configuredIn.length
    ? configuredIn
    : providers.filter((p) => (p as any)._available !== false).map((p) => p.id);

  return { providers: providers.map(({ _available, ...p }: any) => p), configured };
}

export async function fetchAgentModels(signal?: AbortSignal): Promise<AgentModelCatalog> {
  const res = await fetch(apiUrl('/api/ai/agent/models'), { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(await readError(res));
  return normalizeCatalog(unwrap<any>(await res.json()));
}

export async function fetchAgentSettings(sessionId: string, signal?: AbortSignal): Promise<Partial<AgentSettings>> {
  const res = await fetch(apiUrl(`/api/ai/agent/settings?sessionId=${encodeURIComponent(sessionId)}`), {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  return unwrap<Partial<AgentSettings>>(await res.json());
}

export async function updateAgentSettings(
  body: { sessionId: string; autoMode?: boolean; model?: string },
): Promise<void> {
  const res = await fetch(apiUrl('/api/ai/agent/settings'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export { EMPTY_CATALOG };
