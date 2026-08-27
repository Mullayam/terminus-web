import { useEffect, useState } from 'react';
import { AlertTriangle, Gauge, RotateCcw } from 'lucide-react';
import { useAgentRunStore } from '@/store/agentRunStore';

type Colors = Record<string, string>;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return String(n);
}

function Section({ title, colors, children }: { title: string; colors: Colors; children: React.ReactNode }) {
  return (
    <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${colors.foreground}10` }}>
      <div
        className="px-2.5 py-1 text-[10px] font-semibold"
        style={{ backgroundColor: `${colors.foreground}08`, color: `${colors.foreground}70` }}
      >
        {title}
      </div>
      <div className="px-2.5 py-1.5 space-y-1">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  colors,
  accent,
}: {
  label: string;
  value: string;
  colors: Colors;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="truncate" style={{ color: `${colors.foreground}70` }}>
        {label}
      </span>
      <span className="tabular-nums font-medium shrink-0" style={{ color: accent ?? colors.foreground }}>
        {value}
      </span>
    </div>
  );
}

function Meter({ used, limit, colors }: { used: number; limit: number; colors: Colors }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const bar = pct >= 90 ? colors.red : pct >= 70 ? colors.yellow : colors.cyan;
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.foreground}12` }}>
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, backgroundColor: bar }}
      />
    </div>
  );
}

/** Live countdown to the next rate-limit window reset. */
function ResetIn({ at, colors }: { at: number; colors: Colors }) {
  const [left, setLeft] = useState(Math.max(0, at - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, at - Date.now())), 500);
    return () => clearInterval(id);
  }, [at]);
  if (left <= 0) return null;
  return (
    <span className="flex items-center gap-1 text-[10px] tabular-nums" style={{ color: `${colors.foreground}45` }}>
      <RotateCcw size={9} />
      resets in {(left / 1000).toFixed(0)}s
    </span>
  );
}

export function AgentUsagePanel({ sessionId, colors }: { sessionId: string; colors: Colors }) {
  const usage = useAgentRunStore((s) => s.usage[sessionId]);
  const clearUsage = useAgentRunStore((s) => s.clearUsage);
  if (!usage) return null;

  const q = usage.quota ?? {};
  const tokenLimit = q.tokenLimitPerMinute ?? 0;
  const tokensUsed = q.tokensLastMinute ?? 0;
  const tokenPct = tokenLimit > 0 ? Math.round((tokensUsed / tokenLimit) * 100) : 0;
  const blocked = (q.blockedForMs ?? 0) > 0;

  return (
    <div className="rounded-lg overflow-hidden text-xs" style={{ border: `1px solid ${colors.foreground}12` }}>
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5"
        style={{ backgroundColor: `${colors.foreground}06`, color: `${colors.foreground}90` }}
      >
        <Gauge size={12} style={{ color: colors.cyan }} />
        <span className="text-[11px] font-medium flex-1 truncate">{q.target ?? 'Usage'}</span>
        <span className="text-[11px] tabular-nums font-semibold" style={{ color: colors.cyan }}>
          {tokenPct}%
        </span>
      </div>

      <div className="p-2 space-y-2">
        {blocked && (
          <div
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px]"
            style={{ backgroundColor: `${colors.red}14`, color: colors.red }}
          >
            <AlertTriangle size={10} className="shrink-0" />
            Rate limited — retrying in {Math.ceil((q.blockedForMs ?? 0) / 1000)}s
          </div>
        )}

        <Section title="Session" colors={colors}>
          <Row label="Total tokens" value={formatTokens(usage.totalTokens)} colors={colors} />
          {usage.promptTokens > 0 && (
            <Row label="Prompt" value={formatTokens(usage.promptTokens)} colors={colors} />
          )}
          {usage.completionTokens > 0 && (
            <Row label="Completion" value={formatTokens(usage.completionTokens)} colors={colors} />
          )}
          <Row label="Requests" value={String(usage.requests)} colors={colors} />
        </Section>

        {tokenLimit > 0 && (
          <Section title="Token window" colors={colors}>
            <Row
              label="This minute"
              value={`${formatTokens(tokensUsed)} / ${formatTokens(tokenLimit)}`}
              colors={colors}
            />
            <Meter used={tokensUsed} limit={tokenLimit} colors={colors} />
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: `${colors.foreground}45` }}>
                {formatTokens(q.tokensRemaining ?? Math.max(0, tokenLimit - tokensUsed))} remaining
              </span>
              {q.windowResetsInMs != null && (
                <ResetIn at={usage.updatedAt + q.windowResetsInMs} colors={colors} />
              )}
            </div>
          </Section>
        )}

        {(q.requestLimitPerMinute || q.requestLimitPerDay) && (
          <Section title="Requests" colors={colors}>
            {q.requestLimitPerMinute ? (
              <>
                <Row
                  label="Per minute"
                  value={`${q.requestsLastMinute ?? 0} / ${q.requestLimitPerMinute}`}
                  colors={colors}
                />
                <Meter used={q.requestsLastMinute ?? 0} limit={q.requestLimitPerMinute} colors={colors} />
              </>
            ) : null}
            {q.requestLimitPerDay ? (
              <>
                <Row label="Today" value={`${q.requestsToday ?? 0} / ${q.requestLimitPerDay}`} colors={colors} />
                <Meter used={q.requestsToday ?? 0} limit={q.requestLimitPerDay} colors={colors} />
              </>
            ) : null}
          </Section>
        )}

        <button
          onClick={() => clearUsage(sessionId)}
          className="w-full py-1.5 rounded-md text-[11px] font-medium transition-colors hover:brightness-125"
          style={{
            backgroundColor: `${colors.foreground}0a`,
            color: `${colors.foreground}70`,
            border: `1px solid ${colors.foreground}12`,
          }}
        >
          Reset session counters
        </button>
      </div>
    </div>
  );
}

export default AgentUsagePanel;
