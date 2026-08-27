/**
 * Client for the Terminus agent API.
 *
 * `runAgent` keeps an SSE stream open while the backend waits for tool results;
 * every `tool_call` must be answered with `postAgentResult` or the run stalls.
 */

import { __config } from '@/lib/config';
import type {
  AgentEvent,
  AgentModelsCatalog,
  AgentProfilesCatalog,
  AgentResultBody,
  AgentRunBody,
} from './types';

/** Server-side caps — mirrored here so the UI never sends a rejected value. */
export const MAX_STEPS_CAP = 25;
export const TOOL_TIMEOUT_CAP_MS = 20000;
export const DEFAULT_TOOL_TIMEOUT_MS = 15000;

function apiUrl(path: string): string {
  return `${__config.API_URL.replace(/\/$/, '')}${path}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.message ?? body?.error ?? body?.data?.message;
    const valid = body?.valid ?? body?.data?.valid;
    return [detail ?? `HTTP ${res.status}`, Array.isArray(valid) ? `(valid: ${valid.join(', ')})` : '']
      .filter(Boolean)
      .join(' ');
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Backend wraps most JSON responses in `{ data: … }`. */
function unwrap<T>(json: any): T {
  return (json?.data ?? json) as T;
}

/**
 * Start an agent run and dispatch every SSE event to `onEvent`.
 * Resolves when the stream closes; rejects on a non-2xx response.
 */
export async function runAgent(
  body: AgentRunBody,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(apiUrl('/api/agent/run'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw new Error(await readError(res));
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buf = '';
  let eventType = '';
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventType = '';
      return;
    }
    const raw = dataLines.join('\n');
    dataLines = [];
    const type = eventType || 'message';
    eventType = '';
    if (raw === '[DONE]') {
      onEvent({ type: 'done' } as AgentEvent);
      return;
    }
    try {
      onEvent({ type, ...JSON.parse(raw) } as AgentEvent);
    } catch {
      onEvent({ type, text: raw } as AgentEvent);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split('\n');
      buf = lines.pop() ?? ''; // keep the partial line for the next chunk

      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '');
        if (trimmed === '') dispatch();
        else if (trimmed.startsWith('event:')) eventType = trimmed.slice(6).trim();
        else if (trimmed.startsWith('data:')) dataLines.push(trimmed.slice(5).replace(/^ /, ''));
        // ':' comments and 'id:'/'retry:' fields are ignored
      }
    }
    if (buf.startsWith('data:')) dataLines.push(buf.slice(5).replace(/^ /, ''));
    dispatch();
  } finally {
    reader.cancel().catch(() => {});
  }
}

/**
 * Post the output of an executed command.
 * Returns `false` when the backend already timed out waiting (404) — drop it.
 */
export async function postAgentResult(result: AgentResultBody): Promise<boolean> {
  const res = await fetch(apiUrl('/api/agent/result'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(await readError(res));
  return true;
}

export async function fetchAgentModels(signal?: AbortSignal): Promise<AgentModelsCatalog> {
  const res = await fetch(apiUrl('/api/agent/models'), { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(await readError(res));
  const data = unwrap<Partial<AgentModelsCatalog> & { models?: unknown }>(await res.json());
  return {
    models: Array.isArray(data?.models) ? data.models : Array.isArray(data) ? (data as any) : [],
    capabilities: data?.capabilities ?? {},
    rejected: Array.isArray(data?.rejected) ? data.rejected : [],
  };
}

export async function fetchAgentProfiles(signal?: AbortSignal): Promise<AgentProfilesCatalog> {
  const res = await fetch(apiUrl('/api/agent/profiles'), { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(await readError(res));
  const data = unwrap<Partial<AgentProfilesCatalog>>(await res.json());
  return {
    profiles: Array.isArray(data?.profiles) ? data.profiles : [],
    modes: Array.isArray(data?.modes) ? data.modes : [],
    defaultTimeoutMs: data?.defaultTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
  };
}
