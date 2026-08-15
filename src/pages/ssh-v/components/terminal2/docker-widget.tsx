import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Container as ContainerIcon,
  Cpu,
  MemoryStick,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { SocketEventConstants } from "@/lib/sockets/event-constants";

/**
 * One-shot command: checks for docker, then lists all containers (incl.
 * stopped) plus a single non-streaming stats sample. `docker stats` MUST use
 * --no-stream or it streams forever and hangs the exec channel. Marker lines
 * (`__SECTION__`) delimit each block for parsing; fields joined with `|`.
 */
const LIST_CMD =
  "if ! command -v docker >/dev/null 2>&1; then echo __NODOCKER__; else " +
  "echo __PS__; docker ps -a --no-trunc --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}|{{.Ports}}' 2>&1; " +
  "echo __STATS__; docker stats --no-stream --format '{{.ID}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}' 2>&1; " +
  "fi";

const POLL_MS = 4000;

const PERM_RE = /permission denied|cannot connect to the docker daemon|is the docker daemon running/i;

interface Container {
  id: string; // short (12)
  name: string;
  image: string;
  state: string; // running | exited | created | paused | ...
  status: string;
  ports: string;
  cpuPct: number | null;
  cpuRaw: string;
  memRaw: string; // used portion only
  memPct: number | null;
}

interface ParseResult {
  available: boolean;
  error: string | null;
  containers: Container[];
}

function pctNum(s: string): number | null {
  const n = parseFloat((s || "").replace("%", "").trim());
  return Number.isNaN(n) ? null : n;
}

function parseList(output: string): ParseResult {
  if (output.includes("__NODOCKER__")) {
    return { available: false, error: null, containers: [] };
  }

  const buckets: Record<string, string[]> = {};
  let section = "";
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\r/g, "");
    const marker = line.match(/^__([A-Z]+)__$/);
    if (marker) { section = marker[1]; buckets[section] = []; continue; }
    if (section) (buckets[section] ||= []).push(line);
  }

  const psLines = (buckets.PS ?? []).filter((l) => l.trim().length > 0);
  const permLine = psLines.find((l) => PERM_RE.test(l));
  if (permLine) {
    return { available: true, error: permLine.trim(), containers: [] };
  }

  // Map short id -> stats
  const stats = new Map<string, { cpu: string; mem: string; memPct: string }>();
  for (const l of buckets.STATS ?? []) {
    const p = l.split("|");
    if (p.length < 4) continue;
    stats.set(p[0].trim().slice(0, 12), { cpu: p[1], mem: p[2], memPct: p[3] });
  }

  const containers: Container[] = [];
  for (const l of psLines) {
    const p = l.split("|");
    if (p.length < 5) continue;
    const shortId = p[0].trim().slice(0, 12);
    const st = stats.get(shortId);
    const memUsed = st ? (st.mem.split("/")[0] || "").trim() : "";
    containers.push({
      id: shortId,
      name: p[1]?.trim() ?? "",
      image: p[2]?.trim() ?? "",
      state: (p[3]?.trim() ?? "").toLowerCase(),
      status: p[4]?.trim() ?? "",
      ports: p[5]?.trim() ?? "",
      cpuPct: st ? pctNum(st.cpu) : null,
      cpuRaw: st ? st.cpu.trim() : "",
      memRaw: memUsed,
      memPct: st ? pctNum(st.memPct) : null,
    });
  }
  return { available: true, error: null, containers };
}

function stateColor(state: string, colors: { green: string; yellow: string; red: string; gray: string }): string {
  if (state === "running") return colors.green;
  if (state === "paused") return colors.yellow;
  if (state === "restarting") return colors.yellow;
  return colors.gray;
}

type DockerAction = "start" | "stop" | "restart" | "rm";

interface DockerWidgetProps {
  sessionId: string;
  onClose: () => void;
}

export default function DockerWidget({ sessionId, onClose }: DockerWidgetProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host);
  const { colors } = useSessionTheme();

  const [result, setResult] = useState<ParseResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string; action: DockerAction } | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const pollRef = useRef<() => void>(() => {});

  const [pos, setPos] = useState(() => ({ x: Math.max(12, window.innerWidth - 380), y: 72 }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const connected = status === "connected" && !!socket;

  useEffect(() => {
    if (!socket || !connected || paused) return;

    const listPrefix = `dk-${sessionId}-`;
    const actPrefix = `dka-${sessionId}-`;
    let seq = 0;

    const onOutput = (payload: { requestId: string; output: string }) => {
      if (!payload || typeof payload.requestId !== "string") return;
      if (payload.requestId.startsWith(listPrefix)) {
        inFlightRef.current = false;
        setResult(parseList(payload.output ?? ""));
        setLastUpdate(Date.now());
        return;
      }
      if (payload.requestId.startsWith(actPrefix)) {
        setBusyId(null);
        const out = (payload.output ?? "").trim();
        if (out && PERM_RE.test(out)) setActionErr(out.split("\n")[0]);
        pollRef.current(); // refresh immediately after an action
      }
    };

    const poll = () => {
      if (inFlightRef.current) return; // stats sampling is slow — don't stack
      inFlightRef.current = true;
      seq += 1;
      socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId: `${listPrefix}${seq}`, cmd: LIST_CMD });
    };
    pollRef.current = poll;

    socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    poll();
    const timer = setInterval(poll, POLL_MS);

    return () => {
      clearInterval(timer);
      inFlightRef.current = false;
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    };
  }, [socket, connected, paused, sessionId]);

  const runAction = (id: string, action: DockerAction) => {
    if (!socket || !connected) return;
    setActionErr(null);
    setBusyId(id);
    const cmd = `docker ${action} ${id} 2>&1`;
    socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId: `dka-${sessionId}-${Date.now()}`, cmd });
  };

  const requestAction = (c: Container, action: DockerAction) => {
    if (action === "stop" || action === "rm") {
      setConfirm({ id: c.id, name: c.name, action });
    } else {
      runAction(c.id, action);
    }
  };

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
  const track = `${fg}14`;
  const gray = colors.brightBlack ?? `${fg}66`;
  const sc = { green: colors.green, yellow: colors.yellow, red: colors.red, gray };

  const containers = result?.containers ?? [];
  const runningCount = containers.filter((c) => c.state === "running").length;

  return (
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: 50,
        width: 360, maxHeight: "78vh", borderRadius: 12,
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
        <ContainerIcon size={15} style={{ color: colors.blue ?? colors.cyan }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: fg }}>Docker</span>
        {result?.available && (
          <span style={{ fontSize: 10, color: `${fg}66` }}>{runningCount}/{containers.length} running</span>
        )}
        <span style={{ fontSize: 10, color: `${fg}66`, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host}</span>
        <div style={{ flex: 1 }} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPaused((p) => !p)}
          title={paused ? "Resume" : "Pause"}
          style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="Close (Ctrl+Shift+D)" style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}>
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }} className="scrollbar-green">
        {!connected ? (
          <div style={{ fontSize: 12, color: `${fg}88`, textAlign: "center", padding: "12px 0" }}>Session not connected.</div>
        ) : !result ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: `${fg}88`, padding: "12px 0" }}>
            <RefreshCw size={14} style={{ animation: "dkSpin 0.9s linear infinite" }} /> Loading containers…
          </div>
        ) : !result.available ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12, color: `${fg}88`, padding: "16px 8px", textAlign: "center" }}>
            <ContainerIcon size={22} style={{ color: `${fg}55` }} />
            Docker is not installed or not on PATH for this user.
          </div>
        ) : result.error ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 11.5, color: colors.red, padding: "14px 8px", textAlign: "center" }}>
            <AlertTriangle size={20} />
            <span style={{ color: `${fg}aa` }}>{result.error}</span>
            <span style={{ fontSize: 10, color: `${fg}66` }}>The SSH user likely needs to be in the <code>docker</code> group (or use sudo).</span>
          </div>
        ) : containers.length === 0 ? (
          <div style={{ fontSize: 12, color: `${fg}88`, textAlign: "center", padding: "16px 0" }}>No containers found.</div>
        ) : (
          containers.map((c) => {
            const running = c.state === "running";
            const dot = stateColor(c.state, sc);
            const isBusy = busyId === c.id;
            return (
              <div key={c.id} style={{ border: `1px solid ${border}`, borderRadius: 9, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 6, background: `${fg}08` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: running ? `0 0 6px ${dot}` : "none" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.name}>{c.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 9.5, color: `${fg}66`, fontVariantNumeric: "tabular-nums" }}>{c.id}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: `${fg}88` }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }} title={c.image}>{c.image}</span>
                  <span style={{ marginLeft: "auto", color: dot, textTransform: "capitalize" }}>{c.state}</span>
                </div>

                {/* CPU / MEM */}
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: `${fg}aa` }}>
                      <Cpu size={11} /><span>CPU</span>
                      <span style={{ marginLeft: "auto", color: fg, fontVariantNumeric: "tabular-nums" }}>{running ? (c.cpuRaw || "…") : "—"}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: track, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, c.cpuPct ?? 0)}%`, background: colors.cyan ?? colors.green, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: `${fg}aa` }}>
                      <MemoryStick size={11} /><span>MEM</span>
                      <span style={{ marginLeft: "auto", color: fg, fontVariantNumeric: "tabular-nums" }}>{running ? (c.memRaw || "…") : "—"}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: track, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, c.memPct ?? 0)}%`, background: colors.magenta ?? colors.blue, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                </div>

                {/* Confirm bar or actions */}
                {confirm && confirm.id === c.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: fg, background: `${colors.red}18`, borderRadius: 6, padding: "5px 7px" }}>
                    <AlertTriangle size={13} style={{ color: colors.red }} />
                    <span>{confirm.action === "rm" ? "Remove" : "Stop"} “{confirm.name}”?</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button onClick={() => { runAction(confirm.id, confirm.action); setConfirm(null); }} style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: colors.red, border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>Yes</button>
                      <button onClick={() => setConfirm(null)} style={{ fontSize: 10.5, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>No</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6, marginTop: 1 }}>
                    {running ? (
                      <>
                        <ActionBtn label="Restart" icon={<RotateCcw size={12} />} disabled={isBusy} onClick={() => requestAction(c, "restart")} fg={fg} border={border} accent={colors.yellow} />
                        <ActionBtn label="Stop" icon={<Square size={12} />} disabled={isBusy} onClick={() => requestAction(c, "stop")} fg={fg} border={border} accent={colors.red} />
                      </>
                    ) : (
                      <>
                        <ActionBtn label="Start" icon={<Play size={12} />} disabled={isBusy} onClick={() => requestAction(c, "start")} fg={fg} border={border} accent={colors.green} />
                        <ActionBtn label="Remove" icon={<Trash2 size={12} />} disabled={isBusy} onClick={() => requestAction(c, "rm")} fg={fg} border={border} accent={colors.red} />
                      </>
                    )}
                    {isBusy && <RefreshCw size={13} style={{ color: `${fg}88`, alignSelf: "center", animation: "dkSpin 0.9s linear infinite" }} />}
                  </div>
                )}
              </div>
            );
          })
        )}

        {actionErr && (
          <div style={{ fontSize: 10.5, color: colors.red, display: "flex", alignItems: "center", gap: 5 }}>
            <AlertTriangle size={12} /> {actionErr}
          </div>
        )}
      </div>

      {result?.available && !result.error && (
        <div style={{ display: "flex", alignItems: "center", fontSize: 10, color: `${fg}55`, padding: "6px 12px", borderTop: `1px solid ${border}` }}>
          {paused ? "Paused" : `Updated ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}`}
          <span style={{ marginLeft: "auto" }}>every {POLL_MS / 1000}s</span>
        </div>
      )}

      <style>{`@keyframes dkSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface ActionBtnProps {
  label: string;
  icon: React.ReactNode;
  accent: string;
  fg: string;
  border: string;
  disabled?: boolean;
  onClick: () => void;
}

function ActionBtn({ label, icon, accent, fg, border, disabled, onClick }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
        fontSize: 10.5, fontWeight: 500, color: disabled ? `${fg}55` : fg,
        background: "transparent", border: `1px solid ${border}`, borderRadius: 6,
        padding: "4px 6px", cursor: disabled ? "default" : "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.borderColor = `${accent}66`; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = border; }}
    >
      <span style={{ color: accent, display: "flex" }}>{icon}</span>{label}
    </button>
  );
}
