// ─────────────────────────────────────────────────────────────
// AI Agent v2 — type contract
//
// Mirrors the "AI Agent — UI Integration Guide" event contract for the
// Socket.IO `/ai-agent` namespace. The v2 module is wired to the real agent
// via agentSocket.ts; these types describe the payloads on the wire plus a
// render-ready `TranscriptItem` view the reducer builds from them.
// ─────────────────────────────────────────────────────────────

export type AgentEventKind =
  | 'MESSAGE'
  | 'COMMAND'
  | 'EXECUTE_TASK'
  | 'DANGEROUS'
  | 'OUTPUT'
  | 'ERROR'
  | 'DONE';

/** `@@AI_AGENT_EVENT` — all streamed progress. */
export interface AgentEvent {
  kind: AgentEventKind;
  /** Just `[KIND]`. */
  tag: string;
  sessionId?: string;
  payload: Record<string, any>;
  ts: number;
}

export type DangerLevel = 'safe' | 'confirm' | 'blocked';

/** `@@AI_AGENT_CONFIRM_REQUEST` — agent needs a yes/no before running. */
export interface ConfirmRequest {
  confirmId: string;
  sessionId: string;
  command: string;
  reason: string;
  level: Exclude<DangerLevel, 'safe'>;
}

// ── Model catalog (shape of GET /api/ai/agent/models → data) ──
export interface AgentModel {
  id: string;
  label: string;
}

export interface AgentProvider {
  id: string;
  label: string;
  models: AgentModel[];
}

export interface AgentModelCatalog {
  providers: AgentProvider[];
  /** provider ids that have keys set. */
  configured: string[];
}

// ── Local transcript item: a flattened, render-ready view of the stream ──
export type TranscriptItem =
  | { id: string; type: 'user'; text: string; ts: number }
  | { id: string; type: 'message'; role: 'assistant'; text: string; ts: number }
  | { id: string; type: 'command'; command: string; ts: number }
  | { id: string; type: 'task'; task: string; ts: number }
  | {
      id: string;
      type: 'output';
      command: string;
      output: string;
      exitCode: number;
      timedOut?: boolean;
      ts: number;
    }
  | {
      id: string;
      type: 'dangerous';
      command: string;
      reason: string;
      level: Exclude<DangerLevel, 'safe'>;
      resolved?: 'approved' | 'denied' | 'auto-approved';
      ts: number;
    }
  | { id: string; type: 'error'; error: string; ts: number }
  | { id: string; type: 'done'; stopped: boolean; ts: number };

export interface AgentSettings {
  autoMode: boolean;
  model: string;
}
