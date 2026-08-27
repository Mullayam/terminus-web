import { useState } from 'react';
import {
  ChevronDown,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Square,
} from 'lucide-react';
import stripAnsi from 'strip-ansi';
import type { AIChatMessage, AgentAction } from '@/store/aiChatStore';
import { resolveAgentApproval } from './useAgentExecutor';

const AGENT_ICONS: Record<AgentAction, { icon: typeof Play; color: string; spin?: boolean }> = {
  executing: { icon: Loader2, color: 'cyan', spin: true },
  waiting: { icon: Loader2, color: 'yellow', spin: true },
  success: { icon: ShieldCheck, color: 'green' },
  error: { icon: ShieldOff, color: 'red' },
  replanning: { icon: RefreshCw, color: 'yellow', spin: true },
  blocked: { icon: ShieldOff, color: 'red' },
  stopped: { icon: Square, color: 'foreground' },
  info: { icon: Shield, color: 'cyan' },
  confirm: { icon: ShieldAlert, color: 'yellow' },
};

/** A single agent step — shown inside the accordion */
function AgentStepRow({ msg, colors }: { msg: AIChatMessage; colors: Record<string, string> }) {
  const action = msg.agentAction ?? 'info';
  const iconDef = AGENT_ICONS[action] ?? AGENT_ICONS.info;
  const IconComp = iconDef.icon;
  const iconColor = colors[iconDef.color] ?? `${colors.foreground}80`;
  const [detailOpen, setDetailOpen] = useState(false);
  const hasDetail = !!(msg.agentCommand || msg.agentOutput);

  return (
    <div className="py-1">
      <button
        onClick={() => hasDetail && setDetailOpen((v) => !v)}
        className={`flex items-center gap-2 w-full text-left text-[10px] px-2 py-1 rounded transition-colors ${hasDetail ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'}`}
        style={{ color: iconColor }}
      >
        <IconComp size={10} className={iconDef.spin ? 'animate-spin' : ''} style={{ color: iconColor }} />
        <span className="flex-1 truncate" style={{ color: `${colors.foreground}bb` }}>
          {msg.agentStep ? `Step ${msg.agentStep}: ` : ''}
          {stripAnsi(msg.content ?? '')}
        </span>
        {hasDetail && (
          <ChevronDown
            size={10}
            className={`shrink-0 transition-transform ${detailOpen ? 'rotate-0' : '-rotate-90'}`}
            style={{ color: `${colors.foreground}40` }}
          />
        )}
      </button>
      {detailOpen && (
        <div className="ml-6 mt-1 space-y-1">
          {msg.agentCommand && (
            <pre
              className="px-2 py-1 rounded text-[10px] font-mono overflow-x-auto"
              style={{
                backgroundColor: `${colors.foreground}06`,
                color: colors.green ?? colors.foreground,
                border: `1px solid ${colors.foreground}10`,
              }}
            >
              $ {stripAnsi(msg.agentCommand)}
            </pre>
          )}
          {msg.agentOutput && (
            <pre
              className="px-2 py-1 rounded text-[10px] font-mono overflow-x-auto max-h-32 overflow-y-auto"
              style={{
                backgroundColor: `${colors.foreground}06`,
                color: `${colors.foreground}80`,
                border: `1px solid ${colors.foreground}10`,
              }}
            >
              {stripAnsi(msg.agentOutput)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/** Accordion that groups the agent messages of one run */
export function AgentAccordion({
  agentMessages,
  colors,
  forceRunning = false,
}: {
  agentMessages: AIChatMessage[];
  colors: Record<string, string>;
  forceRunning?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (agentMessages.length === 0) return null;

  // Determine overall status from the last message
  const last = agentMessages[agentMessages.length - 1];
  const lastAction = last.agentAction ?? 'info';
  const isRunning =
    forceRunning || lastAction === 'executing' || lastAction === 'waiting' || lastAction === 'replanning';
  const isDone = lastAction === 'success';
  const isError = lastAction === 'error' || lastAction === 'blocked';
  const isStopped = lastAction === 'stopped';
  const isAwaitingApproval = lastAction === 'confirm';

  const accentColor = isAwaitingApproval
    ? colors.yellow ?? colors.cyan
    : isRunning
      ? colors.cyan
      : isDone
        ? colors.green
        : isError
          ? colors.red
          : isStopped
            ? `${colors.foreground}60`
            : `${colors.foreground}80`;

  // Summary label. Prefer the run-total stamped on the final message; fall back
  // to this group's own executed-command count (each accordion is one segment of
  // a run that may be split by interleaved assistant messages).
  const totalSteps = agentMessages.filter((m) => m.agentCommand).length;
  const executedCount = last.agentTotalCommands ?? totalSteps;
  const label = isAwaitingApproval
    ? 'Agent needs your approval'
    : isRunning
      ? `Agent working — step ${last.agentStep ?? '?'}`
      : isDone
        ? `Agent completed — ${executedCount} command${executedCount !== 1 ? 's' : ''} executed`
        : isError
          ? `Agent error at step ${last.agentStep ?? '?'}`
          : isStopped
            ? 'Agent stopped by user'
            : `Agent — ${agentMessages.length} step${agentMessages.length !== 1 ? 's' : ''}`;

  return (
    <div
      className="rounded-lg overflow-hidden text-xs"
      style={{ backgroundColor: `${accentColor}06`, border: `1px solid ${accentColor}18` }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors hover:bg-white/5"
        style={{ color: accentColor }}
      >
        {isRunning ? (
          <Loader2 size={12} className="animate-spin shrink-0" />
        ) : isAwaitingApproval ? (
          <ShieldAlert size={12} className="shrink-0" />
        ) : isDone ? (
          <ShieldCheck size={12} className="shrink-0" />
        ) : isError ? (
          <ShieldOff size={12} className="shrink-0" />
        ) : isStopped ? (
          <Square size={12} className="shrink-0" />
        ) : (
          <Shield size={12} className="shrink-0" />
        )}
        <span className="flex-1 text-[11px] font-medium truncate">{label}</span>
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
          style={{ color: `${colors.foreground}40` }}
        />
      </button>
      {isAwaitingApproval && last.agentApprovalId && (
        <div
          className="px-3 py-2.5 border-t"
          style={{ borderColor: `${accentColor}20`, backgroundColor: `${accentColor}0a` }}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium mb-1.5" style={{ color: accentColor }}>
            <ShieldAlert size={12} className="shrink-0" />
            Approval required — risky command
          </div>
          {last.agentCommand && (
            <pre
              className="px-2 py-1 rounded text-[10px] font-mono overflow-x-auto mb-2"
              style={{
                backgroundColor: `${colors.foreground}0a`,
                color: colors.red ?? colors.foreground,
                border: `1px solid ${colors.foreground}12`,
              }}
            >
              $ {stripAnsi(last.agentCommand)}
            </pre>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => resolveAgentApproval(last.agentApprovalId!, true)}
              className="flex-1 px-2 py-1 rounded text-[11px] font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: `${colors.green}22`, color: colors.green, border: `1px solid ${colors.green}44` }}
            >
              Allow
            </button>
            <button
              onClick={() => resolveAgentApproval(last.agentApprovalId!, false)}
              className="flex-1 px-2 py-1 rounded text-[11px] font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: `${colors.red}22`, color: colors.red, border: `1px solid ${colors.red}44` }}
            >
              Deny
            </button>
          </div>
        </div>
      )}
      {expanded && (
        <div className="px-2 pb-2 border-t" style={{ borderColor: `${accentColor}15` }}>
          {agentMessages.map((msg) => (
            <AgentStepRow key={msg.id} msg={msg} colors={colors} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentAccordion;
