/**
 * Types for the Terminus agent API (`/api/agent/*`).
 *
 * The backend proposes commands; the UI executes them and posts the output
 * back to `/api/agent/result` while the SSE stream stays open.
 */

export type AgentMode = 'auto' | 'fast' | 'thinking';
export type AgentProfile = 'linux' | 'coding' | 'reasoning';
export type ToolRisk = 'safe' | 'medium' | 'dangerous';

export const AGENT_MODES: AgentMode[] = ['auto', 'fast', 'thinking'];
export const AGENT_PROFILES: AgentProfile[] = ['linux', 'coding', 'reasoning'];

export interface AgentChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentSpec {
  name: string;
  profile?: AgentProfile;
  mode?: AgentMode;
}

export interface AgentRunBody {
  input: string;
  profile?: AgentProfile;
  mode?: AgentMode;
  /** `auto` lets the backend classifier pick provider + model */
  providerId?: string;
  model?: string;
  context?: string;
  history?: AgentChatMessage[];
  /** Capped at 25 server-side */
  maxSteps?: number;
  /** Capped at 20000 server-side */
  toolTimeoutMs?: number;
  autoApproveMedium?: boolean;
  denyDangerous?: boolean;
  agents?: AgentSpec[];
}

export interface AgentResultBody {
  callId: string;
  output?: string;
  exitCode?: number;
  declined?: boolean;
}

/* ── SSE events ─────────────────────────────────────────────── */

interface AgentEventBase {
  /** Run name — routes output to the right pane in multi-agent runs */
  agent?: string;
}

export interface AgentRoutingInfo {
  provider: string;
  model: string;
  tier?: string;
  reason?: string;
  profile?: AgentProfile;
  complexity?: string;
  capability?: string;
  signals?: string[];
}

export interface AgentTokenUsage {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

/** Provider rate-limit snapshot reported alongside usage. */
export interface AgentQuota {
  target?: string;
  tokensLastMinute?: number;
  tokenLimitPerMinute?: number;
  tokensRemaining?: number;
  requestsLastMinute?: number;
  requestLimitPerMinute?: number;
  requestsToday?: number;
  requestLimitPerDay?: number;
  windowResetsInMs?: number;
  blockedForMs?: number;
}

export type AgentEvent =
  | (AgentEventBase & { type: 'status'; message: string })
  | (AgentEventBase & { type: 'routing' } & AgentRoutingInfo)
  | (AgentEventBase & { type: 'plan'; steps: string[] })
  | (AgentEventBase & { type: 'chunk'; text: string })
  | (AgentEventBase & {
      type: 'tool_call';
      callId: string;
      name: string;
      command: string;
      purpose?: string;
      risk: ToolRisk;
      requiresApproval?: boolean;
      reason?: string;
      timeoutMs?: number;
    })
  | (AgentEventBase & {
      type: 'tool_result';
      callId: string;
      name?: string;
      ok?: boolean;
      declined?: boolean;
      output?: string;
    })
  | (AgentEventBase & { type: 'final'; text: string })
  | (AgentEventBase & { type: 'usage'; usage?: AgentTokenUsage; quota?: AgentQuota })
  | (AgentEventBase & { type: 'error'; message: string })
  | (AgentEventBase & { type: 'done' });

export type AgentToolCallEvent = Extract<AgentEvent, { type: 'tool_call' }>;

/* ── Catalog ────────────────────────────────────────────────── */

export interface AgentModelInfo {
  provider: string;
  model: string;
  label: string;
  description?: string;
  bestFor?: string[];
  tiers?: string[];
  complexity?: string;
  latencyMs?: number;
  contextWindow?: number;
  free?: boolean;
  supportsTools?: boolean;
  supportsInline?: boolean;
  supportsHover?: boolean;
  available?: boolean;
}

export interface AgentCapabilityInfo {
  label: string;
  description?: string;
}

export interface AgentRejectedModel {
  provider?: string;
  model?: string;
  reason?: string;
}

export interface AgentModelsCatalog {
  models: AgentModelInfo[];
  capabilities: Record<string, AgentCapabilityInfo>;
  rejected: AgentRejectedModel[];
}

export interface AgentProfilesCatalog {
  profiles: { id: AgentProfile; label?: string; description?: string; tools?: string[] }[];
  modes: { id: AgentMode; label?: string; description?: string }[];
  defaultTimeoutMs: number;
}
