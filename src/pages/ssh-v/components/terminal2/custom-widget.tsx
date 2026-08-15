import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Pause, Play, RefreshCw, X } from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import type { WidgetDef } from "@/lib/widgets/types";

interface CustomWidgetProps {
  def: WidgetDef;
  sessionId: string;
  index: number;
  onClose: () => void;
}

/** Split a line into at most `max` columns; the final column keeps the remainder. */
function splitCols(line: string, delim: string | undefined, max: number): string[] {
  const parts = delim ? line.split(delim) : line.trim().split(/\s+/);
  if (max <= 0 || parts.length <= max) return parts.map((p) => p.trim());
  const head = parts.slice(0, max - 1).map((p) => p.trim());
  head.push(parts.slice(max - 1).join(delim ?? " ").trim());
  return head;
}

export default function CustomWidget({ def, sessionId, index, onClose }: CustomWidgetProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host);
  const { colors } = useSessionTheme();

  const [output, setOutput] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const inFlightRef = useRef(false);
  const pollRef = useRef<() => void>(() => {});

  const [pos, setPos] = useState(() => ({
    x: Math.max(12, window.innerWidth - 400 - (index % 4) * 28),
    y: 90 + (index % 6) * 30,
  }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const connected = status === "connected" && !!socket;
  const auto = def.refreshMs > 0;

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

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const x = Math.min(window.innerWidth - 60, Math.max(0, e.clientX - dragRef.current.dx));
    const y = Math.min(window.innerHeight - 40, Math.max(0, e.clientY - dragRef.current.dy));
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const fg = colors.foreground;
  const bg = colors.background;
  const border = `${fg}22`;
  const accent = (colors as Record<string, string>)[def.accent ?? "cyan"] ?? colors.cyan;

  const rows = useMemo(() => {
    if (output == null || def.render !== "table") return [];
    const lines = output.split("\n").map((l) => l.replace(/\r/g, "")).filter((l) => l.trim().length > 0);
    const max = def.columns?.length ?? 0;
    return lines.slice(0, def.maxRows ?? 30).map((l) => splitCols(l, def.delimiter || undefined, max));
  }, [output, def.render, def.columns, def.delimiter, def.maxRows]);

  return (
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: 50,
        width: 380, maxHeight: "72vh", borderRadius: 12,
        background: `${bg}f2`, border: `1px solid ${border}`,
        boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}
    >
      {/* Header (drag handle) */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${border}`, cursor: "move", userSelect: "none" }}
      >
        <Boxes size={15} style={{ color: accent }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{def.name}</span>
        <span style={{ fontSize: 10, color: `${fg}66`, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host}</span>
        <div style={{ flex: 1 }} />
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => pollRef.current()} title="Refresh now" style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}>
          <RefreshCw size={13} />
        </button>
        {auto && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setPaused((p) => !p)} title={paused ? "Resume" : "Pause"} style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        )}
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="Close" style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}>
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "10px 12px", overflow: "auto" }} className="scrollbar-green">
        {!connected ? (
          <div style={{ fontSize: 12, color: `${fg}88`, textAlign: "center", padding: "12px 0" }}>Session not connected.</div>
        ) : output == null ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: `${fg}88`, padding: "12px 0" }}>
            <RefreshCw size={14} style={{ animation: "cwSpin 0.9s linear infinite" }} /> Running…
          </div>
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
              {rows.map((cells, r) => (
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

      <div style={{ display: "flex", alignItems: "center", fontSize: 10, color: `${fg}55`, padding: "6px 12px", borderTop: `1px solid ${border}` }}>
        {paused ? "Paused" : `Updated ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}`}
        <span style={{ marginLeft: "auto" }}>{auto ? `every ${def.refreshMs / 1000}s` : "manual"}</span>
      </div>

      <style>{`@keyframes cwSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
