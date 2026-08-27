import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronsUpDown,
  CircleDashed,
  Cpu,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Square,
  Terminal,
  X,
} from 'lucide-react';
import {
  DEFAULT_AGENT_CONFIG,
  getAgentModels,
  useAgentRunStore,
  type AgentRun,
  type AgentToolCall,
} from '@/store/agentRunStore';
import { AGENT_MODES, AGENT_PROFILES, type AgentMode, type AgentProfile } from '@/lib/agent/types';
import { resolveToolApproval } from './useServerAgent';

type Colors = Record<string, string>;

const RISK_COLOR: Record<string, string> = { safe: 'green', medium: 'yellow', dangerous: 'red' };

const PROFILE_LABEL: Record<AgentProfile | 'auto', string> = {
  auto: 'Auto',
  linux: 'Linux Ops',
  coding: 'Coding',
  reasoning: 'Reasoning',
};

const MODE_LABEL: Record<AgentMode, string> = { auto: 'Auto', fast: 'Fast', thinking: 'Thinking' };

/* ── Controls: mode, profile, model ─────────────────────────── */

export function AgentControls({ sessionId, colors }: { sessionId: string; colors: Colors }) {
  const config = useAgentRunStore((s) => s.config[sessionId] ?? DEFAULT_AGENT_CONFIG);
  const setConfig = useAgentRunStore((s) => s.setConfig);
  const models = useAgentRunStore((s) => s.models);
  const catalogFetching = useAgentRunStore((s) => s.catalogFetching);
  const catalogError = useAgentRunStore((s) => s.catalogError);
  const fetchCatalog = useAgentRunStore((s) => s.fetchCatalog);
  const [showModels, setShowModels] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const usable = useMemo(() => getAgentModels(models), [models]);
  const selected = usable.find((m) => m.model === config.model);

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
      {/* Mode */}
      <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${colors.foreground}18` }}>
        {AGENT_MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => setConfig(sessionId, { mode })}
            className="px-2 py-0.5 transition-colors"
            style={{
              backgroundColor: config.mode === mode ? `${colors.cyan}20` : 'transparent',
              color: config.mode === mode ? colors.cyan : `${colors.foreground}60`,
            }}
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>

      {/* Profile */}
      <select
        value={config.profile}
        onChange={(e) => setConfig(sessionId, { profile: e.target.value as AgentProfile | 'auto' })}
        className="px-1.5 py-0.5 rounded outline-none"
        style={{
          backgroundColor: `${colors.foreground}0a`,
          color: `${colors.foreground}80`,
          border: `1px solid ${colors.foreground}18`,
        }}
        title="Agent profile — which tools the agent may use"
      >
        {(['auto', ...AGENT_PROFILES] as (AgentProfile | 'auto')[]).map((p) => (
          <option key={p} value={p} style={{ backgroundColor: colors.background }}>
            {PROFILE_LABEL[p]}
          </option>
        ))}
      </select>

      {/* Model */}
      <div className="relative">
        <button
          onClick={() => setShowModels((v) => !v)}
          className="flex items-center gap-1 px-2 py-0.5 rounded transition-colors"
          style={{
            backgroundColor: `${colors.foreground}0a`,
            color: `${colors.foreground}80`,
            border: `1px solid ${colors.foreground}18`,
          }}
          title="Agent model"
        >
          <Cpu size={9} />
          <span className="max-w-[110px] truncate">{selected?.label ?? 'Auto'}</span>
          <ChevronsUpDown size={9} />
        </button>
        {showModels && (
          <div
            className="absolute right-0 top-full mt-1 z-50 rounded-lg border py-1 shadow-xl w-[280px] max-h-[320px] overflow-y-auto"
            style={{ backgroundColor: colors.background, borderColor: `${colors.foreground}20` }}
          >
            <button
              onClick={() => {
                setConfig(sessionId, { model: undefined, providerId: 'auto' });
                setShowModels(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:brightness-125"
              style={{ color: !config.model ? colors.cyan : `${colors.foreground}80` }}
            >
              <div className="font-medium">Auto</div>
              <div className="text-[9px]" style={{ color: `${colors.foreground}45` }}>
                Backend picks the fastest matching model
              </div>
            </button>
            {usable.map((m) => (
              <button
                key={`${m.provider}-${m.model}`}
                onClick={() => {
                  setConfig(sessionId, { model: m.model, providerId: m.provider });
                  setShowModels(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:brightness-125"
                style={{ color: config.model === m.model ? colors.cyan : `${colors.foreground}80` }}
                title={m.description}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{m.label}</span>
                  {typeof m.latencyMs === 'number' && (
                    <span className="text-[9px] shrink-0" style={{ color: `${colors.foreground}45` }}>
                      {m.latencyMs}ms
                    </span>
                  )}
                </div>
                {m.description && (
                  <div className="text-[9px] line-clamp-2" style={{ color: `${colors.foreground}45` }}>
                    {m.description}
                  </div>
                )}
              </button>
            ))}
            {usable.length === 0 && (
              <div className="px-3 py-2" style={{ color: `${colors.foreground}45` }}>
                {catalogFetching ? 'Loading models…' : catalogError ?? 'No models available'}
              </div>
            )}
            <RejectedModels colors={colors} />
          </div>
        )}
      </div>

      {/* Approval policy */}
      <label className="flex items-center gap-1 cursor-pointer" style={{ color: `${colors.foreground}60` }}>
        <input
          type="checkbox"
          checked={config.autoApproveMedium}
          onChange={(e) => setConfig(sessionId, { autoApproveMedium: e.target.checked })}
          className="accent-current w-3 h-3"
        />
        Auto-approve medium
      </label>
    </div>
  );
}

function RejectedModels({ colors }: { colors: Colors }) {
  const rejected = useAgentRunStore((s) => s.rejected);
  const [open, setOpen] = useState(false);
  if (rejected.length === 0) return null;
  return (
    <div className="border-t mt-1 pt-1" style={{ borderColor: `${colors.foreground}12` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-1 text-[9px]"
        style={{ color: `${colors.foreground}45` }}
      >
        {rejected.length} model{rejected.length !== 1 ? 's' : ''} excluded
      </button>
      {open &&
        rejected.map((r, i) => (
          <div key={i} className="px-3 py-0.5 text-[9px]" style={{ color: `${colors.foreground}40` }}>
            {r.model ?? 'unknown'} — {r.reason ?? 'no reason given'}
          </div>
        ))}
    </div>
  );
}

/* ── Countdown for a pending approval ───────────────────────── */

function Countdown({ deadline, colors }: { deadline: number; colors: Colors }) {
  const [left, setLeft] = useState(Math.max(0, deadline - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, deadline - Date.now())), 200);
    return () => clearInterval(id);
  }, [deadline]);
  return (
    <span className="text-[10px] tabular-nums" style={{ color: `${colors.foreground}60` }}>
      {(left / 1000).toFixed(1)}s
    </span>
  );
}

/* ── One proposed / executed command ────────────────────────── */

function ToolCallRow({ call, colors }: { call: AgentToolCall; colors: Colors }) {
  const [open, setOpen] = useState(call.status === 'awaiting-approval');
  const accent = colors[RISK_COLOR[call.risk] ?? 'cyan'] ?? colors.cyan;
  const awaiting = call.status === 'awaiting-approval';

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ border: `1px solid ${accent}22`, backgroundColor: `${accent}08` }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-left"
        style={{ color: accent }}
      >
        {call.status === 'running' ? (
          <Loader2 size={10} className="animate-spin shrink-0" />
        ) : awaiting ? (
          <ShieldAlert size={10} className="shrink-0" />
        ) : call.status === 'declined' || call.status === 'failed' ? (
          <X size={10} className="shrink-0" />
        ) : (
          <Terminal size={10} className="shrink-0" />
        )}
        <code className="flex-1 truncate text-[10px] font-mono" style={{ color: `${colors.foreground}cc` }}>
          {call.command}
        </code>
        <span
          className="px-1 rounded text-[9px] uppercase shrink-0"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          {call.risk}
        </span>
        <ChevronDown
          size={10}
          className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          style={{ color: `${colors.foreground}40` }}
        />
      </button>

      {awaiting && (
        <div className="px-2 pb-2 space-y-1.5">
          {call.reason && (
            <div className="flex items-start gap-1 text-[10px]" style={{ color: accent }}>
              <AlertTriangle size={10} className="mt-0.5 shrink-0" />
              <span>{call.reason}</span>
            </div>
          )}
          {call.purpose && (
            <div className="text-[10px]" style={{ color: `${colors.foreground}70` }}>
              {call.purpose}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => resolveToolApproval(call.callId, true)}
              className="flex-1 px-2 py-1 rounded text-[10px] font-medium hover:opacity-80"
              style={{ backgroundColor: `${colors.green}22`, color: colors.green, border: `1px solid ${colors.green}44` }}
            >
              Approve &amp; run
            </button>
            <button
              onClick={() => resolveToolApproval(call.callId, false)}
              className="flex-1 px-2 py-1 rounded text-[10px] font-medium hover:opacity-80"
              style={{ backgroundColor: `${colors.red}22`, color: colors.red, border: `1px solid ${colors.red}44` }}
            >
              Deny
            </button>
            <Countdown deadline={call.deadline} colors={colors} />
          </div>
        </div>
      )}

      {open && !awaiting && (
        <div className="px-2 pb-2 space-y-1">
          {call.purpose && (
            <div className="text-[10px]" style={{ color: `${colors.foreground}60` }}>
              {call.purpose}
            </div>
          )}
          {call.status === 'declined' && (
            <div className="text-[10px]" style={{ color: colors.red }}>
              Declined — the agent was told the command did not run.
            </div>
          )}
          {call.status === 'failed' && (
            <div className="text-[10px]" style={{ color: colors.red }}>
              Result arrived too late — the agent had already stopped waiting.
            </div>
          )}
          {call.output && (
            <pre
              className="px-2 py-1 rounded text-[10px] font-mono max-h-40 overflow-auto"
              style={{
                backgroundColor: `${colors.foreground}08`,
                color: `${colors.foreground}80`,
                border: `1px solid ${colors.foreground}10`,
              }}
            >
              {call.output}
            </pre>
          )}
          {typeof call.exitCode === 'number' && (
            <div className="text-[9px]" style={{ color: call.exitCode === 0 ? colors.green : colors.red }}>
              exit {call.exitCode}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── A single agent pane ────────────────────────────────────── */

function AgentPane({ run, colors, multi }: { run: AgentRun; colors: Colors; multi: boolean }) {
  const accent = run.error ? colors.red : run.running ? colors.cyan : colors.green;
  const body = run.finalText ?? run.text;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${accent}22`, backgroundColor: `${accent}06` }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ color: accent }}>
        {run.running ? (
          <Loader2 size={12} className="animate-spin shrink-0" />
        ) : run.error ? (
          <ShieldAlert size={12} className="shrink-0" />
        ) : (
          <ShieldCheck size={12} className="shrink-0" />
        )}
        <span className="text-[11px] font-medium truncate">
          {multi ? `${run.name} — ` : ''}
          {run.error ?? run.statusMessage}
        </span>
      </div>

      {run.routing && (
        <div
          className="px-3 pb-2 flex items-center gap-1.5 flex-wrap text-[9px]"
          style={{ color: `${colors.foreground}55` }}
          title={run.routing.reason}
        >
          <span
            className="px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${colors.blue}18`, color: colors.blue }}
          >
            {run.routing.provider}/{run.routing.model}
          </span>
          {run.routing.tier && <span>{run.routing.tier}</span>}
          {run.routing.capability && <span>· {run.routing.capability}</span>}
          {run.routing.reason && <span className="w-full">{run.routing.reason}</span>}
        </div>
      )}

      {run.plan.length > 0 && (
        <div className="px-3 pb-2 space-y-0.5">
          {run.plan.map((step, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px]" style={{ color: `${colors.foreground}80` }}>
              {i < run.planDone ? (
                <Check size={10} className="mt-0.5 shrink-0" style={{ color: colors.green }} />
              ) : (
                <CircleDashed size={10} className="mt-0.5 shrink-0" style={{ color: `${colors.foreground}35` }} />
              )}
              <span style={{ textDecoration: i < run.planDone ? 'line-through' : undefined }}>{step}</span>
            </div>
          ))}
        </div>
      )}

      {run.toolCalls.length > 0 && (
        <div className="px-2 pb-2 space-y-1">
          {run.toolCalls.map((call) => (
            <ToolCallRow key={call.callId} call={call} colors={colors} />
          ))}
        </div>
      )}

      {body && (
        <div
          className="px-3 pb-2 text-[11px] leading-relaxed whitespace-pre-wrap"
          style={{ color: `${colors.foreground}dd` }}
        >
          {body}
        </div>
      )}
    </div>
  );
}

/* ── All panes for a session ────────────────────────────────── */

export function AgentRuns({
  sessionId,
  colors,
  onStop,
}: {
  sessionId: string;
  colors: Colors;
  onStop: () => void;
}) {
  const runs = useAgentRunStore((s) => s.runs[sessionId]);
  const list = useMemo(() => Object.values(runs ?? {}), [runs]);
  if (list.length === 0) return null;

  const anyRunning = list.some((r) => r.running);

  return (
    <div className="space-y-2">
      {list.map((run) => (
        <AgentPane key={run.name} run={run} colors={colors} multi={list.length > 1} />
      ))}
      {anyRunning && (
        <button
          onClick={onStop}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] hover:brightness-125"
          style={{ backgroundColor: `${colors.red}18`, color: colors.red }}
        >
          <Square size={9} />
          Stop agent
        </button>
      )}
    </div>
  );
}
