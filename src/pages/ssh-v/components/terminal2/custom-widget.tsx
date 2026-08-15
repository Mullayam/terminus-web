import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, ClipboardCopy, Download, Pause, Play, RefreshCw, Search, X } from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import type { WidgetDef } from "@/lib/widgets/types";
import { evalAlert, extractValue } from "@/lib/widgets/types";

const MAX_SPARK = 48;

interface CustomWidgetProps {
  def: WidgetDef;
  sessionId: string;
  index: number;
  onClose: () => void;
  /** Render inside the dashboard grid (fills the cell, no drag/float) instead of a floating panel. */
  docked?: boolean;
}

/** Short beep via Web Audio — no asset dependency. */
let _audioCtx: AudioContext | null = null;
function beep() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    _audioCtx ||= new Ctor();
    const ctx = _audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* audio may be blocked */ }
}

/** Desktop notification (when permission granted). Edge-triggered by the caller. */
function notifyWidget(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/favicon.ico" }); } catch { /* ignore */ }
}

function csvCell(s: string): string {
  const t = s ?? "";
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function downloadText(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Split a line into at most `max` columns; the final column keeps the remainder. */
function splitCols(line: string, delim: string | undefined, max: number): string[] {
  const parts = delim ? line.split(delim) : line.trim().split(/\s+/);
  if (max <= 0 || parts.length <= max) return parts.map((p) => p.trim());
  const head = parts.slice(0, max - 1).map((p) => p.trim());
  head.push(parts.slice(max - 1).join(delim ?? " ").trim());
  return head;
}


export default function CustomWidget({ def, sessionId, index, onClose, docked = false }: CustomWidgetProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host);
  const { colors } = useSessionTheme();

  const [output, setOutput] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [alerting, setAlerting] = useState(false);
  const inFlightRef = useRef(false);
  const pollRef = useRef<() => void>(() => {});
  const valueRef = useRef<number | null>(null);
  const prevAlertRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const [pos, setPos] = useState(() => ({
    x: Math.max(12, window.innerWidth - 400 - (index % 4) * 28),
    y: 90 + (index % 6) * 30,
  }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const connected = status === "connected" && !!socket;
  const isStream = !!def.stream;
  const auto = def.refreshMs > 0;
  const isNumeric = def.render === "sparkline" || def.render === "gauge";

  // Poll the command each interval via the silent exec channel. Log/stream widgets
  // use the same channel but run a bounded snapshot (e.g. `docker logs --tail 200`)
  // and auto-scroll — a follow (`-f`) command would never return and hang the channel.
  useEffect(() => {
    if (!socket || !connected) return;

    const reqPrefix = `cw-${def.id}-${sessionId}-`;
    let seq = 0;

    const onOutput = (payload: { requestId: string; output: string }) => {
      if (!payload || typeof payload.requestId !== "string" || !payload.requestId.startsWith(reqPrefix)) return;
      inFlightRef.current = false;
      setOutput(payload.output ?? "");
      setLastUpdate(Date.now());
    };

    const poll = () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      seq += 1;
      socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId: `${reqPrefix}${seq}`, cmd: def.command });
    };
    pollRef.current = poll;

    socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    poll();
    const timer = auto && !paused ? setInterval(poll, def.refreshMs) : null;

    return () => {
      if (timer) clearInterval(timer);
      inFlightRef.current = false;
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    };
  }, [socket, connected, paused, sessionId, def.id, def.command, def.refreshMs, auto]);

  // Extract the numeric value used by sparkline/gauge/alerts.
  const currentValue = useMemo(() => {
    if (output == null || (!isNumeric && !def.alert)) return null;
    return extractValue(output, def.valuePattern);
  }, [output, isNumeric, def.alert, def.valuePattern]);
  valueRef.current = currentValue;

  // Append to the sparkline history on each new sample.
  useEffect(() => {
    if (def.render !== "sparkline" || valueRef.current == null || lastUpdate == null) return;
    const v = valueRef.current;
    setHistory((h) => {
      const next = [...h, v];
      return next.length > MAX_SPARK ? next.slice(next.length - MAX_SPARK) : next;
    });
  }, [lastUpdate, def.render]);

  // Evaluate the threshold alert; fire notify/sound only on the rising edge.
  useEffect(() => {
    const tripped = evalAlert(def.alert, output ?? "", valueRef.current);
    setAlerting(tripped);
    if (tripped && !prevAlertRef.current) {
      if (def.alert?.sound) beep();
      if (def.alert?.notify) notifyWidget(`${def.name} alert`, (output ?? "").slice(0, 120) || "Threshold crossed");
    }
    prevAlertRef.current = tripped;
  }, [output, lastUpdate, def.alert, def.name]);

  // Keep streamed logs pinned to the bottom.
  useEffect(() => {
    if (isStream && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [output, isStream]);

  const refreshNow = () => pollRef.current();


  const onPointerDown = (e: React.PointerEvent) => {
    if (docked) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (docked || !dragRef.current) return;
    const x = Math.min(window.innerWidth - 60, Math.max(0, e.clientX - dragRef.current.dx));
    const y = Math.min(window.innerHeight - 40, Math.max(0, e.clientY - dragRef.current.dy));
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (docked) return;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const fg = colors.foreground;
  const bg = colors.background;
  const border = `${fg}22`;
  const accent = (colors as Record<string, string>)[def.accent ?? "cyan"] ?? colors.cyan;
  const alertColor = colors.red;

  const rows = useMemo(() => {
    if (output == null || def.render !== "table") return [];
    const lines = output.split("\n").map((l) => l.replace(/\r/g, "")).filter((l) => l.trim().length > 0);
    const max = def.columns?.length ?? 0;
    return lines.slice(0, def.maxRows ?? 30).map((l) => splitCols(l, def.delimiter || undefined, max));
  }, [output, def.render, def.columns, def.delimiter, def.maxRows]);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((cells) => cells.some((c) => c.toLowerCase().includes(q)));
  }, [rows, filter]);

  const copyOutput = () => { navigator.clipboard?.writeText(output ?? ""); };
  const exportData = () => {
    if (def.render === "table") {
      const header = (def.columns ?? []).join(",");
      const body = filteredRows.map((r) => r.map(csvCell).join(",")).join("\n");
      downloadText(`${def.name || "widget"}.csv`, (header ? header + "\n" : "") + body, "text/csv");
    } else {
      downloadText(`${def.name || "widget"}.txt`, output ?? "", "text/plain");
    }
  };


  const containerStyle: React.CSSProperties = docked
    ? {
        position: "relative", width: "100%", height: "100%", borderRadius: 12,
        background: alerting ? `${alertColor}1a` : `${bg}f2`,
        border: `1px solid ${alerting ? alertColor : border}`,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }
    : {
        position: "fixed", left: pos.x, top: pos.y, zIndex: 50,
        width: 380, maxHeight: "72vh", borderRadius: 12,
        background: alerting ? `${alertColor}1a` : `${bg}f2`,
        border: `1px solid ${alerting ? alertColor : border}`,
        boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden", display: "flex", flexDirection: "column",
      };
  const iconBtn: React.CSSProperties = { display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 };

  return (
    <div style={containerStyle}>
      {/* Header (drag handle when floating) */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${border}`, cursor: docked ? "default" : "move", userSelect: "none" }}
      >
        <Boxes size={15} style={{ color: alerting ? alertColor : accent }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{def.name}</span>
        {isStream && <span style={{ fontSize: 8.5, color: accent, border: `1px solid ${accent}55`, borderRadius: 4, padding: "0 4px" }}>LOG</span>}
        <span style={{ fontSize: 10, color: `${fg}66`, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host}</span>
        <div style={{ flex: 1 }} />
        {def.render === "table" && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setShowFilter((v) => !v)} title="Filter rows" style={{ ...iconBtn, color: showFilter ? accent : `${fg}99` }}>
            <Search size={13} />
          </button>
        )}
        <button onPointerDown={(e) => e.stopPropagation()} onClick={copyOutput} title="Copy output" style={iconBtn}>
          <ClipboardCopy size={13} />
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={exportData} title={def.render === "table" ? "Export CSV" : "Export text"} style={iconBtn}>
          <Download size={13} />
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={refreshNow} title="Refresh now" style={iconBtn}>
          <RefreshCw size={13} />
        </button>
        {auto && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setPaused((p) => !p)} title={paused ? "Resume" : "Pause"} style={iconBtn}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        )}
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="Close" style={iconBtn}>
          <X size={15} />
        </button>
      </div>

      {def.render === "table" && showFilter && (
        <div style={{ padding: "6px 12px", borderBottom: `1px solid ${border}` }}>
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter rows…"
            style={{ width: "100%", background: `${fg}0d`, border: `1px solid ${border}`, borderRadius: 6, padding: "4px 8px", color: fg, fontSize: 11, outline: "none" }}
          />
        </div>
      )}

      {/* Body */}
      <div ref={bodyRef} style={{ padding: "10px 12px", overflow: "auto", flex: docked ? 1 : undefined }} className="scrollbar-green">
        {!connected ? (
          <div style={{ fontSize: 12, color: `${fg}88`, textAlign: "center", padding: "12px 0" }}>Session not connected.</div>
        ) : output == null ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: `${fg}88`, padding: "12px 0" }}>
            <RefreshCw size={14} style={{ animation: "cwSpin 0.9s linear infinite" }} /> {isStream ? "Tailing…" : "Running…"}
          </div>
        ) : def.render === "sparkline" ? (
          <Sparkline history={history} value={currentValue} unit={def.unit} color={alerting ? alertColor : accent} fg={fg} />
        ) : def.render === "gauge" ? (
          <Gauge value={currentValue} max={def.gaugeMax ?? 100} unit={def.unit} color={alerting ? alertColor : accent} fg={fg} />
        ) : output.trim().length === 0 ? (
          <div style={{ fontSize: 12, color: `${fg}88`, textAlign: "center", padding: "12px 0" }}>No output.</div>
        ) : def.render === "table" ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
            {def.columns && def.columns.length > 0 && (
              <thead>
                <tr>
                  {def.columns.map((c, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "3px 6px", color: accent, fontWeight: 600, borderBottom: `1px solid ${border}`, whiteSpace: "nowrap" }}>{c}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {filteredRows.map((cells, r) => (
                <tr key={r} style={{ borderBottom: `1px solid ${fg}0f` }}>
                  {cells.map((cell, c) => (
                    <td key={c} style={{ padding: "3px 6px", color: `${fg}dd`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }} title={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: `${fg}dd`, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{output.trimEnd()}</pre>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", fontSize: 10, color: alerting ? alertColor : `${fg}55`, padding: "6px 12px", borderTop: `1px solid ${border}` }}>
        {alerting ? "⚠ Alert" : paused ? "Paused" : `Updated ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}`}
        <span style={{ marginLeft: "auto" }}>{isStream ? (auto ? `tail · ${def.refreshMs / 1000}s` : "tail") : auto ? `every ${def.refreshMs / 1000}s` : "manual"}</span>
      </div>

      <style>{`@keyframes cwSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** Inline SVG sparkline with the latest value overlaid. */
function Sparkline({ history, value, unit, color, fg }: { history: number[]; value: number | null; unit?: string; color: string; fg: string }) {
  const w = 320;
  const h = 90;
  const pad = 4;
  const path = useMemo(() => {
    if (history.length < 2) return "";
    const min = Math.min(...history);
    const max = Math.max(...history);
    const span = max - min || 1;
    const step = (w - pad * 2) / (history.length - 1);
    return history
      .map((v, i) => {
        const x = pad + i * step;
        const y = h - pad - ((v - min) / span) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [history]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: fg, fontVariantNumeric: "tabular-nums" }}>{value != null ? value : "—"}</span>
        {unit && <span style={{ fontSize: 12, color: `${fg}88` }}>{unit}</span>}
      </div>
      {history.length < 2 ? (
        <div style={{ fontSize: 11, color: `${fg}66`, padding: "18px 0", textAlign: "center" }}>Collecting samples…</div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
          <path d={`${path} L${w - pad},${h} L${pad},${h} Z`} fill={`${color}22`} stroke="none" />
          <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

/** Horizontal gauge bar filled by value/max with threshold-aware color. */
function Gauge({ value, max, unit, color, fg }: { value: number | null; max: number; unit?: string; color: string; fg: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / (max || 100)));
  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: fg, fontVariantNumeric: "tabular-nums" }}>{value != null ? value : "—"}{unit && <span style={{ fontSize: 13, color: `${fg}88`, marginLeft: 3 }}>{unit}</span>}</span>
        <span style={{ fontSize: 11, color: `${fg}66` }}>/ {max}{unit ?? ""}</span>
      </div>
      <div style={{ height: 12, borderRadius: 6, background: `${fg}18`, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(pct * 100).toFixed(1)}%`, background: color, borderRadius: 6, transition: "width 0.3s ease" }} />
      </div>
      <div style={{ fontSize: 10, color: `${fg}66`, marginTop: 4, textAlign: "right" }}>{(pct * 100).toFixed(0)}%</div>
    </div>
  );
}

