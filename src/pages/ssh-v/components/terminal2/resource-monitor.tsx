import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Clock,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Pause,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { SocketEventConstants } from "@/lib/sockets/event-constants";

/**
 * One-shot snapshot command: dumps raw counters from /proc + df so the panel
 * can compute CPU% and network rates from deltas between polls. Marker lines
 * (`__SECTION__`) delimit each block for parsing.
 */
const STATS_CMD =
  "echo __CPU__; head -n1 /proc/stat; " +
  "echo __MEM__; head -n3 /proc/meminfo; " +
  "echo __LOAD__; cat /proc/loadavg; " +
  "echo __NET__; cat /proc/net/dev; " +
  "echo __DISK__; df -kP 2>/dev/null; " +
  "echo __UP__; cat /proc/uptime; " +
  "echo __CORES__; nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo";

const POLL_MS = 3000;

interface DiskEntry {
  mount: string;
  sizeKb: number;
  usedKb: number;
  usePct: number;
}

interface RawSnapshot {
  cpu?: { total: number; idle: number };
  memTotalKb?: number;
  memAvailKb?: number;
  load?: [number, number, number];
  net?: { rx: number; tx: number };
  disk?: DiskEntry[];
  uptime?: number;
  cores?: number;
  at: number;
}

interface Metrics {
  cpuPct: number | null;
  memUsedKb: number;
  memTotalKb: number;
  memPct: number;
  load: [number, number, number] | null;
  rxRate: number | null;
  txRate: number | null;
  disks: DiskEntry[];
  uptime: number | null;
  cores: number | null;
}

function parseSnapshot(output: string): RawSnapshot {
  const snap: RawSnapshot = { at: Date.now() };
  const buckets: Record<string, string[]> = {};
  let section = "";
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\r/g, "");
    const marker = line.match(/^__([A-Z]+)__$/);
    if (marker) { section = marker[1]; buckets[section] = []; continue; }
    if (section) (buckets[section] ||= []).push(line);
  }

  const cpuLine = buckets.CPU?.find((l) => l.startsWith("cpu"));
  if (cpuLine) {
    const nums = cpuLine.trim().split(/\s+/).slice(1).map(Number).filter((n) => !Number.isNaN(n));
    if (nums.length >= 4) {
      const total = nums.reduce((a, b) => a + b, 0);
      const idle = (nums[3] ?? 0) + (nums[4] ?? 0); // idle + iowait
      snap.cpu = { total, idle };
    }
  }

  for (const l of buckets.MEM ?? []) {
    const mt = l.match(/^MemTotal:\s+(\d+)/);
    const ma = l.match(/^MemAvailable:\s+(\d+)/);
    const mf = l.match(/^MemFree:\s+(\d+)/);
    if (mt) snap.memTotalKb = Number(mt[1]);
    else if (ma) snap.memAvailKb = Number(ma[1]);
    else if (mf && snap.memAvailKb === undefined) snap.memAvailKb = Number(mf[1]);
  }

  const loadLine = buckets.LOAD?.[0];
  if (loadLine) {
    const p = loadLine.trim().split(/\s+/).map(Number);
    if (p.length >= 3) snap.load = [p[0], p[1], p[2]];
  }

  if (buckets.NET) {
    let rx = 0, tx = 0;
    for (const l of buckets.NET) {
      const m = l.match(/^\s*([^:]+):\s*(.+)$/);
      if (!m) continue;
      const iface = m[1].trim();
      if (iface === "lo" || iface.startsWith("veth") || iface.startsWith("docker") || iface.startsWith("br-")) continue;
      const cols = m[2].trim().split(/\s+/).map(Number);
      if (cols.length >= 9) { rx += cols[0] || 0; tx += cols[8] || 0; }
    }
    snap.net = { rx, tx };
  }

  if (buckets.DISK) {
    const disks: DiskEntry[] = [];
    for (const l of buckets.DISK) {
      if (/^Filesystem/i.test(l) || !l.trim()) continue;
      const c = l.trim().split(/\s+/);
      if (c.length < 6) continue;
      const fs = c[0];
      if (/^(tmpfs|devtmpfs|overlay|udev|none|shm)$/i.test(fs)) continue;
      const sizeKb = Number(c[1]);
      const usedKb = Number(c[2]);
      const usePct = parseInt(c[4], 10);
      if (Number.isNaN(sizeKb) || sizeKb <= 0) continue;
      disks.push({
        mount: c.slice(5).join(" "),
        sizeKb,
        usedKb,
        usePct: Number.isNaN(usePct) ? Math.round((usedKb / sizeKb) * 100) : usePct,
      });
    }
    snap.disk = disks;
  }

  const upLine = buckets.UP?.[0];
  if (upLine) {
    const n = parseFloat(upLine.trim().split(/\s+/)[0]);
    if (!Number.isNaN(n)) snap.uptime = n;
  }

  const coreLine = buckets.CORES?.[0];
  if (coreLine) {
    const n = parseInt(coreLine.trim(), 10);
    if (!Number.isNaN(n)) snap.cores = n;
  }

  return snap;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
const fmtKb = (kb: number) => fmtBytes(kb * 1024);
const fmtRate = (bps: number | null) => (bps == null ? "—" : `${fmtBytes(bps)}/s`);

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function usageColor(pct: number, colors: { green: string; yellow: string; red: string }): string {
  if (pct >= 90) return colors.red;
  if (pct >= 70) return colors.yellow;
  return colors.green;
}

interface StatBarProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct: number | null;
  color: string;
  fg: string;
  track: string;
}

function StatBar({ icon, label, value, pct, color, fg, track }: StatBarProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
        <span style={{ color, display: "flex" }}>{icon}</span>
        <span style={{ color: `${fg}bb`, fontWeight: 500 }}>{label}</span>
        <span style={{ marginLeft: "auto", color: fg, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: track, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct ?? 0))}%`, background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

interface ResourceMonitorProps {
  sessionId: string;
  onClose: () => void;
}

export default function ResourceMonitor({ sessionId, onClose }: ResourceMonitorProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host);
  const { colors } = useSessionTheme();

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const prevSnapRef = useRef<RawSnapshot | null>(null);
  const metricsRef = useRef<Metrics | null>(null);
  metricsRef.current = metrics;

  const [pos, setPos] = useState(() => ({ x: Math.max(12, window.innerWidth - 320), y: 72 }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const connected = status === "connected" && !!socket;

  useEffect(() => {
    if (!socket || !connected || paused) return;

    const reqPrefix = `rm-${sessionId}-`;
    let seq = 0;

    const onOutput = (payload: { requestId: string; output: string }) => {
      if (!payload || typeof payload.requestId !== "string" || !payload.requestId.startsWith(reqPrefix)) return;
      const snap = parseSnapshot(payload.output ?? "");
      const prev = prevSnapRef.current;
      const carry = metricsRef.current;

      let cpuPct = carry?.cpuPct ?? null;
      if (snap.cpu && prev?.cpu) {
        const dTotal = snap.cpu.total - prev.cpu.total;
        const dIdle = snap.cpu.idle - prev.cpu.idle;
        if (dTotal > 0) cpuPct = Math.min(100, Math.max(0, ((dTotal - dIdle) / dTotal) * 100));
      }

      let rxRate = carry?.rxRate ?? null;
      let txRate = carry?.txRate ?? null;
      if (snap.net && prev?.net) {
        const dt = (snap.at - prev.at) / 1000;
        if (dt > 0) {
          rxRate = Math.max(0, (snap.net.rx - prev.net.rx) / dt);
          txRate = Math.max(0, (snap.net.tx - prev.net.tx) / dt);
        }
      }

      const memTotalKb = snap.memTotalKb ?? 0;
      const memUsedKb = Math.max(0, memTotalKb - (snap.memAvailKb ?? 0));
      const memPct = memTotalKb ? (memUsedKb / memTotalKb) * 100 : 0;

      prevSnapRef.current = snap;
      setMetrics({
        cpuPct,
        memUsedKb,
        memTotalKb,
        memPct,
        load: snap.load ?? carry?.load ?? null,
        rxRate,
        txRate,
        disks: snap.disk ?? carry?.disks ?? [],
        uptime: snap.uptime ?? carry?.uptime ?? null,
        cores: snap.cores ?? carry?.cores ?? null,
      });
      setLastUpdate(Date.now());
    };

    const poll = () => {
      seq += 1;
      socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId: `${reqPrefix}${seq}`, cmd: STATS_CMD });
    };

    socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    poll();
    const timer = setInterval(poll, POLL_MS);

    return () => {
      clearInterval(timer);
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    };
  }, [socket, connected, paused, sessionId]);

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
  const uc = { green: colors.green, yellow: colors.yellow, red: colors.red };
  const rootDisk = metrics?.disks.find((d) => d.mount === "/") ?? metrics?.disks[0];

  return (
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: 50,
        width: 300, borderRadius: 12,
        background: `${bg}f2`, border: `1px solid ${border}`,
        boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header (drag handle) */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${border}`, cursor: "move", userSelect: "none" }}
      >
        <Activity size={15} style={{ color: colors.cyan ?? colors.green }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: fg }}>Resource Monitor</span>
        <span style={{ fontSize: 10, color: `${fg}66`, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host}</span>
        <div style={{ flex: 1 }} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPaused((p) => !p)}
          title={paused ? "Resume" : "Pause"}
          style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="Close (Ctrl+Shift+M)" style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}>
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 12 }}>
        {!connected ? (
          <div style={{ fontSize: 12, color: `${fg}88`, textAlign: "center", padding: "10px 0" }}>
            Session not connected.
          </div>
        ) : !metrics ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: `${fg}88`, padding: "10px 0" }}>
            <RefreshCw size={14} style={{ animation: "monSpin 0.9s linear infinite" }} /> Collecting metrics…
          </div>
        ) : (
          <>
            <StatBar
              icon={<Cpu size={13} />}
              label={`CPU${metrics.cores ? ` · ${metrics.cores} cores` : ""}`}
              value={metrics.cpuPct == null ? "…" : `${metrics.cpuPct.toFixed(0)}%`}
              pct={metrics.cpuPct}
              color={usageColor(metrics.cpuPct ?? 0, uc)}
              fg={fg}
              track={track}
            />

            <StatBar
              icon={<MemoryStick size={13} />}
              label="Memory"
              value={`${fmtKb(metrics.memUsedKb)} / ${fmtKb(metrics.memTotalKb)}`}
              pct={metrics.memPct}
              color={usageColor(metrics.memPct, uc)}
              fg={fg}
              track={track}
            />

            {rootDisk && (
              <StatBar
                icon={<HardDrive size={13} />}
                label={`Disk · ${rootDisk.mount}`}
                value={`${fmtKb(rootDisk.usedKb)} / ${fmtKb(rootDisk.sizeKb)}`}
                pct={rootDisk.usePct}
                color={usageColor(rootDisk.usePct, uc)}
                fg={fg}
                track={track}
              />
            )}

            {/* Network + Load + Uptime */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${border}`, paddingTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                <Network size={13} style={{ color: colors.blue ?? colors.cyan }} />
                <span style={{ color: `${fg}bb`, fontWeight: 500 }}>Network</span>
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, color: fg, fontVariantNumeric: "tabular-nums" }}>
                  <ArrowDown size={11} style={{ color: colors.green }} />{fmtRate(metrics.rxRate)}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: fg, fontVariantNumeric: "tabular-nums" }}>
                  <ArrowUp size={11} style={{ color: colors.yellow }} />{fmtRate(metrics.txRate)}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                <Activity size={13} style={{ color: colors.magenta ?? colors.red }} />
                <span style={{ color: `${fg}bb`, fontWeight: 500 }}>Load avg</span>
                <span style={{ marginLeft: "auto", color: fg, fontVariantNumeric: "tabular-nums" }}>
                  {metrics.load ? metrics.load.map((l) => l.toFixed(2)).join("  ") : "—"}
                </span>
              </div>

              {metrics.uptime != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                  <Clock size={13} style={{ color: `${fg}88` }} />
                  <span style={{ color: `${fg}bb`, fontWeight: 500 }}>Uptime</span>
                  <span style={{ marginLeft: "auto", color: fg }}>{fmtUptime(metrics.uptime)}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", fontSize: 10, color: `${fg}55` }}>
              {paused ? "Paused" : `Updated ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}`}
              <span style={{ marginLeft: "auto" }}>every {POLL_MS / 1000}s</span>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes monSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
