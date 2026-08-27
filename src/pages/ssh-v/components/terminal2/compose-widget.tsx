import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowDownToLine,
  ChevronDown,
  Download,
  Hammer,
  Layers,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useTerminalStore } from "@/store/terminalStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { SocketEventConstants } from "@/lib/sockets/event-constants";

const POLL_MS = 6000;
const LOG_TAIL = 200;

const PERM_RE = /permission denied|cannot connect to the docker daemon|is the docker daemon running/i;

/** Single-quote a value for POSIX shells. Service names come from compose files. */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Quote a path but keep a leading `~` expandable, since quoting suppresses it. */
function shQuotePath(value: string): string {
  const v = value.trim();
  if (v === "~") return `"$HOME"`;
  if (v.startsWith("~/")) return `"$HOME"${shQuote(v.slice(1))}`;
  return shQuote(v);
}

/** `docker compose` (v2) with a fallback to the legacy `docker-compose` binary. */
function composeBin(): string {
  return "$(command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && echo 'docker compose' || echo 'docker-compose')";
}

function discoverCmd(root: string): string {
  const r = shQuotePath(root);
  return (
    "if ! command -v docker >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then echo __NODOCKER__; else " +
    `find -L ${r} -maxdepth 3 \\( -name 'docker-compose*.y*ml' -o -name 'compose*.y*ml' \\) ` +
    "-not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -n 20; fi"
  );
}

/**
 * `ps --format json` emits either a JSON array or one object per line depending
 * on the Compose version, so both shapes are parsed. `config --services` is the
 * fallback list so services that have never been started still show up.
 */
function servicesCmd(file: string): string {
  const f = shQuote(file);
  return (
    `echo __SERVICES__; ${composeBin()} -f ${f} config --services 2>&1; ` +
    `echo __PS__; ${composeBin()} -f ${f} ps --format json 2>&1`
  );
}

export type ComposeAction =
  | "up"
  | "up-build"
  | "recreate"
  | "start"
  | "stop"
  | "restart"
  | "build"
  | "build-nocache"
  | "pull"
  | "rm"
  | "down"
  | "down-volumes";

const ACTION_LABEL: Record<ComposeAction, string> = {
  "up": "Up",
  "up-build": "Up (rebuild)",
  "recreate": "Force recreate",
  "start": "Start",
  "stop": "Stop",
  "restart": "Restart",
  "build": "Build",
  "build-nocache": "Build (no cache)",
  "pull": "Pull images",
  "rm": "Remove container",
  "down": "Down",
  "down-volumes": "Down + volumes",
};

const DESTRUCTIVE: ComposeAction[] = ["down", "down-volumes", "stop", "recreate", "rm"];

/** An omitted `service` targets the whole stack. */
function actionCmd(file: string, action: ComposeAction, service?: string): string {
  const f = shQuote(file);
  const s = service ? ` ${shQuote(service)}` : "";
  const bin = `${composeBin()} -f ${f}`;
  switch (action) {
    case "up": return `${bin} up -d${s} 2>&1`;
    case "up-build": return `${bin} up -d --build${s} 2>&1`;
    case "recreate": return `${bin} up -d --force-recreate${s} 2>&1`;
    case "start": return `${bin} start${s} 2>&1`;
    case "stop": return `${bin} stop${s} 2>&1`;
    case "restart": return `${bin} restart${s} 2>&1`;
    case "build": return `${bin} build${s} 2>&1`;
    case "build-nocache": return `${bin} build --no-cache --pull${s} 2>&1`;
    case "pull": return `${bin} pull${s} 2>&1`;
    case "rm": return `${bin} rm -f -s -v${s} 2>&1`;
    case "down": return `${bin} down --remove-orphans 2>&1`;
    case "down-volumes": return `${bin} down -v --remove-orphans 2>&1`;
  }
}

function logsCmd(file: string, service?: string): string {
  const s = service ? ` ${shQuote(service)}` : "";
  return `${composeBin()} -f ${shQuote(file)} logs --tail ${LOG_TAIL} --no-color${s} 2>&1`;
}

interface Service {
  name: string;
  state: string;
  status: string;
  ports: string;
}

interface ParseResult {
  available: boolean;
  error: string | null;
  services: Service[];
}

function parseServices(output: string): ParseResult {
  if (output.includes("__NODOCKER__")) return { available: false, error: null, services: [] };

  const buckets: Record<string, string[]> = {};
  let section = "";
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\r/g, "");
    const marker = line.match(/^__([A-Z]+)__$/);
    if (marker) { section = marker[1]; buckets[section] = []; continue; }
    if (section) (buckets[section] ||= []).push(line);
  }

  const configLines = (buckets.SERVICES ?? []).map((l) => l.trim()).filter(Boolean);
  const permLine = [...configLines, ...(buckets.PS ?? [])].find((l) => PERM_RE.test(l));
  if (permLine) return { available: true, error: permLine.trim(), services: [] };

  // `config --services` failing means the file is unreadable or invalid YAML.
  const configErr = configLines.find((l) => /^(error|failed|no such file|yaml:)/i.test(l));
  if (configErr) return { available: true, error: configErr, services: [] };

  const byName = new Map<string, Service>();
  for (const name of configLines) {
    if (/\s/.test(name)) continue; // not a bare service name
    byName.set(name, { name, state: "not created", status: "", ports: "" });
  }

  for (const line of buckets.PS ?? []) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const rows: any[] = [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) rows.push(...parsed);
      else rows.push(parsed);
    } catch {
      continue; // non-JSON noise (warnings, progress lines)
    }
    for (const row of rows) {
      const name = row?.Service ?? row?.service ?? row?.Name ?? row?.name;
      if (!name) continue;
      byName.set(String(name), {
        name: String(name),
        state: String(row?.State ?? row?.state ?? "").toLowerCase(),
        status: String(row?.Status ?? row?.status ?? ""),
        ports: String(row?.Publishers ? formatPublishers(row.Publishers) : row?.Ports ?? row?.ports ?? ""),
      });
    }
  }

  return { available: true, error: null, services: [...byName.values()] };
}

function formatPublishers(pubs: any): string {
  if (!Array.isArray(pubs)) return "";
  return pubs
    .filter((p) => p?.PublishedPort)
    .map((p) => `${p.PublishedPort}→${p.TargetPort}`)
    .join(", ");
}

function stateColor(state: string, c: { green: string; yellow: string; red: string; gray: string }): string {
  if (state.startsWith("running")) return c.green;
  if (state.startsWith("restarting") || state.startsWith("paused")) return c.yellow;
  if (state.startsWith("exited") || state.startsWith("dead")) return c.red;
  return c.gray;
}

interface ComposeWidgetProps {
  sessionId: string;
  onClose: () => void;
}

export default function ComposeWidget({ sessionId, onClose }: ComposeWidgetProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const shellCwd = useTerminalStore((s) => s.cwd[sessionId]);
  const { colors } = useSessionTheme();

  const [root, setRoot] = useState(shellCwd ?? "~");
  const [rootDraft, setRootDraft] = useState(root);
  const [files, setFiles] = useState<string[] | null>(null);
  const [noDocker, setNoDocker] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: ComposeAction; service?: string } | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ service?: string; text: string } | null>(null);

  const inFlightRef = useRef(false);
  const pollRef = useRef<() => void>(() => { });
  const logBodyRef = useRef<HTMLPreElement | null>(null);

  const [pos, setPos] = useState(() => ({ x: Math.max(12, window.innerWidth - 420), y: 96 }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const connected = status === "connected" && !!socket;

  // Adopt the shell's cwd until the user overrides the root by hand.
  const rootTouchedRef = useRef(false);
  useEffect(() => {
    if (!shellCwd || rootTouchedRef.current) return;
    setRoot(shellCwd);
    setRootDraft(shellCwd);
  }, [shellCwd]);

  // Discover compose files under the root.
  useEffect(() => {
    if (!socket || !connected) return;
    const reqId = `cmpf-${sessionId}-${Date.now()}`;

    const onOutput = (payload: { requestId: string; output: string }) => {
      if (payload?.requestId !== reqId) return;
      const out = payload.output ?? "";
      if (out.includes("__NODOCKER__")) {
        setNoDocker(true);
        setFiles([]);
        return;
      }
      setNoDocker(false);
      const found = out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("find:"));
      setFiles(found);
      setFile((prev) => (prev && found.includes(prev) ? prev : found[0] ?? null));
      if (found.length === 0) setResult(null);
    };

    socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId: reqId, cmd: discoverCmd(root) });
    return () => { socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput); };
  }, [socket, connected, sessionId, root]);

  // Poll the selected stack's services.
  useEffect(() => {
    if (!socket || !connected || !file) return;

    const listPrefix = `cmps-${sessionId}-`;
    const actPrefix = `cmpa-${sessionId}-`;
    const logPrefix = `cmpl-${sessionId}-`;
    let seq = 0;

    const onOutput = (payload: { requestId: string; output: string }) => {
      if (!payload || typeof payload.requestId !== "string") return;
      if (payload.requestId.startsWith(listPrefix)) {
        inFlightRef.current = false;
        setResult(parseServices(payload.output ?? ""));
        setLastUpdate(Date.now());
        return;
      }
      if (payload.requestId.startsWith(logPrefix)) {
        setBusy(null);
        setLogs((l) => ({ service: l?.service, text: payload.output ?? "" }));
        return;
      }
      if (payload.requestId.startsWith(actPrefix)) {
        setBusy(null);
        const out = (payload.output ?? "").trim();
        if (out && PERM_RE.test(out)) setActionErr(out.split("\n")[0]);
        pollRef.current();
      }
    };

    const poll = () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      seq += 1;
      socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId: `${listPrefix}${seq}`, cmd: servicesCmd(file) });
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
  }, [socket, connected, paused, sessionId, file]);

  useEffect(() => {
    if (logs && logBodyRef.current) logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
  }, [logs]);

  const runAction = (action: ComposeAction, service?: string) => {
    if (!socket || !connected || !file) return;
    setActionErr(null);
    setBusy(service ?? "__stack__");
    socket.emit(SocketEventConstants.SSH_EXEC_SILENT, {
      requestId: `cmpa-${sessionId}-${Date.now()}`,
      cmd: actionCmd(file, action, service),
    });
  };

  const requestAction = (action: ComposeAction, service?: string) => {
    if (DESTRUCTIVE.includes(action)) setConfirm({ action, service });
    else runAction(action, service);
  };

  const openLogs = (service?: string) => {
    if (!socket || !connected || !file) return;
    setBusy(service ?? "__stack__");
    setLogs({ service, text: "" });
    socket.emit(SocketEventConstants.SSH_EXEC_SILENT, {
      requestId: `cmpl-${sessionId}-${Date.now()}`,
      cmd: logsCmd(file, service),
    });
  };

  /** Live follow can't use the exec channel (never returns) — send it to the xterm. */
  const followInTerminal = (service?: string) => {
    if (!socket || !file) return;
    const s = service ? ` ${shQuote(service)}` : "";
    socket.emit(
      SocketEventConstants.SSH_EMIT_INPUT,
      `${composeBin()} -f ${shQuote(file)} logs -f --tail 100${s}\r`,
    );
  };

  /** Interactive shells need a TTY, so exec is handed to the xterm too. */
  const execInTerminal = (service: string) => {
    if (!socket || !file) return;
    socket.emit(
      SocketEventConstants.SSH_EMIT_INPUT,
      `${composeBin()} -f ${shQuote(file)} exec ${shQuote(service)} ` +
      `sh -c 'command -v bash >/dev/null 2>&1 && exec bash || exec sh'\r`,
    );
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: Math.min(window.innerWidth - 60, Math.max(0, e.clientX - dragRef.current.dx)),
      y: Math.min(window.innerHeight - 40, Math.max(0, e.clientY - dragRef.current.dy)),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const fg = colors.foreground;
  const bg = colors.background;
  const border = `${fg}22`;
  const gray = colors.brightBlack ?? `${fg}66`;
  const sc = { green: colors.green, yellow: colors.yellow, red: colors.red, gray };

  const services = result?.services ?? [];
  const upCount = useMemo(() => services.filter((s) => s.state.startsWith("running")).length, [services]);
  const stackBusy = busy === "__stack__";

  const shortFile = (f: string) => f.replace(/^.*\/([^/]+\/[^/]+)$/, "$1");

  return (
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: 50,
        width: 400, maxHeight: "80vh", borderRadius: 12,
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
        <Layers size={15} style={{ color: colors.blue }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: fg }}>Compose</span>
        {result?.available && !result.error && services.length > 0 && (
          <span style={{ fontSize: 10, color: `${fg}66` }}>{upCount}/{services.length} up</span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPaused((p) => !p)}
          title={paused ? "Resume" : "Pause"}
          style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => pollRef.current()}
          title="Refresh"
          style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}
        >
          <RefreshCw size={14} />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          title="Close"
          style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Scan root + file picker */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", borderBottom: `1px solid ${border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: `${fg}66`, flexShrink: 0 }}>Scan</span>
          <input
            value={rootDraft}
            onChange={(e) => setRootDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              rootTouchedRef.current = true;
              setRoot(rootDraft.trim() || "~");
            }}
            onBlur={() => {
              if (rootDraft.trim() === root) return;
              rootTouchedRef.current = true;
              setRoot(rootDraft.trim() || "~");
            }}
            placeholder="~"
            style={{
              flex: 1, minWidth: 0, fontSize: 11, fontFamily: "ui-monospace, monospace",
              background: `${fg}0a`, border: `1px solid ${border}`, borderRadius: 6,
              padding: "3px 7px", color: fg, outline: "none",
            }}
          />
          {shellCwd && rootTouchedRef.current && (
            <button
              onClick={() => { rootTouchedRef.current = false; setRoot(shellCwd); setRootDraft(shellCwd); }}
              title="Use the terminal's current directory"
              style={{ display: "flex", background: "transparent", border: "none", color: `${fg}88`, cursor: "pointer", padding: 2 }}
            >
              <ArrowDownToLine size={13} />
            </button>
          )}
        </div>

        {files && files.length > 1 && (
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <select
              value={file ?? ""}
              onChange={(e) => { setFile(e.target.value); setResult(null); setLogs(null); }}
              style={{
                flex: 1, fontSize: 11, fontFamily: "ui-monospace, monospace",
                background: `${fg}0a`, border: `1px solid ${border}`, borderRadius: 6,
                padding: "3px 7px", color: fg, outline: "none", appearance: "none",
              }}
            >
              {files.map((f) => (
                <option key={f} value={f} style={{ background: bg, color: fg }}>{shortFile(f)}</option>
              ))}
            </select>
            <ChevronDown size={12} style={{ position: "absolute", right: 7, pointerEvents: "none", color: `${fg}66` }} />
          </div>
        )}
        {files && files.length === 1 && (
          <span style={{ fontSize: 10, color: `${fg}66`, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={files[0]}>
            {shortFile(files[0])}
          </span>
        )}
      </div>

      {/* Stack actions */}
      {file && result?.available && !result.error && (
        <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: `1px solid ${border}` }}>
          <ActionBtn label="Up" icon={<Play size={12} />} disabled={stackBusy} onClick={() => requestAction("up")} fg={fg} border={border} accent={colors.green} />
          <ActionBtn label="Down" icon={<Trash2 size={12} />} disabled={stackBusy} onClick={() => requestAction("down")} fg={fg} border={border} accent={colors.red} />
          <ActionBtn label="Restart" icon={<RotateCcw size={12} />} disabled={stackBusy} onClick={() => requestAction("restart")} fg={fg} border={border} accent={colors.yellow} />
          <ActionBtn label="Build" icon={<Hammer size={12} />} disabled={stackBusy} onClick={() => requestAction("build")} fg={fg} border={border} accent={colors.cyan} />
          <ActionBtn label="Logs" icon={<ScrollText size={12} />} disabled={stackBusy} onClick={() => openLogs()} fg={fg} border={border} accent={colors.blue} />
          <MoreMenu
            fg={fg} bg={bg} border={border} disabled={stackBusy}
            items={[
              { label: ACTION_LABEL["up-build"], icon: <Hammer size={12} />, onClick: () => requestAction("up-build") },
              { label: ACTION_LABEL["recreate"], icon: <Zap size={12} />, onClick: () => requestAction("recreate") },
              { label: ACTION_LABEL["build-nocache"], icon: <Hammer size={12} />, onClick: () => requestAction("build-nocache") },
              { label: ACTION_LABEL["pull"], icon: <Download size={12} />, onClick: () => requestAction("pull") },
              { label: "Start stopped", icon: <Play size={12} />, onClick: () => requestAction("start") },
              { label: "Stop all", icon: <Square size={12} />, onClick: () => requestAction("stop") },
              { label: ACTION_LABEL["rm"], icon: <Trash2 size={12} />, danger: true, onClick: () => requestAction("rm") },
              { label: ACTION_LABEL["down-volumes"], icon: <Trash2 size={12} />, danger: true, onClick: () => requestAction("down-volumes") },
              { label: "Follow logs in terminal", icon: <TerminalIcon size={12} />, onClick: () => followInTerminal() },
            ]}
          />
        </div>
      )}

      {/* Stack-level confirm */}
      {confirm && !confirm.service && (
        <ConfirmBar
          text={`${ACTION_LABEL[confirm.action]} the whole stack?`}
          fg={fg} border={border} red={colors.red}
          onYes={() => { runAction(confirm.action); setConfirm(null); }}
          onNo={() => setConfirm(null)}
        />
      )}

      {/* Body */}
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }} className="scrollbar-green">
        {!connected ? (
          <Empty fg={fg}>Session not connected.</Empty>
        ) : noDocker ? (
          <Empty fg={fg} icon={<Layers size={22} style={{ color: `${fg}55` }} />}>
            Docker Compose is not installed or not on PATH for this user.
          </Empty>
        ) : files === null ? (
          <Loading fg={fg}>Scanning for compose files…</Loading>
        ) : files.length === 0 ? (
          <Empty fg={fg} icon={<Layers size={22} style={{ color: `${fg}55` }} />}>
            No compose files under <code>{root}</code>.
          </Empty>
        ) : !result ? (
          <Loading fg={fg}>Reading services…</Loading>
        ) : result.error ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 11.5, color: colors.red, padding: "14px 8px", textAlign: "center" }}>
            <AlertTriangle size={20} />
            <span style={{ color: `${fg}aa` }}>{result.error}</span>
          </div>
        ) : services.length === 0 ? (
          <Empty fg={fg}>No services defined in this file.</Empty>
        ) : (
          services.map((s) => {
            const dot = stateColor(s.state, sc);
            const running = s.state.startsWith("running");
            const isBusy = busy === s.name;
            return (
              <div key={s.name} style={{ border: `1px solid ${border}`, borderRadius: 9, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 6, background: `${fg}08` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: running ? `0 0 6px ${dot}` : "none" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>{s.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 9.5, color: dot, textTransform: "capitalize" }}>{s.state || "unknown"}</span>
                </div>
                {(s.ports || s.status) && (
                  <div style={{ display: "flex", gap: 6, fontSize: 10, color: `${fg}77` }}>
                    {s.ports && <span style={{ fontFamily: "ui-monospace, monospace" }}>{s.ports}</span>}
                    {s.status && <span style={{ marginLeft: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{s.status}</span>}
                  </div>
                )}

                {confirm && confirm.service === s.name ? (
                  <ConfirmBar
                    text={`${ACTION_LABEL[confirm.action]} “${s.name}”?`}
                    fg={fg} border={border} red={colors.red} inline
                    onYes={() => { runAction(confirm.action, s.name); setConfirm(null); }}
                    onNo={() => setConfirm(null)}
                  />
                ) : (
                  <div style={{ display: "flex", gap: 6, marginTop: 1 }}>
                    {running ? (
                      <>
                        <ActionBtn label="Stop" icon={<Square size={12} />} disabled={isBusy} onClick={() => requestAction("stop", s.name)} fg={fg} border={border} accent={colors.red} />
                        <ActionBtn label="Restart" icon={<RotateCcw size={12} />} disabled={isBusy} onClick={() => requestAction("restart", s.name)} fg={fg} border={border} accent={colors.yellow} />
                      </>
                    ) : (
                      <ActionBtn label="Up" icon={<Play size={12} />} disabled={isBusy} onClick={() => requestAction("up", s.name)} fg={fg} border={border} accent={colors.green} />
                    )}
                    <ActionBtn label="Build" icon={<Hammer size={12} />} disabled={isBusy} onClick={() => requestAction("build", s.name)} fg={fg} border={border} accent={colors.cyan} />
                    <ActionBtn label="Logs" icon={<ScrollText size={12} />} disabled={isBusy} onClick={() => openLogs(s.name)} fg={fg} border={border} accent={colors.blue} />
                    <MoreMenu
                      fg={fg} bg={bg} border={border} disabled={isBusy}
                      items={[
                        { label: ACTION_LABEL["up-build"], icon: <Hammer size={12} />, onClick: () => requestAction("up-build", s.name) },
                        { label: ACTION_LABEL["recreate"], icon: <Zap size={12} />, onClick: () => requestAction("recreate", s.name) },
                        { label: ACTION_LABEL["build-nocache"], icon: <Hammer size={12} />, onClick: () => requestAction("build-nocache", s.name) },
                        { label: ACTION_LABEL["pull"], icon: <Download size={12} />, onClick: () => requestAction("pull", s.name) },
                        running
                          ? { label: "Stop", icon: <Square size={12} />, danger: true, onClick: () => requestAction("stop", s.name) }
                          : { label: "Start", icon: <Play size={12} />, onClick: () => requestAction("start", s.name) },
                        { label: ACTION_LABEL["rm"], icon: <Trash2 size={12} />, danger: true, onClick: () => requestAction("rm", s.name) },
                        { label: "Exec shell", icon: <TerminalIcon size={12} />, disabled: !running, onClick: () => execInTerminal(s.name) },
                        { label: "Follow logs in terminal", icon: <TerminalIcon size={12} />, onClick: () => followInTerminal(s.name) },
                      ]}
                    />
                    {isBusy && <RefreshCw size={13} style={{ color: `${fg}88`, alignSelf: "center", animation: "cmpSpin 0.9s linear infinite" }} />}
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

      {/* Log pane */}
      {logs && (
        <div style={{ borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", maxHeight: "34vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderBottom: `1px solid ${border}` }}>
            <ScrollText size={12} style={{ color: `${fg}88` }} />
            <span style={{ fontSize: 10.5, color: `${fg}aa` }}>
              {logs.service ?? "all services"} · last {LOG_TAIL}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => followInTerminal(logs.service)}
              title="Follow live in the terminal"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "2px 6px", cursor: "pointer" }}
            >
              <TerminalIcon size={11} /> Follow
            </button>
            <button onClick={() => setLogs(null)} title="Close logs" style={{ display: "flex", background: "transparent", border: "none", color: `${fg}88`, cursor: "pointer", padding: 2 }}>
              <X size={13} />
            </button>
          </div>
          <pre
            ref={logBodyRef}
            className="scrollbar-green"
            style={{ margin: 0, padding: "8px 12px", fontSize: 10, lineHeight: 1.5, fontFamily: "ui-monospace, monospace", color: `${fg}bb`, overflow: "auto", whiteSpace: "pre" }}
          >
            {logs.text || "…"}
          </pre>
        </div>
      )}

      {file && result?.available && !result.error && (
        <div style={{ display: "flex", alignItems: "center", fontSize: 10, color: `${fg}55`, padding: "6px 12px", borderTop: `1px solid ${border}` }}>
          {paused ? "Paused" : `Updated ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}`}
          <span style={{ marginLeft: "auto" }}>every {POLL_MS / 1000}s</span>
        </div>
      )}

      <style>{`@keyframes cmpSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Small building blocks ──────────────────────────────────── */

function Empty({ fg, icon, children }: { fg: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12, color: `${fg}88`, padding: "16px 8px", textAlign: "center" }}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

function Loading({ fg, children }: { fg: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: `${fg}88`, padding: "12px 0" }}>
      <RefreshCw size={14} style={{ animation: "cmpSpin 0.9s linear infinite" }} /> {children}
    </div>
  );
}

function ConfirmBar({
  text, fg, border, red, inline, onYes, onNo,
}: {
  text: string; fg: string; border: string; red: string; inline?: boolean;
  onYes: () => void; onNo: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: fg,
      background: `${red}18`, borderRadius: 6,
      padding: inline ? "5px 7px" : "6px 12px",
      margin: inline ? undefined : "8px 12px",
    }}>
      <AlertTriangle size={13} style={{ color: red }} />
      <span>{text}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        <button onClick={onYes} style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: red, border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>Yes</button>
        <button onClick={onNo} style={{ fontSize: 10.5, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>No</button>
      </div>
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

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Rendered through a portal: the widget's `backdrop-filter` makes it a containing
 * block for fixed children, so an inline popup would be positioned against the
 * widget and clipped by its `overflow: hidden`.
 */
function MoreMenu({ items, fg, bg, border, disabled }: { items: MenuItem[]; fg: string; bg: string; border: string; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setAnchor(null);
    };
    const close = () => setAnchor(null);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [anchor]);

  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const height = Math.min(items.length * 27 + 8, 320);
    const y = r.bottom + height > window.innerHeight ? Math.max(8, r.top - height - 4) : r.bottom + 4;
    setAnchor({ x: Math.max(8, Math.min(r.right - 190, window.innerWidth - 198)), y });
  };

  return (
    <>
      <button
        ref={btnRef}
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => (anchor ? setAnchor(null) : open())}
        title="More actions"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 26, flexShrink: 0, color: disabled ? `${fg}55` : `${fg}aa`,
          background: "transparent", border: `1px solid ${border}`, borderRadius: 6,
          padding: "4px 0", cursor: disabled ? "default" : "pointer",
        }}
      >
        <MoreHorizontal size={13} />
      </button>
      {anchor && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed", left: anchor.x, top: anchor.y, zIndex: 2000, width: 190,
            background: `${bg}fa`, border: `1px solid ${border}`, borderRadius: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)", padding: 4,
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            maxHeight: 320, overflowY: "auto",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
          className="scrollbar-green"
        >
          {items.map((item) => (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={() => { setAnchor(null); item.onClick(); }}
              style={{
                display: "flex", alignItems: "center", gap: 7, width: "100%",
                fontSize: 11, textAlign: "left", color: item.disabled ? `${fg}44` : item.danger ? "#f87171" : fg,
                background: "transparent", border: "none", borderRadius: 5,
                padding: "5px 7px", cursor: item.disabled ? "default" : "pointer",
              }}
              onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = `${fg}12`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ display: "flex", opacity: 0.8 }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
