import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Info,
  Network,
  Pause,
  Play,
  RefreshCw,
  Search,
  Skull,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import type { PanelProps } from "./panels";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { LogPane } from "./log-pane";
import { Chip, ConfirmBar, IconBtn, MoreMenu, SearchInput, type MenuItem } from "./widget-parts";
import { sendToTerminal, useSilentExec } from "./widget-utils";

const POLL_MS = 5000;

const PORTS_CMD =
  "if command -v ss >/dev/null 2>&1; then echo __SS__; ss -tulpnH 2>&1; " +
  "elif command -v netstat >/dev/null 2>&1; then echo __NETSTAT__; netstat -tulpn 2>&1; " +
  "else echo __NONE__; fi";

type ProcSort = "cpu" | "mem";
const procsCmd = (sort: ProcSort) =>
  `ps -eo pid,user,pcpu,pmem,etime,comm --sort=-${sort === "cpu" ? "pcpu" : "pmem"} --no-headers 2>&1 | head -60`;

const PID_RE = /^\d+$/;

interface Proc { name: string; pid: string }

interface Port {
  proto: string; // tcp | udp | tcp6 | udp6
  address: string;
  port: string;
  state: string;
  procs: Proc[];
}

type PortsResult =
  | { kind: "ok"; ports: Port[]; hidden: boolean }
  | { kind: "none" }
  | { kind: "error"; message: string };

/** `0.0.0.0:80`, `[::]:22`, `*:53`, `127.0.0.53%lo:53` → [address, port]. */
function splitAddr(s: string): [string, string] {
  const i = s.lastIndexOf(":");
  if (i < 0) return [s, ""];
  return [s.slice(0, i).replace(/^\[|\]$/g, "").replace(/%\S+$/, ""), s.slice(i + 1)];
}

function parsePorts(output: string): PortsResult {
  if (output.includes("__NONE__")) return { kind: "none" };
  const lines = output.split("\n").map((l) => l.replace(/\r/g, "")).filter((l) => l.trim());
  const tool = lines[0]?.trim();
  const rows = lines.slice(1);
  const ports: Port[] = [];

  if (tool === "__SS__") {
    for (const l of rows) {
      const t = l.trim().split(/\s+/);
      if (t.length < 5 || t[0] === "Netid") continue;
      const [address, port] = splitAddr(t[4]);
      const procText = t.slice(6).join(" ");
      const procs: Proc[] = [];
      const seen = new Set<string>();
      for (const m of procText.matchAll(/\("([^"]+)",pid=(\d+)/g)) {
        if (seen.has(m[2])) continue;
        seen.add(m[2]);
        procs.push({ name: m[1], pid: m[2] });
      }
      ports.push({ proto: t[0], address, port, state: t[1], procs });
    }
  } else if (tool === "__NETSTAT__") {
    for (const l of rows) {
      const t = l.trim().split(/\s+/);
      if (!/^(tcp|udp)/.test(t[0] ?? "") || t.length < 5) continue;
      const [address, port] = splitAddr(t[3]);
      const isTcp = t[0].startsWith("tcp");
      const pidProg = (isTcp ? t.slice(6) : t.slice(5)).join(" ");
      const m = pidProg.match(/^(\d+)\/(.+)$/);
      ports.push({
        proto: t[0], address, port, state: isTcp ? t[5] ?? "" : "UNCONN",
        procs: m ? [{ pid: m[1], name: m[2].split(/[:\s]/)[0] }] : [],
      });
    }
  } else {
    return { kind: "error", message: lines[0] ?? "No output" };
  }

  if (ports.length === 0 && rows.length > 0 && !rows.some((r) => /^\s*(tcp|udp|Netid|Proto|Active)/.test(r))) {
    return { kind: "error", message: rows[0].trim() };
  }
  ports.sort((a, b) => Number(a.port) - Number(b.port) || a.proto.localeCompare(b.proto));
  return { kind: "ok", ports, hidden: ports.some((p) => p.procs.length === 0) };
}

interface Process {
  pid: string;
  user: string;
  cpu: number;
  mem: number;
  etime: string;
  comm: string;
}

type ProcsResult = { kind: "ok"; procs: Process[] } | { kind: "error"; message: string };

function parseProcs(output: string): ProcsResult {
  const procs: Process[] = [];
  const lines = output.split("\n").map((l) => l.replace(/\r/g, "")).filter((l) => l.trim());
  for (const l of lines) {
    const m = l.trim().match(/^(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);
    if (!m) continue;
    procs.push({ pid: m[1], user: m[2], cpu: Number(m[3]), mem: Number(m[4]), etime: m[5], comm: m[6] });
  }
  if (procs.length === 0 && lines.length > 0) return { kind: "error", message: lines[0].trim() };
  return { kind: "ok", procs };
}

type Tab = "ports" | "procs";

interface Target { pid: string; label: string }

export default function PortsPanel({ sessionId, onClose }: PanelProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host);
  const { colors } = useSessionTheme();
  const connected = status === "connected" && !!socket;

  const run = useSilentExec(socket, `prt-${sessionId}`);

  const [tab, setTab] = useState<Tab>("ports");
  const [procSort, setProcSort] = useState<ProcSort>("cpu");
  const [ports, setPorts] = useState<PortsResult | null>(null);
  const [procs, setProcs] = useState<ProcsResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<{ key: string; target: Target; force: boolean } | null>(null);
  const [killErr, setKillErr] = useState<{ key: string; target: Target; force: boolean; message: string; denied: boolean } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [details, setDetails] = useState<{ target: Target; text: string | null } | null>(null);
  const [wide, setWide] = useState(false);

  const inFlight = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) { again.current = true; return; }
    inFlight.current = true;
    try {
      if (tab === "ports") {
        const out = await run(PORTS_CMD);
        if (out) setPorts(parsePorts(out));
      } else {
        const out = await run(procsCmd(procSort));
        if (out) setProcs(parseProcs(out));
      }
      setLastUpdate(Date.now());
    } finally {
      inFlight.current = false;
      if (again.current) { again.current = false; void refresh(); }
    }
  }, [run, tab, procSort]);

  useEffect(() => {
    if (!connected) return;
    void refresh();
    if (paused) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [connected, paused, refresh]);

  const kill = async (key: string, target: Target, force: boolean) => {
    if (!PID_RE.test(target.pid)) return;
    setBusyKey(key);
    setKillErr(null);
    const out = await run(`kill ${force ? "-9 " : ""}${target.pid} 2>&1; echo "__RC__$?"`);
    const rc = Number(out.match(/__RC__(\d+)/)?.[1] ?? "0");
    if (rc !== 0) {
      const message = out.replace(/__RC__\d+\s*$/, "").trim() || `kill failed (exit ${rc})`;
      setKillErr({ key, target, force, message, denied: /not permitted|permission denied/i.test(message) });
    }
    setBusyKey(null);
    void refresh();
  };

  const showDetails = (target: Target) => {
    if (!PID_RE.test(target.pid)) return;
    setDetails({ target, text: null });
    const p = target.pid;
    void run(
      `ps -o pid,ppid,user,lstart,etime,args -p ${p} 2>&1; ` +
      `echo; d=$(readlink /proc/${p}/cwd 2>/dev/null); echo "cwd: \${d:-(not readable without root)}"`,
    ).then((text) => setDetails((d) => (d && d.target.pid === p ? { ...d, text } : d)));
  };

  const fg = colors.foreground;
  const bg = colors.background;
  const border = `${fg}22`;
  const q = query.trim().toLowerCase();

  const portRows = useMemo(() => {
    if (ports?.kind !== "ok") return [];
    return ports.ports.filter((p) =>
      !q || p.port.includes(q) || p.address.toLowerCase().includes(q) || p.proto.includes(q) ||
      p.procs.some((pr) => pr.name.toLowerCase().includes(q) || pr.pid.includes(q)),
    );
  }, [ports, q]);

  const procRows = useMemo(() => {
    if (procs?.kind !== "ok") return [];
    return procs.procs.filter((p) => !q || p.comm.toLowerCase().includes(q) || p.user.toLowerCase().includes(q) || p.pid.includes(q));
  }, [procs, q]);

  const isPublic = (addr: string) => addr === "0.0.0.0" || addr === "*" || addr === "::" || addr === "";

  /** Confirm bar / error strip under a row, keyed per row. */
  const rowExtras = (key: string) => (
    <>
      {confirm && confirm.key === key && (
        <ConfirmBar
          inline
          text={`${confirm.force ? "Force kill (SIGKILL)" : "Kill"} ${confirm.target.label} (pid ${confirm.target.pid})?`}
          fg={fg} border={border} red={colors.red}
          onYes={() => { void kill(confirm.key, confirm.target, confirm.force); setConfirm(null); }}
          onNo={() => setConfirm(null)}
        />
      )}
      {killErr && killErr.key === key && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, background: `${colors.red}12`, borderRadius: 6, padding: "4px 7px" }}>
          <AlertTriangle size={12} style={{ color: colors.red, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: `${fg}bb` }} title={killErr.message}>{killErr.message}</span>
          {killErr.denied && (
            <button
              onClick={() => { sendToTerminal(socket, `sudo kill ${killErr.force ? "-9 " : ""}${killErr.target.pid}`); setKillErr(null); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: fg, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "2px 6px", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <TerminalIcon size={11} /> Run in terminal with sudo
            </button>
          )}
          <IconBtn fg={fg} title="Dismiss" onClick={() => setKillErr(null)}><X size={11} /></IconBtn>
        </div>
      )}
    </>
  );

  const killMenu = (key: string, target: Target, extra: MenuItem[] = []): MenuItem[] => [
    { label: "Force kill (SIGKILL)", icon: <Skull size={12} />, danger: true, onClick: () => setConfirm({ key, target, force: true }) },
    { label: "Copy PID", icon: <Copy size={12} />, onClick: () => { void navigator.clipboard?.writeText(target.pid).catch(() => { }); } },
    { label: "Show details", icon: <Info size={12} />, onClick: () => showDetails(target) },
    ...extra,
  ];

  const width = details ? (wide ? Math.min(980, window.innerWidth - 24) : 580) : 460;
  const current = tab === "ports" ? ports : procs;

  return (
    <FloatingPanel
      title="Ports & processes"
      icon={<Network size={15} />}
      subtitle={host}
      actions={
        <>
          <IconBtn fg={fg} title="Refresh now" onClick={() => void refresh()}><RefreshCw size={13} /></IconBtn>
          <IconBtn fg={fg} title={paused ? "Resume polling" : "Pause polling"} onClick={() => setPaused((p) => !p)}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </IconBtn>
        </>
      }
      footer={
        <>
          {paused ? "Paused" : `Updated ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}`}
          {tab === "ports" && ports?.kind === "ok" && ports.hidden && (
            <span title="Processes owned by other users are only visible to root">· some owners hidden (needs root)</span>
          )}
          <span style={{ marginLeft: "auto" }}>every {POLL_MS / 1000}s</span>
        </>
      }
      onClose={onClose}
      width={width}
      maxHeight={wide ? "88vh" : "80vh"}
      offset={{ right: 60, top: 120 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <Chip fg={fg} border={border} accent={colors.blue} active={tab === "ports"} onClick={() => { setTab("ports"); setConfirm(null); setKillErr(null); }}>Ports</Chip>
        <Chip fg={fg} border={border} accent={colors.blue} active={tab === "procs"} onClick={() => { setTab("procs"); setConfirm(null); setKillErr(null); }}>Processes</Chip>
        <SearchInput
          value={query} onChange={setQuery}
          placeholder={tab === "ports" ? "Port, address or process" : "Name, user or pid"}
          fg={fg} border={border} icon={<Search size={12} />}
        />
        {tab === "procs" && (
          <>
            <Chip fg={fg} border={border} accent={colors.cyan} active={procSort === "cpu"} onClick={() => setProcSort("cpu")} title="Top 60 by CPU">CPU</Chip>
            <Chip fg={fg} border={border} accent={colors.magenta} active={procSort === "mem"} onClick={() => setProcSort("mem")} title="Top 60 by memory">MEM</Chip>
          </>
        )}
      </div>

      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 5, overflowY: "auto", flex: "1 1 auto", minHeight: details ? 90 : undefined }} className="scrollbar-green">
        {!connected ? (
          <PanelMessage>Session not connected.</PanelMessage>
        ) : !current ? (
          <PanelMessage icon={<RefreshCw size={14} style={{ animation: "fpSpin 0.9s linear infinite" }} />}>Loading…</PanelMessage>
        ) : current.kind === "error" ? (
          <PanelMessage tone="error" icon={<AlertTriangle size={20} />}>{current.message}</PanelMessage>
        ) : current.kind === "none" ? (
          <PanelMessage icon={<Network size={22} style={{ color: `${fg}55` }} />}>Neither <code>ss</code> nor <code>netstat</code> is available on this host.</PanelMessage>
        ) : tab === "ports" ? (
          portRows.length === 0 ? <PanelMessage>{q ? "No ports match." : "Nothing is listening."}</PanelMessage> : portRows.map((p, i) => {
            const key = `p-${p.proto}-${p.address}-${p.port}-${i}`;
            const owner = p.procs[0];
            const target: Target | null = owner && PID_RE.test(owner.pid) ? { pid: owner.pid, label: owner.name } : null;
            const isTcp = p.proto.startsWith("tcp");
            const open = isPublic(p.address);
            return (
              <div key={key} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: "5px 8px", display: "flex", flexDirection: "column", gap: 4, background: `${fg}08` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: fg, fontFamily: "ui-monospace, monospace", minWidth: 48 }}>{p.port}</span>
                  <span style={{ fontSize: 9, color: isTcp ? colors.cyan : colors.magenta, border: `1px solid ${isTcp ? colors.cyan : colors.magenta}55`, borderRadius: 4, padding: "0 4px" }}>{p.proto}</span>
                  <span style={{ fontSize: 10, color: open ? colors.yellow : `${fg}88`, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={open ? "Listening on all interfaces" : "Local / specific interface only"}>
                    {p.address || "*"}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10.5, color: owner ? fg : `${fg}55`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }} title={owner ? p.procs.map((x) => `${x.name} (${x.pid})`).join(", ") : "Owner hidden — run as root to see it"}>
                    {owner ? `${owner.name}` : "—"}
                    {owner && <span style={{ color: `${fg}66` }}> {owner.pid}{p.procs.length > 1 ? ` +${p.procs.length - 1}` : ""}</span>}
                  </span>
                  {target && (
                    <>
                      <IconBtn fg={fg} title="Kill (SIGTERM)" disabled={busyKey === key} onClick={() => setConfirm({ key, target, force: false })}><X size={12} /></IconBtn>
                      <MoreMenu
                        fg={fg} bg={bg} border={border} disabled={busyKey === key}
                        items={killMenu(key, target, isTcp && host ? [
                          { label: `Open http://${host}:${p.port}`, icon: <ExternalLink size={12} />, disabled: !open, onClick: () => window.open(`http://${host}:${p.port}`, "_blank", "noopener,noreferrer") },
                        ] : [])}
                      />
                    </>
                  )}
                </div>
                {rowExtras(key)}
              </div>
            );
          })
        ) : (
          procRows.length === 0 ? <PanelMessage>{q ? "No processes match." : "No processes."}</PanelMessage> : procRows.map((p) => {
            const key = `pr-${p.pid}`;
            const target: Target = { pid: p.pid, label: p.comm };
            const hot = (procSort === "cpu" ? p.cpu : p.mem) >= 50;
            return (
              <div key={key} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: "5px 8px", display: "flex", flexDirection: "column", gap: 4, background: `${fg}08` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 10, color: `${fg}66`, fontFamily: "ui-monospace, monospace", minWidth: 48 }}>{p.pid}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={p.comm}>{p.comm}</span>
                  <span style={{ fontSize: 9.5, color: `${fg}77` }}>{p.user}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: procSort === "cpu" && hot ? colors.red : colors.cyan, fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "right" }}>{p.cpu.toFixed(1)}%</span>
                  <span style={{ fontSize: 10, color: procSort === "mem" && hot ? colors.red : colors.magenta, fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "right" }}>{p.mem.toFixed(1)}%</span>
                  <span style={{ fontSize: 9.5, color: `${fg}66`, minWidth: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }} title="Elapsed time">{p.etime}</span>
                  <IconBtn fg={fg} title="Kill (SIGTERM)" disabled={busyKey === key} onClick={() => setConfirm({ key, target, force: false })}><X size={12} /></IconBtn>
                  <MoreMenu fg={fg} bg={bg} border={border} disabled={busyKey === key} items={killMenu(key, target)} />
                </div>
                {rowExtras(key)}
              </div>
            );
          })
        )}
      </div>

      {details && (
        <LogPane
          kind="static"
          title="Details" subject={`${details.target.label} (pid ${details.target.pid})`} icon={<Info size={12} />}
          text={details.text}
          onRefresh={() => showDetails(details.target)}
          downloadName={`pid-${details.target.pid}.txt`}
          height="26vh"
          wide={wide} onToggleWide={() => setWide((w) => !w)}
          onClose={() => { setDetails(null); setWide(false); }}
        />
      )}
    </FloatingPanel>
  );
}
