import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  HeartPulse,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Terminal as TerminalIcon,
  XCircle,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { usePanelStore } from "@/store/panelStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import type { PanelProps } from "./panels";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { Chip, ConfirmBar, IconBtn } from "./widget-parts";
import { askAI, sendToTerminal, useSilentExec } from "./widget-utils";
import {
  CATEGORIES,
  COLLECT_CMD,
  buildChecks,
  buildReport,
  fmtKb,
  fmtUptime,
  parseHealth,
  scoreOf,
  type Check as HealthCheck,
  type CheckStatus,
  type HealthData,
  type PanelLink,
} from "./health-utils";

const PANEL_NAME: Record<PanelLink, string> = {
  services: "Services",
  ports: "Ports",
  firewall: "Firewall",
  updates: "Updates",
  disk: "Disk usage",
  logs: "Logs",
};

export default function HealthPanel({ sessionId, onClose }: PanelProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host ?? "");
  const { colors } = useSessionTheme();
  const connected = status === "connected" && !!socket;
  const run = useSilentExec(connected ? socket : null, `health-${sessionId}`);

  const [data, setData] = useState<HealthData | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showLogins, setShowLogins] = useState(false);
  const [copied, setCopied] = useState(false);

  const fg = colors.foreground;
  const border = `${fg}22`;
  const gray = colors.brightBlack || `${fg}66`;
  const statusColor: Record<CheckStatus, string> = { ok: colors.green, warn: colors.yellow, fail: colors.red, unknown: gray };

  const refresh = useCallback(async () => {
    setLoading(true);
    const out = await run(COLLECT_CMD);
    if (out.trim()) {
      setData(parseHealth(out));
      setCheckedAt(Date.now());
    }
    setLoading(false);
  }, [run]);

  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  const checks = useMemo(() => (data ? buildChecks(data) : []), [data]);
  const score = useMemo(() => scoreOf(checks), [checks]);
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const report = useMemo(() => (data ? buildReport(host, data, checks) : ""), [host, data, checks]);

  const copyReport = () => {
    void navigator.clipboard?.writeText(report).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const runFix = (c: HealthCheck) => {
    if (!c.fix?.command) return;
    sendToTerminal(socket, c.fix.command);
    setConfirmId(null);
  };

  const scoreColor = score.pct >= 85 ? colors.green : score.pct >= 60 ? colors.yellow : colors.red;
  const worstDisk = data?.disks.length ? [...data.disks].sort((a, b) => b.usedPct - a.usedPct)[0] : null;
  const memUsedPct = data?.memTotalKb && data.memAvailKb !== null
    ? Math.round(((data.memTotalKb - data.memAvailKb) / data.memTotalKb) * 100)
    : null;

  const cards: { label: string; value: string; sub?: string; tone?: string }[] = data ? [
    { label: "OS", value: data.os ?? "unknown", sub: data.kernel ? `kernel ${data.kernel}` : undefined },
    { label: "Uptime", value: data.uptimeSec !== null ? fmtUptime(data.uptimeSec) : "—" },
    {
      label: "Load", value: data.load ? data.load.map((x) => x.toFixed(2)).join(" ") : "—",
      sub: data.cpus ? `${data.cpus} CPU${data.cpus > 1 ? "s" : ""}` : undefined,
      tone: data.load && data.cpus && data.load[1] / data.cpus > 1 ? colors.yellow : undefined,
    },
    {
      label: "Memory", value: memUsedPct !== null ? `${memUsedPct}% used` : "—",
      sub: data.memTotalKb ? `of ${fmtKb(data.memTotalKb)}` : undefined,
      tone: memUsedPct !== null && memUsedPct >= 90 ? colors.yellow : undefined,
    },
    {
      label: "Fullest disk", value: worstDisk ? `${worstDisk.usedPct}%` : "—",
      sub: worstDisk ? `${worstDisk.mount} · ${fmtKb(worstDisk.availKb)} free` : undefined,
      tone: worstDisk ? (worstDisk.usedPct >= 90 ? colors.red : worstDisk.usedPct >= 80 ? colors.yellow : undefined) : undefined,
    },
  ] : [];

  const statusIcon = (s: CheckStatus) => {
    const color = statusColor[s];
    if (s === "ok") return <CheckCircle2 size={14} style={{ color, flexShrink: 0 }} />;
    if (s === "warn") return <AlertTriangle size={14} style={{ color, flexShrink: 0 }} />;
    if (s === "fail") return <XCircle size={14} style={{ color, flexShrink: 0 }} />;
    return <HelpCircle size={14} style={{ color, flexShrink: 0 }} />;
  };

  const smallBtn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
    fontSize: 10, color: fg, background: "transparent", border: `1px solid ${border}`,
    borderRadius: 5, padding: "2px 7px", cursor: "pointer",
  };

  return (
    <FloatingPanel
      title="Health check"
      icon={<HeartPulse size={15} />}
      subtitle={host}
      onClose={onClose}
      width={520}
      maxHeight="84vh"
      offset={{ right: 70, top: 80 }}
      actions={
        <>
          <IconBtn fg={fg} title="Ask AI about this report" onClick={() => askAI(sessionId, report)} disabled={!data}><Sparkles size={13} /></IconBtn>
          <IconBtn fg={fg} title={copied ? "Copied" : "Copy report (Markdown)"} onClick={copyReport} disabled={!data}>
            {copied ? <Check size={13} style={{ color: colors.green }} /> : <Copy size={13} />}
          </IconBtn>
          <IconBtn fg={fg} title="Run the checks again" onClick={() => void refresh()} disabled={!connected || loading}>
            <RefreshCw size={13} style={loading ? { animation: "fpSpin 0.9s linear infinite" } : undefined} />
          </IconBtn>
        </>
      }
      footer={data ? (
        <>
          <span>{checkedAt ? `Checked ${new Date(checkedAt).toLocaleTimeString()}` : ""}</span>
          <span style={{ marginLeft: "auto" }}>
            {data.priv === "root" ? "as root" : data.priv === "sudo" ? "with sudo" : "without sudo — some checks limited"}
          </span>
        </>
      ) : undefined}
    >
      <div className="scrollbar-green" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {!connected ? (
          <PanelMessage>Session not connected.</PanelMessage>
        ) : !data ? (
          loading
            ? <PanelMessage icon={<RefreshCw size={16} style={{ animation: "fpSpin 0.9s linear infinite" }} />}>Checking the host… (this can take a few seconds)</PanelMessage>
            : <PanelMessage tone="error">The checks returned nothing. Is <code>sh</code> available?</PanelMessage>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
              {cards.map((c) => (
                <div key={c.label} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: "6px 9px", background: `${fg}08`, minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, color: `${fg}77`, textTransform: "uppercase", letterSpacing: 0.4 }}>{c.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.tone || fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.value}>{c.value}</div>
                  {c.sub && <div style={{ fontSize: 9.5, color: `${fg}66`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.sub}>{c.sub}</div>}
                </div>
              ))}
            </div>

            {/* Score */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor, fontVariantNumeric: "tabular-nums" }}>{score.pct}%</div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 10.5, color: `${fg}aa` }}>
                  {score.ok}/{score.known} checks OK
                  {fails > 0 && <span style={{ color: colors.red }}> · {fails} failing</span>}
                  {warns > 0 && <span style={{ color: colors.yellow }}> · {warns} warning{warns > 1 ? "s" : ""}</span>}
                </div>
                <div style={{ height: 5, borderRadius: 3, background: `${fg}14`, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${score.pct}%`, background: scoreColor, transition: "width 0.4s ease" }} />
                </div>
              </div>
              <Chip fg={fg} border={border} accent={colors.yellow} active={issuesOnly} onClick={() => setIssuesOnly((v) => !v)}>
                Issues only
              </Chip>
            </div>

            {/* Checks by category */}
            {CATEGORIES.map((cat) => {
              const items = checks.filter((c) => c.category === cat && (!issuesOnly || c.status === "warn" || c.status === "fail"));
              if (!items.length) return null;
              return (
                <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: `${fg}88`, textTransform: "uppercase", letterSpacing: 0.5 }}>{cat}</div>
                  {items.map((c) => (
                    <div key={c.id} style={{ border: `1px solid ${c.status === "fail" ? `${colors.red}44` : border}`, borderRadius: 8, padding: "6px 9px", background: `${fg}06`, display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                        <span style={{ marginTop: 1 }}>{statusIcon(c.status)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: fg }}>{c.title}</div>
                          {c.detail && <div style={{ fontSize: 10, color: `${fg}88`, wordBreak: "break-word" }}>{c.detail}</div>}
                        </div>
                        {c.fix && (
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            {c.fix.panel && (
                              <button style={smallBtn} onClick={() => usePanelStore.getState().openPanel(c.fix!.panel!)} title={`Open the ${PANEL_NAME[c.fix.panel]} panel`}>
                                <ExternalLink size={10} /> {c.fix.command ? PANEL_NAME[c.fix.panel] : c.fix.label}
                              </button>
                            )}
                            {c.fix.command && (
                              <button
                                style={{ ...smallBtn, borderColor: `${colors.blue}66` }}
                                onClick={() => setConfirmId(confirmId === c.id ? null : c.id)}
                                title="Shows the command first, then runs it in the terminal"
                              >
                                <TerminalIcon size={10} /> {c.fix.label}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {confirmId === c.id && c.fix?.command && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <code style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: `${fg}cc`, background: `${fg}0d`, border: `1px solid ${border}`, borderRadius: 5, padding: "4px 7px", wordBreak: "break-all" }}>
                            {c.fix.command}
                          </code>
                          {c.fix.warning && (
                            <div style={{ fontSize: 10, color: colors.yellow, display: "flex", alignItems: "center", gap: 4 }}>
                              <AlertTriangle size={11} /> {c.fix.warning}
                            </div>
                          )}
                          <ConfirmBar inline text="Run this in the terminal?" fg={fg} border={border} red={colors.red} onYes={() => runFix(c)} onNo={() => setConfirmId(null)} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {issuesOnly && fails + warns === 0 && (
              <PanelMessage icon={<CheckCircle2 size={20} style={{ color: colors.green }} />}>No issues found.</PanelMessage>
            )}

            {/* Recent logins */}
            {data.lastLogins.length > 0 && (
              <div>
                <button
                  onClick={() => setShowLogins((v) => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: `${fg}88`, textTransform: "uppercase", letterSpacing: 0.5, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {showLogins ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Recent logins
                </button>
                {showLogins && (
                  <pre className="scrollbar-green" style={{ margin: "4px 0 0", fontSize: 9.5, lineHeight: 1.5, fontFamily: "ui-monospace, monospace", color: `${fg}aa`, background: `${fg}08`, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", overflowX: "auto" }}>
                    {data.lastLogins.join("\n")}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </FloatingPanel>
  );
}
