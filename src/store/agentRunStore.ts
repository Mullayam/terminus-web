import { create } from 'zustand';
import {
  DEFAULT_TOOL_TIMEOUT_MS,
  MAX_STEPS_CAP,
  TOOL_TIMEOUT_CAP_MS,
  fetchAgentModels,
  fetchAgentProfiles,
} from '@/lib/agent/client';
import type {
  AgentCapabilityInfo,
  AgentMode,
  AgentModelInfo,
  AgentProfile,
  AgentProfilesCatalog,
  AgentQuota,
  AgentRejectedModel,
  AgentRoutingInfo,
  AgentTokenUsage,
  ToolRisk,
} from '@/lib/agent/types';

export const DEFAULT_AGENT_NAME = 'agent';

export type ToolCallStatus = 'pending' | 'awaiting-approval' | 'running' | 'done' | 'declined' | 'failed';

export interface AgentToolCall {
  callId: string;
  name: string;
  command: string;
  purpose?: string;
  risk: ToolRisk;
  requiresApproval: boolean;
  reason?: string;
  timeoutMs: number;
  /** Wall-clock ms when the backend stops waiting for a result */
  deadline: number;
  status: ToolCallStatus;
  output?: string;
  exitCode?: number;
  ok?: boolean;
}

export interface AgentRun {
  name: string;
  running: boolean;
  statusMessage: string;
  routing?: AgentRoutingInfo;
  plan: string[];
  /** Plan steps ticked off — one per completed tool call */
  planDone: number;
  text: string;
  finalText?: string;
  error?: string;
  toolCalls: AgentToolCall[];
  startedAt: number;
}

export interface AgentConfig {
  mode: AgentMode;
  profile: AgentProfile | 'auto';
  providerId: string;
  model?: string;
  maxSteps: number;
  toolTimeoutMs: number;
  autoApproveMedium: boolean;
  denyDangerous: boolean;
  /** Run `safe` commands without prompting */
  autoRunSafe: boolean;
  /** Use the server-driven agent instead of the legacy client loop */
  enabled: boolean;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  mode: 'auto',
  profile: 'auto',
  providerId: 'auto',
  model: undefined,
  maxSteps: 12,
  toolTimeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
  autoApproveMedium: false,
  denyDangerous: false,
  autoRunSafe: true,
  enabled: false,
};

/** Running totals for a session, plus the most recent provider quota snapshot. */
export interface AgentUsageState {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  /** Number of `usage` events seen — roughly the billed request count */
  requests: number;
  quota?: AgentQuota;
  updatedAt: number;
}

const EMPTY_USAGE: AgentUsageState = {
  totalTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
  requests: 0,
  updatedAt: 0,
};

interface AgentRunState {
  /** Runs keyed by sessionId → agent name */
  runs: Record<string, Record<string, AgentRun>>;
  /** Per-session run input, kept so a re-run can reuse it */
  lastInput: Record<string, string>;
  config: Record<string, AgentConfig>;
  usage: Record<string, AgentUsageState>;

  models: AgentModelInfo[];
  capabilities: Record<string, AgentCapabilityInfo>;
  rejected: AgentRejectedModel[];
  profiles: AgentProfilesCatalog['profiles'];
  modes: AgentProfilesCatalog['modes'];
  defaultTimeoutMs: number;
  catalogFetching: boolean;
  catalogFetched: boolean;
  catalogError?: string;

  fetchCatalog: (force?: boolean) => Promise<void>;
  getConfig: (sessionId: string) => AgentConfig;
  setConfig: (sessionId: string, patch: Partial<AgentConfig>) => void;

  startRun: (sessionId: string, name: string) => void;
  patchRun: (sessionId: string, name: string, patch: Partial<AgentRun>) => void;
  appendChunk: (sessionId: string, name: string, text: string) => void;
  upsertToolCall: (sessionId: string, name: string, call: AgentToolCall) => void;
  patchToolCall: (sessionId: string, name: string, callId: string, patch: Partial<AgentToolCall>) => void;
  endRun: (sessionId: string, name: string, error?: string) => void;
  setLastInput: (sessionId: string, input: string) => void;
  addUsage: (sessionId: string, usage?: AgentTokenUsage, quota?: AgentQuota) => void;
  clearUsage: (sessionId: string) => void;
  clearRuns: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
}

function withRun(
  state: AgentRunState,
  sessionId: string,
  name: string,
  update: (run: AgentRun) => AgentRun,
): Pick<AgentRunState, 'runs'> {
  const sessionRuns = state.runs[sessionId] ?? {};
  const existing = sessionRuns[name];
  if (!existing) return { runs: state.runs };
  return {
    runs: { ...state.runs, [sessionId]: { ...sessionRuns, [name]: update(existing) } },
  };
}

export const useAgentRunStore = create<AgentRunState>((set, get) => ({
  runs: {},
  lastInput: {},
  config: {},
  usage: {},

  models: [],
  capabilities: {},
  rejected: [],
  profiles: [],
  modes: [],
  defaultTimeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
  catalogFetching: false,
  catalogFetched: false,

  fetchCatalog: async (force = false) => {
    const state = get();
    if (state.catalogFetching || (state.catalogFetched && !force)) return;
    set({ catalogFetching: true, catalogError: undefined });
    try {
      const [catalog, profiles] = await Promise.all([fetchAgentModels(), fetchAgentProfiles()]);
      set({
        models: catalog.models,
        capabilities: catalog.capabilities,
        rejected: catalog.rejected,
        profiles: profiles.profiles,
        modes: profiles.modes,
        defaultTimeoutMs: profiles.defaultTimeoutMs,
        catalogFetched: true,
      });
    } catch (err: any) {
      set({ catalogError: err?.message ?? 'Failed to load agent catalog' });
    } finally {
      set({ catalogFetching: false });
    }
  },

  getConfig: (sessionId) => get().config[sessionId] ?? DEFAULT_AGENT_CONFIG,

  setConfig: (sessionId, patch) =>
    set((s) => {
      const current = s.config[sessionId] ?? DEFAULT_AGENT_CONFIG;
      const next: AgentConfig = { ...current, ...patch };
      next.maxSteps = Math.min(Math.max(1, next.maxSteps), MAX_STEPS_CAP);
      next.toolTimeoutMs = Math.min(Math.max(1000, next.toolTimeoutMs), TOOL_TIMEOUT_CAP_MS);
      return { config: { ...s.config, [sessionId]: next } };
    }),

  startRun: (sessionId, name) =>
    set((s) => ({
      runs: {
        ...s.runs,
        [sessionId]: {
          ...(s.runs[sessionId] ?? {}),
          [name]: {
            name,
            running: true,
            statusMessage: 'Starting…',
            plan: [],
            planDone: 0,
            text: '',
            toolCalls: [],
            startedAt: Date.now(),
          },
        },
      },
    })),

  patchRun: (sessionId, name, patch) =>
    set((s) => withRun(s, sessionId, name, (run) => ({ ...run, ...patch }))),

  appendChunk: (sessionId, name, text) =>
    set((s) => withRun(s, sessionId, name, (run) => ({ ...run, text: run.text + text }))),

  upsertToolCall: (sessionId, name, call) =>
    set((s) =>
      withRun(s, sessionId, name, (run) => {
        const index = run.toolCalls.findIndex((c) => c.callId === call.callId);
        if (index === -1) return { ...run, toolCalls: [...run.toolCalls, call] };
        const toolCalls = run.toolCalls.slice();
        toolCalls[index] = { ...toolCalls[index], ...call };
        return { ...run, toolCalls };
      }),
    ),

  patchToolCall: (sessionId, name, callId, patch) =>
    set((s) =>
      withRun(s, sessionId, name, (run) => ({
        ...run,
        toolCalls: run.toolCalls.map((c) => (c.callId === callId ? { ...c, ...patch } : c)),
      })),
    ),

  endRun: (sessionId, name, error) =>
    set((s) =>
      withRun(s, sessionId, name, (run) => ({
        ...run,
        running: false,
        error: error ?? run.error,
        statusMessage: error ? 'Failed' : 'Finished',
        toolCalls: run.toolCalls.map((c) =>
          c.status === 'pending' || c.status === 'running' || c.status === 'awaiting-approval'
            ? { ...c, status: 'declined' as ToolCallStatus }
            : c,
        ),
      })),
    ),

  setLastInput: (sessionId, input) => set((s) => ({ lastInput: { ...s.lastInput, [sessionId]: input } })),

  addUsage: (sessionId, usage, quota) =>
    set((s) => {
      const prev = s.usage[sessionId] ?? EMPTY_USAGE;
      return {
        usage: {
          ...s.usage,
          [sessionId]: {
            totalTokens: prev.totalTokens + (usage?.totalTokens ?? 0),
            promptTokens: prev.promptTokens + (usage?.promptTokens ?? 0),
            completionTokens: prev.completionTokens + (usage?.completionTokens ?? 0),
            requests: prev.requests + 1,
            quota: quota ?? prev.quota,
            updatedAt: Date.now(),
          },
        },
      };
    }),

  clearUsage: (sessionId) =>
    set((s) => {
      const { [sessionId]: _dropped, ...rest } = s.usage;
      return { usage: rest };
    }),

  clearRuns: (sessionId) =>
    set((s) => {
      const { [sessionId]: _dropped, ...rest } = s.runs;
      return { runs: rest };
    }),

  removeSession: (sessionId) =>
    set((s) => {
      const { [sessionId]: _runs, ...runsRest } = s.runs;
      const { [sessionId]: _config, ...configRest } = s.config;
      const { [sessionId]: _input, ...inputRest } = s.lastInput;
      const { [sessionId]: _usage, ...usageRest } = s.usage;
      return { runs: runsRest, config: configRest, lastInput: inputRest, usage: usageRest };
    }),
}));

/** Models usable by the agent (tool calling required). */
export function getAgentModels(models: AgentModelInfo[]): AgentModelInfo[] {
  return models.filter((m) => m.available !== false && m.supportsTools !== false);
}

/** Models usable for a given editor surface. */
export function getSurfaceModels(models: AgentModelInfo[], surface: 'inline' | 'hover'): AgentModelInfo[] {
  const key = surface === 'inline' ? 'supportsInline' : 'supportsHover';
  return models.filter((m) => m.available !== false && m[key] === true);
}
