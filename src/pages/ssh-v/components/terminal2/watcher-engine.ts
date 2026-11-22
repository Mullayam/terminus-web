import type { Socket } from "socket.io-client";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useSSHStore } from "@/store/sshStore";
import { useCommandBlocksStore, type CommandBlock } from "@/store/commandBlocksStore";
import { useDockerStore } from "@/store/dockerStore";
import { usePanelStore } from "@/store/panelStore";
import { useSidebarState } from "@/store/sidebarStore";
import { useWatcherStore, type Severity, type WatchAlert, type WatchRule } from "@/store/watcherStore";
import { execOnce, shQuote } from "./widget-utils";

/**
 * Background watcher engine. Runs every enabled rule against every connected
 * SSH session (all tabs, not only the visible one) and raises alerts on
 * transitions into a bad state — plus an optional "recovered" alert when it
 * clears. State is module-level so remounting the runner doesn't re-alert
 * problems that were already reported.
 */

interface Problem { title: string; detail: string; severity: Severity }

export interface CheckResult {
  /** Bad items keyed by unit / mount / container / … */
  problems: Map<string, Problem>;
  /** Shown by "Test now". */
  summary: string;
}

interface SessionInfo { sessionId: string; socket: Socket; hostKey: string; host: string }

type AlertListener = (alert: WatchAlert) => void;

const TICK_MS = 5000;

/* ── Module state ─────────────────────────────────────────────── */

const listeners = new Set<AlertListener>();
let tickTimer: ReturnType<typeof setInterval> | null = null;
let unsubSessions: (() => void) | null = null;
let unsubBlocks: (() => void) | null = null;

/** `${ruleId}|${sessionId}` → last run time / in-flight / known problems. */
const lastRun = new Map<string, number>();
const inFlight = new Set<string>();
const known = new Map<string, Map<string, Problem>>();
/** First check of a rule+session — used to skip stale container exits. */
const seen = new Set<string>();
/** high-load: consecutive bad checks. */
const strikes = new Map<string, number>();

interface LogStream {
  key: string;
  socket: Socket;
  streamId: string;
  cmd: string;
  rule: WatchRule;
  session: SessionInfo;
  regex: RegExp;
  partial: string;
  lastAlertAt: number;
  backoffMs: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  warned: boolean;
  onData: (p: { streamId?: string; chunk?: string }) => void;
  onEnd: (p: { streamId?: string; error?: string }) => void;
}
const streams = new Map<string, LogStream>();

/* ── Helpers ──────────────────────────────────────────────────── */

const ruleKey = (ruleId: string, sessionId: string) => `${ruleId}|${sessionId}`;

function connectedSessions(): SessionInfo[] {
  const out: SessionInfo[] = [];
  for (const s of Object.values(useSSHStore.getState().sessions)) {
    if (s.status !== "connected" || !s.socket || !s.socket.connected) continue;
    out.push({ sessionId: s.sessionId, socket: s.socket, hostKey: `${s.username}@${s.host}`, host: s.host });
  }
  return out;
}

function inScope(rule: WatchRule, s: SessionInfo): boolean {
  return !rule.scope || rule.scope === s.hostKey;
}

function fmtKiB(kib: number): string {
  if (kib >= 1024 * 1024) return `${(kib / 1024 / 1024).toFixed(1)}G`;
  if (kib >= 1024) return `${Math.round(kib / 1024)}M`;
  return `${kib}K`;
}

/** Panel to open for an alert of this rule type. */
function panelFor(rule: WatchRule): string | undefined {
  switch (rule.type) {
    case "service-failed": return "services";
    case "container-exited": return "docker";
    case "disk-usage": return "disk";
    case "high-load":
    case "memory": return "ports";
    case "log-pattern": return "logs";
    default: return undefined;
  }
}

function emit(rule: WatchRule, s: SessionInfo, key: string, p: Problem, recovered = false) {
  const alert = useWatcherStore.getState().pushAlert({
    ruleId: rule.id,
    ruleType: rule.type,
    sessionId: s.sessionId,
    hostKey: s.hostKey,
    title: p.title,
    detail: p.detail,
    severity: recovered ? "info" : p.severity,
    key,
    panel: panelFor(rule),
    recovered,
  });
  for (const l of listeners) l(alert);
}

/* ── Polling checks ───────────────────────────────────────────── */

const SERVICES_CMD = "systemctl --failed --no-legend --plain --no-pager 2>/dev/null";
const DOCKER_CMD = "docker ps -a --format '{{.Names}}|{{.State}}|{{.Status}}' 2>/dev/null";
const DISK_CMD = "df -P 2>/dev/null";
const LOAD_CMD = "cat /proc/loadavg 2>/dev/null; nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null";
const MEM_CMD = "cat /proc/meminfo 2>/dev/null";

/** Pseudo / read-only filesystems that are always "full" (snaps, overlays, …). */
const SKIP_FS = /^(tmpfs|devtmpfs|udev|overlay|shm|none|squashfs|cgroup2?|proc|sysfs)$/;
const SKIP_MOUNT = /^\/(snap|run|sys|proc|dev)(\/|$)/;

/**
 * Run one rule's check against one session. `firstRun` lets the container
 * check skip exits that happened long before watching started.
 */
export async function runCheck(rule: WatchRule, socket: Socket, host: string, firstRun = false): Promise<CheckResult> {
  const problems = new Map<string, Problem>();

  switch (rule.type) {
    case "service-failed": {
      const out = await execOnce(socket, SERVICES_CMD);
      for (const line of out.split("\n")) {
        const unit = line.trim().split(/\s+/)[0];
        if (!unit || !/\.[a-z]+$/.test(unit)) continue;
        problems.set(unit, { title: `${unit} failed on ${host}`, detail: line.trim(), severity: "critical" });
      }
      return { problems, summary: problems.size ? `${problems.size} failed: ${[...problems.keys()].join(", ")}` : "No failed services." };
    }

    case "container-exited": {
      const out = await execOnce(socket, DOCKER_CMD);
      let total = 0;
      for (const line of out.split("\n")) {
        const [name, state, ...rest] = line.split("|");
        if (!name || !state) continue;
        total++;
        const status = rest.join("|").trim();
        const st = state.trim().toLowerCase();
        if (st === "restarting") {
          problems.set(name, { title: `${name} is restart-looping on ${host}`, detail: status, severity: "critical" });
        } else if (st === "exited" || st === "dead") {
          const code = Number(status.match(/Exited \((\d+)\)/)?.[1] ?? (st === "dead" ? 1 : 0));
          if (code === 0) continue;
          // On the first look, only recent crashes are news.
          if (firstRun && !/second|minute/i.test(status)) continue;
          problems.set(name, { title: `${name} exited with code ${code} on ${host}`, detail: status, severity: "warning" });
        }
      }
      return { problems, summary: total ? (problems.size ? `${problems.size} of ${total} containers crashed or restarting.` : `${total} containers, none crashed.`) : "No containers (or no docker access)." };
    }

    case "disk-usage": {
      const limit = rule.threshold ?? 90;
      const out = await execOnce(socket, DISK_CMD);
      let worst = "";
      let worstPct = -1;
      for (const line of out.split("\n").slice(1)) {
        const cols = line.trim().split(/\s+/);
        if (cols.length < 6) continue;
        const [fs, , , avail, cap] = cols;
        const mount = cols.slice(5).join(" ");
        if (SKIP_FS.test(fs) || fs.startsWith("/dev/loop") || SKIP_MOUNT.test(mount)) continue;
        const pct = parseInt(cap, 10);
        if (Number.isNaN(pct)) continue;
        if (pct > worstPct) { worstPct = pct; worst = mount; }
        if (pct >= limit) {
          problems.set(mount, {
            title: `${mount} is ${pct}% full on ${host}`,
            detail: `${fmtKiB(Number(avail) || 0)} free on ${fs}`,
            severity: pct >= 97 ? "critical" : "warning",
          });
        }
      }
      return { problems, summary: worstPct >= 0 ? `Fullest: ${worst} at ${worstPct}% (limit ${limit}%).` : "Couldn't read disk usage." };
    }

    case "high-load": {
      const limit = rule.threshold ?? 1.5;
      const out = await execOnce(socket, LOAD_CMD);
      const [loadLine, cpuLine] = out.split("\n");
      const load1 = parseFloat(loadLine ?? "");
      const cpus = Math.max(1, parseInt(cpuLine ?? "1", 10) || 1);
      if (Number.isNaN(load1)) return { problems, summary: "Couldn't read /proc/loadavg." };
      const ratio = load1 / cpus;
      if (ratio >= limit) {
        problems.set("load", {
          title: `High load on ${host}: ${load1.toFixed(2)} on ${cpus} CPU${cpus > 1 ? "s" : ""}`,
          detail: `${ratio.toFixed(2)} per CPU (limit ${limit})`,
          severity: ratio >= limit * 2 ? "critical" : "warning",
        });
      }
      return { problems, summary: `Load ${load1.toFixed(2)} on ${cpus} CPUs = ${ratio.toFixed(2)} per CPU (limit ${limit}).` };
    }

    case "memory": {
      const limit = rule.threshold ?? 10;
      const out = await execOnce(socket, MEM_CMD);
      const kb = (k: string) => Number(out.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"))?.[1] ?? NaN);
      const total = kb("MemTotal");
      const avail = kb("MemAvailable");
      if (!total || Number.isNaN(avail)) return { problems, summary: "Couldn't read /proc/meminfo." };
      const pct = (avail / total) * 100;
      if (pct <= limit) {
        problems.set("mem", {
          title: `Low memory on ${host}: ${pct.toFixed(0)}% available`,
          detail: `${fmtKiB(avail)} of ${fmtKiB(total)} available (limit ${limit}%)`,
          severity: pct <= limit / 2 ? "critical" : "warning",
        });
      }
      return { problems, summary: `${pct.toFixed(0)}% available (${fmtKiB(avail)} of ${fmtKiB(total)}; limit ${limit}%).` };
    }

    case "log-pattern": {
      const re = compilePattern(rule.pattern);
      if (!re) return { problems, summary: "Invalid pattern." };
      const src = logSourceCmd(rule, 200, false);
      if (!src) return { problems, summary: "No file or unit set." };
      const out = await execOnce(socket, src);
      const lines = out.split("\n").filter((l) => re.test(l));
      return {
        problems,
        summary: lines.length
          ? `${lines.length} of the last 200 lines match. Latest: ${lines[lines.length - 1].trim().slice(0, 200)}`
          : /no such file|permission denied|cannot open/i.test(out) ? out.split("\n")[0] : "No match in the last 200 lines.",
      };
    }

    case "command-finished":
      return { problems, summary: `Alerts when a command that ran ≥ ${rule.minSeconds ?? 30}s finishes in a tab you're not looking at (needs Command Blocks on).` };
  }
}

/** Case-insensitive regex from a rule pattern, or null if invalid/empty. */
export function compilePattern(pattern?: string): RegExp | null {
  if (!pattern?.trim()) return null;
  try { return new RegExp(pattern, "i"); } catch { return null; }
}

function logSourceCmd(rule: WatchRule, lines: number, follow: boolean): string | null {
  const target = (rule.target ?? "").trim();
  if (rule.source === "journal") {
    return `journalctl ${follow ? "-f " : ""}-n ${lines} --no-pager -o short-iso${target ? ` -u ${shQuote(target)}` : ""} 2>&1`;
  }
  if (!target) return null;
  return follow ? `tail -n ${lines} -F ${shQuote(target)} 2>&1` : `tail -n ${lines} ${shQuote(target)} 2>&1`;
}

async function poll(rule: WatchRule, s: SessionInfo) {
  const key = ruleKey(rule.id, s.sessionId);
  inFlight.add(key);
  lastRun.set(key, Date.now());
  try {
    const firstRun = !seen.has(key);
    const { problems } = await runCheck(rule, s.socket, s.host, firstRun);
    seen.add(key);
    // Rule disabled / removed while the check was running.
    const live = useWatcherStore.getState().rules.find((r) => r.id === rule.id);
    if (!live?.enabled) return;

    let current = problems;
    if (rule.type === "high-load") {
      const n = problems.size ? (strikes.get(key) ?? 0) + 1 : 0;
      strikes.set(key, n);
      if (n < (rule.consecutive ?? 3)) current = new Map();
    }

    const prev = known.get(key) ?? new Map<string, Problem>();
    for (const [k, p] of current) if (!prev.has(k)) emit(live, s, k, p);
    if (live.notifyRecovery) {
      for (const [k, p] of prev) {
        if (!current.has(k)) {
          emit(live, s, k, { title: `Recovered: ${p.title.replace(/ on [^ ]+$/, "")} on ${s.host}`, detail: p.detail, severity: "info" }, true);
        }
      }
    }
    known.set(key, current);
  } finally {
    inFlight.delete(key);
  }
}

/* ── Log-pattern streams ──────────────────────────────────────── */

function stopStream(key: string) {
  const st = streams.get(key);
  if (!st) return;
  streams.delete(key);
  if (st.retryTimer) clearTimeout(st.retryTimer);
  st.socket.off(SocketEventConstants.SSH_EXEC_STREAM_DATA, st.onData);
  st.socket.off(SocketEventConstants.SSH_EXEC_STREAM_END, st.onEnd);
  st.socket.emit(SocketEventConstants.SSH_EXEC_STREAM_STOP, { streamId: st.streamId });
}

function openStream(st: LogStream) {
  st.streamId = `watch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  st.partial = "";
  st.socket.emit(SocketEventConstants.SSH_EXEC_STREAM, { streamId: st.streamId, cmd: st.cmd });
}

function ensureStream(rule: WatchRule, s: SessionInfo) {
  const key = ruleKey(rule.id, s.sessionId);
  const regex = compilePattern(rule.pattern);
  const cmd = logSourceCmd(rule, 0, true);
  const existing = streams.get(key);
  if (existing) {
    // Rule edited or socket replaced → restart; otherwise keep it.
    if (existing.cmd === cmd && existing.socket === s.socket && existing.regex.source === regex?.source) {
      existing.rule = rule;
      return;
    }
    stopStream(key);
  }
  if (!regex || !cmd) return;

  const st: LogStream = {
    key, socket: s.socket, streamId: "", cmd, rule, session: s, regex,
    partial: "", lastAlertAt: 0, backoffMs: 5000, retryTimer: null, warned: false,
    onData: () => { }, onEnd: () => { },
  };

  st.onData = (p) => {
    if (p?.streamId !== st.streamId || typeof p.chunk !== "string") return;
    st.backoffMs = 5000;
    const text = st.partial + p.chunk.replace(/\r/g, "");
    const lines = text.split("\n");
    st.partial = lines.pop() ?? "";
    for (const line of lines) {
      if (!st.warned && /^tail: .*(no such file|permission denied|cannot open)|^No journal files|insufficient permissions/i.test(line)) {
        st.warned = true;
        emit(st.rule, st.session, `unreadable-${st.cmd}`, {
          title: `Watcher can't read ${st.rule.source === "journal" ? "the journal" : st.rule.target} on ${st.session.host}`,
          detail: line.trim(),
          severity: "warning",
        });
        continue;
      }
      if (!st.regex.test(line)) continue;
      const now = Date.now();
      if (now - st.lastAlertAt < (st.rule.cooldownSec ?? 60) * 1000) continue;
      st.lastAlertAt = now;
      emit(st.rule, st.session, `match-${now}`, {
        title: `${st.rule.name} on ${st.session.host}`,
        detail: line.trim().slice(0, 400),
        severity: /fatal|panic|critical|emerg|out of memory|oom/i.test(line) ? "critical" : "warning",
      });
    }
  };

  st.onEnd = (p) => {
    if (p?.streamId !== st.streamId || streams.get(key) !== st) return;
    // Ended on its own (rotation edge, server restart, …): retry with backoff.
    st.retryTimer = setTimeout(() => {
      st.retryTimer = null;
      if (streams.get(key) === st && st.socket.connected) openStream(st);
    }, st.backoffMs);
    st.backoffMs = Math.min(st.backoffMs * 2, 5 * 60_000);
  };

  st.socket.on(SocketEventConstants.SSH_EXEC_STREAM_DATA, st.onData);
  st.socket.on(SocketEventConstants.SSH_EXEC_STREAM_END, st.onEnd);
  streams.set(key, st);
  openStream(st);
}

/* ── Command-finished (via command blocks) ────────────────────── */

function onBlocksChange(state: { blocks: Record<string, CommandBlock[]> }, prev: { blocks: Record<string, CommandBlock[]> }) {
  const rules = useWatcherStore.getState().rules.filter((r) => r.enabled && r.type === "command-finished");
  if (!rules.length) return;
  const ssh = useSSHStore.getState();
  const activeSessionId = ssh.tabs.find((t) => t.id === ssh.activeTabId)?.sessionId ?? ssh.activeTabId;

  for (const [sessionId, prevList] of Object.entries(prev.blocks)) {
    const nextList = state.blocks[sessionId];
    if (nextList === prevList) continue;
    const running = prevList.find((b) => b.running);
    if (!running) continue;
    const now = nextList?.find((b) => b.id === running.id);
    if (now?.running) continue; // still going
    // Finished (or replaced by a re-run of the same command).
    if (sessionId === activeSessionId && !document.hidden) continue;
    const sess = ssh.sessions[sessionId];
    if (!sess) continue;
    const info: SessionInfo | null = sess.socket ? { sessionId, socket: sess.socket, hostKey: `${sess.username}@${sess.host}`, host: sess.host } : null;
    if (!info) continue;
    const secs = Math.round((Date.now() - running.startedAt) / 1000);
    for (const rule of rules) {
      if (!inScope(rule, info) || secs < (rule.minSeconds ?? 30)) continue;
      const tail = running.output.trim().split("\n").slice(-3).join("\n");
      emit(rule, info, `cmd-${running.id}`, {
        title: `Finished on ${sess.host} after ${secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`}`,
        detail: `$ ${running.command}${tail ? `\n${tail}` : ""}`.slice(0, 400),
        severity: "info",
      });
    }
  }
}

/* ── Scheduler ────────────────────────────────────────────────── */

function tick() {
  const rules = useWatcherStore.getState().rules;
  const sessions = connectedSessions();
  const wantedStreams = new Set<string>();
  const now = Date.now();

  for (const s of sessions) {
    for (const rule of rules) {
      if (!rule.enabled || !inScope(rule, s)) continue;
      const key = ruleKey(rule.id, s.sessionId);
      if (rule.type === "log-pattern") {
        wantedStreams.add(key);
        ensureStream(rule, s);
        continue;
      }
      if (rule.type === "command-finished") continue;
      if (inFlight.has(key)) continue;
      const interval = Math.max(15, rule.intervalSec || 60) * 1000;
      if (now - (lastRun.get(key) ?? 0) < interval) continue;
      void poll(rule, s);
    }
  }

  for (const key of [...streams.keys()]) if (!wantedStreams.has(key)) stopStream(key);

  // Forget state for sessions / rules that are gone or disabled.
  const liveSessions = new Set(sessions.map((s) => s.sessionId));
  const enabled = new Set(rules.filter((r) => r.enabled).map((r) => r.id));
  for (const map of [lastRun, known, strikes] as Map<string, unknown>[]) {
    for (const key of [...map.keys()]) {
      const [ruleId, sessionId] = key.split("|");
      if (!liveSessions.has(sessionId) || !enabled.has(ruleId)) map.delete(key);
    }
  }
  for (const key of [...seen]) {
    const [ruleId, sessionId] = key.split("|");
    if (!liveSessions.has(sessionId) || !enabled.has(ruleId)) seen.delete(key);
  }
}

/**
 * Start the engine (idempotent). `onAlert` is called for every new alert;
 * the returned function unsubscribes it and stops the engine once no
 * listener is left.
 */
export function startWatchers(onAlert: AlertListener): () => void {
  listeners.add(onAlert);
  if (!tickTimer) {
    tickTimer = setInterval(tick, TICK_MS);
    unsubSessions = useWatcherStore.subscribe((s, p) => { if (s.rules !== p.rules) tick(); });
    unsubBlocks = useCommandBlocksStore.subscribe(onBlocksChange);
    setTimeout(tick, 1500); // let sockets settle after mount
  }
  return () => {
    listeners.delete(onAlert);
    if (listeners.size === 0) stopWatchers();
  };
}

export function stopWatchers() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
  unsubSessions?.();
  unsubSessions = null;
  unsubBlocks?.();
  unsubBlocks = null;
  for (const key of [...streams.keys()]) stopStream(key);
}

/** Switch to the alert's tab and open the related panel. */
export function openAlertTarget(alert: WatchAlert) {
  const ssh = useSSHStore.getState();
  const tab = ssh.tabs.find((t) => t.sessionId === alert.sessionId);
  if (tab) ssh.setActiveTab(tab.id);
  useWatcherStore.getState().markRead(alert.id);
  if (!alert.panel) {
    useSidebarState.getState().setView(alert.sessionId, "Terminal");
    return;
  }
  if (alert.panel === "docker") useDockerStore.getState().open();
  else usePanelStore.getState().openPanel(alert.panel);
}

/** Number of connected sessions the engine is watching. */
export function watchedSessionCount(): number {
  return connectedSessions().length;
}
