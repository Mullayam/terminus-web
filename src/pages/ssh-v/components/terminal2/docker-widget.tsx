import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Container as ContainerIcon,
  Copy,
  Cpu,
  FileJson,
  MemoryStick,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { ActionBtn, Chip, ConfirmBar, IconBtn, MoreMenu, type MenuItem } from "./widget-parts";
import { askAI } from "./widget-utils";
import { useExecStream } from "./use-exec-stream";
import { LogPane, TailSelect, type Tail } from "./log-pane";

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
  id: string; // short (12) — hex, so safe to splice into a shell command
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
    if (!/^[0-9a-f]{12}$/.test(shortId)) continue;
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

/** `0.0.0.0:8080->80/tcp, :::8080->80/tcp` → `8080→80/tcp` (deduped across v4/v6). */
function shortPorts(ports: string): string {
  if (!ports) return "";
  const out = new Set<string>();
  for (const part of ports.split(",")) {
    const m = part.trim().match(/:(\d+(?:-\d+)?)->(\S+)$/);
    out.add(m ? `${m[1]}→${m[2]}` : part.trim());
  }
  return [...out].join("  ");
}

function stateColor(state: string, colors: { green: string; yellow: string; red: string; gray: string }): string {
  if (state === "running") return colors.green;
  if (state === "paused") return colors.yellow;
  if (state === "restarting") return colors.yellow;
  if (state === "dead") return colors.red;
  return colors.gray;
}

type DockerAction = "start" | "stop" | "restart" | "pause" | "unpause" | "kill" | "rm" | "rm-force";

const ACTION_LABEL: Record<DockerAction, string> = {
  start: "Start",
  stop: "Stop",
  restart: "Restart",
  pause: "Pause",
  unpause: "Unpause",
  kill: "Kill",
  rm: "Remove",
  "rm-force": "Force remove",
};

const DESTRUCTIVE: DockerAction[] = ["stop", "kill", "rm", "rm-force"];

function actionCmd(id: string, action: DockerAction): string {
  if (action === "rm-force") return `docker rm -f ${id} 2>&1`;
  return `docker ${action} ${id} 2>&1`;
}

function logsCmd(id: string, tail: Tail, timestamps: boolean): string {
  return `docker logs -f --tail ${tail}${timestamps ? " -t" : ""} ${id} 2>&1`;
}

type OneShotKind = "inspect" | "top";

const ONE_SHOT_CMD: Record<OneShotKind, (id: string) => string> = {
  inspect: (id) => `docker inspect ${id} 2>&1`,
  // BSD/busybox `ps` may reject -eo; fall back to docker's default columns.
  top: (id) => `docker top ${id} -eo pid,user,pcpu,pmem,etime,args 2>/dev/null || docker top ${id} 2>&1`,
};

type Pane =
  | { kind: "logs"; id: string; name: string }
  | { kind: OneShotKind; id: string; name: string; text: string | null };

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

  const [query, setQuery] = useState("");
  const [runningOnly, setRunningOnly] = useState(false);

  // Output pane (live logs, or a one-shot inspect / top)
  const [pane, setPane] = useState<Pane | null>(null);
  const [tail, setTail] = useState<Tail>("100");
  const [timestamps, setTimestamps] = useState(false);
  const [logsStopped, setLogsStopped] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [wide, setWide] = useState(false);

  const inFlightRef = useRef(false);
  const pollRef = useRef<() => void>(() => { });
  const oneShotReqRef = useRef<string | null>(null);

  const [pos, setPos] = useState(() => ({ x: Math.max(12, window.innerWidth - 380), y: 72 }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const connected = status === "connected" && !!socket;

  const logCmd = pane?.kind === "logs" && connected && !logsStopped ? logsCmd(pane.id, tail, timestamps) : null;
  const stream = useExecStream(socket, logCmd, runKey);

  // The output listener stays attached while paused so actions still resolve;
  // pausing only stops the timer.
  useEffect(() => {
    if (!socket || !connected) return;

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
      if (payload.requestId === oneShotReqRef.current) {
        const text = (payload.output ?? "").replace(/\r/g, "");
        setPane((p) => (p && p.kind !== "logs" ? { ...p, text } : p));
        return;
      }
      if (payload.requestId.startsWith(actPrefix)) {
        setBusyId(null);
        const out = (payload.output ?? "").trim();
        if (out && (PERM_RE.test(out) || /^Error/m.test(out))) setActionErr(out.split("\n")[0]);
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
    const timer = paused ? null : setInterval(poll, POLL_MS);

    return () => {
      if (timer) clearInterval(timer);
      inFlightRef.current = false;
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    };
  }, [socket, connected, paused, sessionId]);

  const runOneShot = (kind: OneShotKind, id: string) => {
    if (!socket || !connected) return;
    const requestId = `dko-${sessionId}-${Date.now()}`;
    oneShotReqRef.current = requestId;
    socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId, cmd: ONE_SHOT_CMD[kind](id) });
  };

  // Keep the process list fresh while it's open.
  const topId = pane?.kind === "top" ? pane.id : null;
  useEffect(() => {
    if (!topId || paused || !connected) return;
    const t = setInterval(() => runOneShot("top", topId), POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topId, paused, connected]);

  const runAction = (id: string, action: DockerAction) => {
    if (!socket || !connected) return;
    setActionErr(null);
    setBusyId(id);
    socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId: `dka-${sessionId}-${Date.now()}`, cmd: actionCmd(id, action) });
  };

  const requestAction = (c: Container, action: DockerAction) => {
    if (DESTRUCTIVE.includes(action)) setConfirm({ id: c.id, name: c.name, action });
    else runAction(c.id, action);
  };

  const openLogs = (c: Container) => {
    if (pane?.kind === "logs" && pane.id === c.id) {
      setPane(null);
      return;
    }
    setLogsStopped(false);
    setPane({ kind: "logs", id: c.id, name: c.name });
  };

  const openOneShot = (kind: OneShotKind, c: Container) => {
    setPane({ kind, id: c.id, name: c.name, text: null });
    runOneShot(kind, c.id);
  };

  /** Hand interactive / TTY work to the xterm. */
  const sendToTerminal = (line: string) => {
    if (!socket) return;
    socket.emit(SocketEventConstants.SSH_EMIT_INPUT, `${line}\r`);
  };
  const followInTerminal = (id: string) => sendToTerminal(`docker logs -f --tail ${tail} ${id}`);
  const execInTerminal = (id: string) =>
    sendToTerminal(`docker exec -it ${id} sh -c 'command -v bash >/dev/null 2>&1 && exec bash || exec sh'`);

  const copyText = (text: string) => { void navigator.clipboard?.writeText(text).catch(() => { }); };

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

  const containers = useMemo(() => result?.containers ?? [], [result]);
  const runningCount = containers.filter((c) => c.state === "running").length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return containers.filter((c) =>
      (!runningOnly || c.state === "running") &&
      (!q || c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q) || c.id.includes(q)),
    );
  }, [containers, query, runningOnly]);

  // Widen while the output pane is open; keep the panel on-screen.
  const width = pane ? (wide ? Math.min(980, window.innerWidth - 24) : 540) : 360;
  const left = Math.max(0, Math.min(pos.x, window.innerWidth - width - 8));

  return (
    <div
      style={{
        position: "fixed", left, top: pos.y, zIndex: 50,
        width, maxHeight: wide ? "88vh" : "78vh", borderRadius: 12,
        background: `${bg}f2`, border: `1px solid ${border}`,
        boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden", display: "flex", flexDirection: "column",
        transition: "width 0.18s ease",
      }}
    >
      {/* Header (drag handle) */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${border}`, cursor: "move", userSelect: "none", flexShrink: 0 }}
      >
        <ContainerIcon size={15} style={{ color: colors.blue }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: fg }}>Docker</span>
        {result?.available && (
          <span style={{ fontSize: 10, color: `${fg}66` }}>{runningCount}/{containers.length} running</span>
        )}
        <span style={{ fontSize: 10, color: `${fg}66`, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host}</span>
        <div style={{ flex: 1 }} />
        <IconBtn fg={fg} title="Refresh now" onClick={() => pollRef.current()}><RefreshCw size={13} /></IconBtn>
        <IconBtn fg={fg} title={paused ? "Resume polling" : "Pause polling"} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </IconBtn>
        <IconBtn fg={fg} title="Close (Ctrl+Shift+D)" onClick={onClose}><X size={15} /></IconBtn>
      </div>

      {/* Search / filter */}
      {result?.available && !result.error && containers.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, border: `1px solid ${border}`, borderRadius: 6, padding: "3px 7px" }}>
            <Search size={12} style={{ color: `${fg}66`, flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, image or id"
              spellCheck={false}
              style={{ flex: 1, minWidth: 0, fontSize: 11, color: fg, background: "transparent", border: "none", outline: "none" }}
            />
            {query && <IconBtn fg={fg} title="Clear" onClick={() => setQuery("")}><X size={11} /></IconBtn>}
          </div>
          <Chip fg={fg} border={border} accent={colors.green} active={runningOnly} onClick={() => setRunningOnly((v) => !v)}>
            Running only
          </Chip>
        </div>
      )}

      {/* Container list */}
      <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: "1 1 auto", minHeight: pane ? 90 : undefined }} className="scrollbar-green">
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
        ) : visible.length === 0 ? (
          <div style={{ fontSize: 12, color: `${fg}88`, textAlign: "center", padding: "16px 0" }}>No containers match.</div>
        ) : (
          visible.map((c) => {
            const running = c.state === "running";
            const isPaused = c.state === "paused";
            const dot = stateColor(c.state, sc);
            const isBusy = busyId === c.id;
            const selected = pane?.id === c.id;
            const logsOpen = pane?.kind === "logs" && selected;
            const ports = shortPorts(c.ports);

            const more: MenuItem[] = [
              ...(running ? [{ label: "Pause", icon: <Pause size={12} />, onClick: () => requestAction(c, "pause") }] : []),
              { label: "Exec shell in terminal", icon: <TerminalIcon size={12} />, disabled: !running, onClick: () => execInTerminal(c.id) },
              { label: "Processes (top)", icon: <Activity size={12} />, disabled: !running, onClick: () => openOneShot("top", c) },
              { label: "Inspect", icon: <FileJson size={12} />, onClick: () => openOneShot("inspect", c) },
              { label: "Follow logs in terminal", icon: <TerminalIcon size={12} />, onClick: () => followInTerminal(c.id) },
              { label: "Copy container ID", icon: <Copy size={12} />, onClick: () => copyText(c.id) },
              ...(running || isPaused
                ? [
                  { label: "Kill", icon: <Zap size={12} />, danger: true, onClick: () => requestAction(c, "kill") },
                  { label: ACTION_LABEL["rm-force"], icon: <Trash2 size={12} />, danger: true, onClick: () => requestAction(c, "rm-force") },
                ]
                : []),
            ];

            return (
              <div key={c.id} style={{ border: `1px solid ${selected ? `${colors.blue}66` : border}`, borderRadius: 9, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 6, background: `${fg}08` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: running ? `0 0 6px ${dot}` : "none" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.name}>{c.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 9.5, color: `${fg}66`, fontVariantNumeric: "tabular-nums" }}>{c.id}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: `${fg}88` }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }} title={c.image}>{c.image}</span>
                  <span style={{ marginLeft: "auto", color: dot, whiteSpace: "nowrap" }} title={c.status}>{c.status || c.state}</span>
                </div>
                {ports && (
                  <div style={{ fontSize: 9.5, color: `${fg}77`, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.ports}>
                    {ports}
                  </div>
                )}

                {/* CPU / MEM */}
                {(running || isPaused) && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Meter icon={<Cpu size={11} />} label="CPU" value={c.cpuRaw || "…"} pct={c.cpuPct} color={colors.cyan} fg={fg} track={track} />
                    <Meter icon={<MemoryStick size={11} />} label="MEM" value={c.memRaw || "…"} pct={c.memPct} color={colors.magenta} fg={fg} track={track} />
                  </div>
                )}

                {/* Confirm bar or actions */}
                {confirm && confirm.id === c.id ? (
                  <ConfirmBar
                    inline
                    text={`${ACTION_LABEL[confirm.action]} “${confirm.name}”?`}
                    fg={fg} border={border} red={colors.red}
                    onYes={() => { runAction(confirm.id, confirm.action); setConfirm(null); }}
                    onNo={() => setConfirm(null)}
                  />
                ) : (
                  <div style={{ display: "flex", gap: 6, marginTop: 1 }}>
                    {running ? (
                      <>
                        <ActionBtn label="Restart" icon={<RotateCcw size={12} />} disabled={isBusy} onClick={() => requestAction(c, "restart")} fg={fg} border={border} accent={colors.yellow} />
                        <ActionBtn label="Stop" icon={<Square size={12} />} disabled={isBusy} onClick={() => requestAction(c, "stop")} fg={fg} border={border} accent={colors.red} />
                      </>
                    ) : isPaused ? (
                      <>
                        <ActionBtn label="Unpause" icon={<Play size={12} />} disabled={isBusy} onClick={() => requestAction(c, "unpause")} fg={fg} border={border} accent={colors.green} />
                        <ActionBtn label="Stop" icon={<Square size={12} />} disabled={isBusy} onClick={() => requestAction(c, "stop")} fg={fg} border={border} accent={colors.red} />
                      </>
                    ) : (
                      <>
                        <ActionBtn label="Start" icon={<Play size={12} />} disabled={isBusy} onClick={() => requestAction(c, "start")} fg={fg} border={border} accent={colors.green} />
                        <ActionBtn label="Remove" icon={<Trash2 size={12} />} disabled={isBusy} onClick={() => requestAction(c, "rm")} fg={fg} border={border} accent={colors.red} />
                      </>
                    )}
                    <ActionBtn label="Logs" icon={<ScrollText size={12} />} active={logsOpen} onClick={() => openLogs(c)} fg={fg} border={border} accent={colors.blue} />
                    <MoreMenu items={more} fg={fg} bg={bg} border={border} disabled={isBusy} />
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

      {/* Output pane */}
      {pane && (pane.kind === "logs" ? (
        <LogPane
          kind="stream"
          title="Logs" subject={pane.name} icon={<ScrollText size={12} />}
          stream={stream}
          stopped={logsStopped}
          onStop={() => setLogsStopped(true)}
          onRestart={() => { setLogsStopped(false); setRunKey((k) => k + 1); }}
          onTerminal={() => followInTerminal(pane.id)}
          onExplain={(text) => askAI(sessionId, `Logs from container ${pane.name}:
${text}`)}
          highlight
          options={
            <>
              <TailSelect value={tail} onChange={setTail} />
              <Chip fg={fg} border={border} accent={colors.blue} active={timestamps} onClick={() => setTimestamps((t) => !t)} title="Show timestamps">
                <Clock size={11} />
              </Chip>
            </>
          }
          downloadName={`${pane.name || pane.id}-logs.log`}
          wide={wide} onToggleWide={() => setWide((w) => !w)}
          onClose={() => { setPane(null); setWide(false); }}
        />
      ) : (
        <LogPane
          kind="static"
          title={pane.kind === "top" ? "Processes" : "Inspect"} subject={pane.name}
          icon={pane.kind === "top" ? <Activity size={12} /> : <FileJson size={12} />}
          text={pane.text}
          onRefresh={() => runOneShot(pane.kind, pane.id)}
          downloadName={`${pane.name || pane.id}-${pane.kind}.${pane.kind === "inspect" ? "json" : "txt"}`}
          wide={wide} onToggleWide={() => setWide((w) => !w)}
          onClose={() => { setPane(null); setWide(false); }}
        />
      ))}

      {result?.available && !result.error && (
        <div style={{ display: "flex", alignItems: "center", fontSize: 10, color: `${fg}55`, padding: "6px 12px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          {paused ? "Paused" : `Updated ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}`}
          <span style={{ marginLeft: "auto" }}>every {POLL_MS / 1000}s</span>
        </div>
      )}

      <style>{`
        @keyframes dkSpin { to { transform: rotate(360deg); } }
        @keyframes dkPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
    </div>
  );
}

/* ── Small building blocks ──────────────────────────────────── */

function Meter({ icon, label, value, pct, color, fg, track }: {
  icon: React.ReactNode; label: string; value: string; pct: number | null; color: string; fg: string; track: string;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: `${fg}aa` }}>
        {icon}<span>{label}</span>
        <span style={{ marginLeft: "auto", color: fg, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: track, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, pct ?? 0)}%`, background: color, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}
