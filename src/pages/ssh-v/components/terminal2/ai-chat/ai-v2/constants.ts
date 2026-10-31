// Shared constants for AI Agent v2.

/** Server auto-denies a pending confirmation after this long (guide §4). */
export const CONFIRM_TIMEOUT_MS = 120_000;

/** Socket.IO namespace + event names for the agent (guide §2). */
export const AGENT_NAMESPACE = '/ai-agent';

export const AgentEventName = {
  // client → server
  PROMPT: '@@AI_AGENT_PROMPT',
  CONFIRM_REPLY: '@@AI_AGENT_CONFIRM_REPLY',
  ABORT: '@@AI_AGENT_ABORT',
  // server → client
  EVENT: '@@AI_AGENT_EVENT',
  CONFIRM_REQUEST: '@@AI_AGENT_CONFIRM_REQUEST',
} as const;

/**
 * Coerce an arbitrary payload field to a renderable string. The server's event
 * payloads aren't guaranteed to match the guide exactly (a field may arrive as
 * an object), and React throws if an object is used as a child — so everything
 * that reaches JSX goes through this first.
 */
export function toText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // Common wrappers: { text }, { message }, { data }, { name, data }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.output === 'string') return o.output;
    if (typeof o.data === 'string') return o.data;
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
