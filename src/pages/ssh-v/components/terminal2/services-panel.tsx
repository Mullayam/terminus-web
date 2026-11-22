import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Cog,
  Copy,
  FileText,
  Pause,
  Play,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Square,
  Terminal as TerminalIcon,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import type { PanelProps } from "./panels";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { LogPane, TailSelect } from "./log-pane";
import { useExecStream } from "./use-exec-stream";
import { Chip, ConfirmBar, IconBtn, MoreMenu, SearchInput, type MenuItem } from "./widget-parts";
import { askAI, sendToTerminal, shQuote, useSilentExec, type Tail } from "./widget-utils";

const POLL_MS = 5000;

/** Units + enablement in one round-trip; marker lines delimit the sections. */
const LIST_CMD =
  "if ! command -v systemctl >/dev/null 2>&1; then echo __NOSYSTEMD__; else " +
  "echo __UNITS__; systemctl list-units --type=service --all --no-legend --plain --no-pager 2>&1; " +
  "echo __FILES__; systemctl list-unit-files --type=service --no-legend --no-pager 2>&1; " +
  "fi";

const NO_SYSTEMD_RE = /__NOSYSTEMD__|not been booted with systemd|failed to connect to bus/i;
/** sudo -n refused, or polkit wants a password. */
const SUDO_RE = /password is required|a terminal is required|interactive authentication required|authentication is required|access denied|not in the sudoers|may not run sudo/i;

interface Unit {
  unit: string;
  load: string;
  active: string; // active | inactive | failed | activating | deactivating
  sub: string; // running | exited | dead | failed | ...
  description: string;
  enabled: string; // enabled | disabled | static | masked | ... ("" if unknown)
}

type ListResult =
  | { kind: "ok"; units: Unit[] }
  | { kind: "nosystemd" }
  | { kind: "error"; message: string };

function parseList(output: string): ListResult {
  if (NO_SYSTEMD_RE.test(output)) return { kind: "nosystemd" };

  const buckets: Record<string, string[]> = {};
  let section = "";
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\r/g, "");
    const marker = line.match(/^__([A-Z]+)__$/);
    if (marker) { section = marker[1]; buckets[section] = []; continue; }
    if (section) (buckets[section] ||= []).push(line);
  }

  const enabled = new Map<string, string>();
  for (const l of buckets.FILES ?? []) {
    const t = l.trim().split(/\s+/);
    if (t.length >= 2) enabled.set(t[0], t[1]);
  }

  const units: Unit[] = [];
  const unitLines = (buckets.UNITS ?? []).filter((l) => l.trim());
  for (const l of unitLines) {
    const m = l.replace(/^[●*\s]+/, "").match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/);
    if (!m || !m[1].endsWith(".service")) continue;
    const [, unit, load, active, sub, description] = m;
    // `--all` lists referenced-but-missing units; only failed ones are worth showing.
    if (load === "not-found" && active !== "failed") continue;
    units.push({ unit, load, active, sub, description, enabled: enabled.get(unit) ?? "" });
  }

  if (units.length === 0 && unitLines.length > 0) {
    return { kind: "error", message: unitLines[0].trim() };
  }

  const rank = (u: Unit) => (u.active === "failed" ? 0 : u.sub === "running" ? 1 : 2);
  units.sort((a, b) => rank(a) - rank(b) || a.unit.localeCompare(b.unit));
  return { kind: "ok", units };
}

type Action = "start" | "stop" | "restart" | "enable" | "disable";
const CONFIRM: Action[] = ["stop", "restart"];

/** Non-interactive sudo when available (root passes straight through). */
function actionCmd(unit: string, action: Action): string {
  const q = shQuote(unit);
  return `{ if command -v sudo >/dev/null 2>&1; then sudo -n systemctl ${action} ${q}; else systemctl ${action} ${q}; fi; } 2>&1; echo "__RC__$?"`;
}

function journalCmd(unit: string, tail: Tail): string {
  const q = shQuote(unit);
  const j = `journalctl -u ${q} -f -n ${tail} --no-pager -o short-iso`;
  // Prefer sudo when it needs no password: unprivileged users often can't read the journal.
  return `if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then sudo -n ${j}; else ${j}; fi 2>&1`;
}

function withoutKey<T>(map: Record<string, T>, key: string): Record<string, T> {
  if (!(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return next;
}

type Filter = "all" | "running" | "failed" | "enabled";

type Pane =
  | { kind: "journal"; unit: string }
  | { kind: "status"; unit: string; text: string | null };

interface RowError {
  action: Action;
  message: string;
  needsSudo: boolean;
}

export default function ServicesPanel({ sessionId, onClose }: PanelProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host);
  const { colors } = useSessionTheme();
  const connected = status === "connected" && !!socket;

  const run = useSilentExec(socket, `svc-${sessionId}`);

  const [result, setResult] = useState<ListResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ unit: string; action: Action } | null>(null);
  const [rowErr, setRowErr] = useState<Record<string, RowError>>({});

  const [pane, setPane] = useState<Pane | null>(null);
  const [tail, setTail] = useState<Tail>("100");
  const [stopped, setStopped] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [wide, setWide] = useState(false);

  const inFlight = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) { again.current = true; return; }
    inFlight.current = true;
    try {
      const out = await run(LIST_CMD);
      if (out) { // "" = socket went away mid-request
        setResult(parseList(out));
        setLastUpdate(Date.now());
      }
    } finally {
      inFlight.current = false;
      if (again.current) { again.current = false; void refresh(); }
    }
  }, [run]);

  useEffect(() => {
    if (!connected) return;
    void refresh();
    if (paused) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [connected, paused, refresh]);

  const journal = useExecStream(
    socket,
    pane?.kind === "journal" && connected && !stopped ? journalCmd(pane.unit, tail) : null,
    runKey,
  );

  const runAction = async (unit: string, action: Action) => {
    setBusy(unit);
    setRowErr((e) => withoutKey(e, unit));
    const out = await run(actionCmd(unit, action));
    const rc = Number(out.match(/__RC__(\d+)/)?.[1] ?? "0");
    const text = out.replace(/__RC__\d+\s*$/, "").trim();
    if (rc !== 0) {
      setRowErr((e) => ({
        ...e,
        [unit]: { action, message: text.split("\n").find((l) => l.trim()) || `systemctl ${action} failed (exit ${rc})`, needsSudo: SUDO_RE.test(text) },
      }));
    }
    setBusy(null);
    void refresh();
  };

  const requestAction = (unit: string, action: Action) => {
    if (CONFIRM.includes(action)) setConfirm({ unit, action });
    else void runAction(unit, action);
  };

  const openStatus = (unit: string) => {
    setPane({ kind: "status", unit, text: null });
    void run(`systemctl status --no-pager -l ${shQuote(unit)} 2>&1`).then((text) =>
      setPane((p) => (p && p.kind === "status" && p.unit === unit ? { ...p, text } : p)),
    );
  };

  const openJournal = (unit: string) => {
    if (pane?.kind === "journal" && pane.unit === unit) { setPane(null); return; }
    setStopped(false);
    setPane({ kind: "journal", unit });
  };

  const fg = colors.foreground;
  const bg = colors.background;
  const border = `${fg}22`;

  const units = useMemo(() => (result?.kind === "ok" ? result.units : []), [result]);
  const failedCount = units.filter((u) => u.active === "failed").length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter((u) => {
      if (filter === "running" && u.sub !== "running") return false;
      if (filter === "failed" && u.active !== "failed") return false;
      if (filter === "enabled" && u.enabled !== "enabled") return false;
      return !q || u.unit.toLowerCase().includes(q) || u.description.toLowerCase().includes(q);
    });
  }, [units, query, filter]);

  const stateColor = (u: Unit) =>
    u.active === "failed" ? colors.red
      : u.sub === "running" ? colors.green
        : u.active === "activating" || u.active === "deactivating" || u.active === "reloading" ? colors.yellow
          : `${fg}55`;
  const enabledColor = (e: string) =>
    e === "enabled" ? colors.green : e === "masked" ? colors.red : `${fg}77`;

  const width = pane ? (wide ? Math.min(980, window.innerWidth - 24) : 580) : 440;

  return (
    <FloatingPanel
      title="Services"
      icon={<Cog size={15} />}
      subtitle={
        <>
          {host}
          {failedCount > 0 && (
            <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 600, color: colors.red, background: `${colors.red}1f`, border: `1px solid ${colors.red}55`, borderRadius: 8, padding: "0 6px" }}>
              {failedCount} failed
            </span>
          )}
        </>
      }
      actions={
        <>
          <IconBtn fg={fg} title="Refresh now" onClick={() => void refresh()}><RefreshCw size={13} /></IconBtn>
          <IconBtn fg={fg} title={paused ? "Resume polling" : "Pause polling"} onClick={() => setPaused((p) => !p)}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </IconBtn>
        </>
      }
      footer={
        result?.kind === "ok" ? (
          <>
            {paused ? "Paused" : `Updated ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}`}
            <span style={{ marginLeft: "auto" }}>{visible.length}/{units.length} services · every {POLL_MS / 1000}s</span>
          </>
        ) : undefined
      }
      onClose={onClose}
      width={width}
      maxHeight={wide ? "88vh" : "80vh"}
      offset={{ right: 40, top: 96 }}
    >
      {result?.kind === "ok" && units.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "7px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <SearchInput value={query} onChange={setQuery} placeholder="Filter by name or description" fg={fg} border={border} icon={<Search size={12} />} />
          <div style={{ display: "flex", gap: 5 }}>
            {(["all", "running", "failed", "enabled"] as Filter[]).map((f) => (
              <Chip key={f} fg={fg} border={border} accent={f === "failed" ? colors.red : colors.blue} active={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "running" ? "Running" : f === "failed" ? `Failed${failedCount ? ` (${failedCount})` : ""}` : "Enabled"}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: "1 1 auto", minHeight: pane ? 90 : undefined }} className="scrollbar-green">
        {!connected ? (
          <PanelMessage>Session not connected.</PanelMessage>
        ) : !result ? (
          <PanelMessage icon={<RefreshCw size={14} style={{ animation: "fpSpin 0.9s linear infinite" }} />}>Loading services…</PanelMessage>
        ) : result.kind === "nosystemd" ? (
          <PanelMessage icon={<Cog size={22} style={{ color: `${fg}55` }} />}>This host doesn't run systemd (no <code>systemctl</code>, or not booted with systemd).</PanelMessage>
        ) : result.kind === "error" ? (
          <PanelMessage tone="error" icon={<AlertTriangle size={20} />}>{result.message}</PanelMessage>
        ) : visible.length === 0 ? (
          <PanelMessage>{units.length ? "No services match." : "No services found."}</PanelMessage>
        ) : (
          visible.map((u) => {
            const dot = stateColor(u);
            const isActive = u.active === "active" || u.active === "activating" || u.active === "reloading";
            const isBusy = busy === u.unit;
            const err = rowErr[u.unit];
            const selected = pane?.unit === u.unit;
            const name = u.unit.replace(/\.service$/, "");
            const more: MenuItem[] = [
              u.enabled === "enabled"
                ? { label: "Disable at boot", icon: <PowerOff size={12} />, onClick: () => requestAction(u.unit, "disable") }
                : { label: "Enable at boot", icon: <Power size={12} />, disabled: u.enabled === "static" || u.enabled === "masked", onClick: () => requestAction(u.unit, "enable") },
              { label: "Status", icon: <FileText size={12} />, onClick: () => openStatus(u.unit) },
              { label: "Journal (live)", icon: <ScrollText size={12} />, onClick: () => openJournal(u.unit) },
              { label: "Follow journal in terminal", icon: <TerminalIcon size={12} />, onClick: () => sendToTerminal(socket, `journalctl -u ${shQuote(u.unit)} -f -n 100`) },
              { label: "Copy unit name", icon: <Copy size={12} />, onClick: () => { void navigator.clipboard?.writeText(u.unit).catch(() => { }); } },
            ];
            return (
              <div key={u.unit} style={{ border: `1px solid ${selected ? `${colors.blue}66` : u.active === "failed" ? `${colors.red}44` : border}`, borderRadius: 8, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4, background: `${fg}08` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: u.sub === "running" ? `0 0 6px ${dot}` : "none" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={u.unit}>{name}</span>
                  {u.enabled && (
                    <span style={{ fontSize: 9, color: enabledColor(u.enabled), border: `1px solid ${enabledColor(u.enabled)}55`, borderRadius: 4, padding: "0 4px", flexShrink: 0 }}>{u.enabled}</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 10, color: dot, whiteSpace: "nowrap" }}>{u.active === u.sub ? u.active : `${u.active} · ${u.sub}`}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: `${fg}88`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={u.description}>{u.description}</span>
                  {isBusy && <RefreshCw size={12} style={{ color: `${fg}88`, animation: "fpSpin 0.9s linear infinite" }} />}
                  {isActive ? (
                    <>
                      <IconBtn fg={fg} title="Restart" disabled={isBusy} onClick={() => requestAction(u.unit, "restart")}><RotateCcw size={12} /></IconBtn>
                      <IconBtn fg={fg} title="Stop" disabled={isBusy} onClick={() => requestAction(u.unit, "stop")}><Square size={12} /></IconBtn>
                    </>
                  ) : (
                    <IconBtn fg={fg} title="Start" disabled={isBusy} onClick={() => requestAction(u.unit, "start")}><Play size={12} /></IconBtn>
                  )}
                  <IconBtn fg={fg} title="Journal (live)" onClick={() => openJournal(u.unit)}><ScrollText size={12} /></IconBtn>
                  <MoreMenu items={more} fg={fg} bg={bg} border={border} disabled={isBusy} />
                </div>

                {confirm && confirm.unit === u.unit && (
                  <ConfirmBar
                    inline
                    text={`${confirm.action === "stop" ? "Stop" : "Restart"} “${name}”?`}
                    fg={fg} border={border} red={colors.red}
                    onYes={() => { void runAction(confirm.unit, confirm.action); setConfirm(null); }}
                    onNo={() => setConfirm(null)}
                  />
                )}

                {err && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: colors.red, background: `${colors.red}12`, borderRadius: 6, padding: "4px 7px" }}>
                    <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: `${fg}bb` }} title={err.message}>
                      {err.needsSudo ? "Needs sudo password" : err.message}
                    </span>
                    {err.needsSudo && (
                      <button
                        onClick={() => { sendToTerminal(socket, `sudo systemctl ${err.action} ${shQuote(u.unit)}`); setRowErr((e) => withoutKey(e, u.unit)); }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: fg, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "2px 6px", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        <TerminalIcon size={11} /> Run in terminal
                      </button>
                    )}
                    <IconBtn fg={fg} title="Dismiss" onClick={() => setRowErr((e) => withoutKey(e, u.unit))}>×</IconBtn>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {pane && (pane.kind === "journal" ? (
        <LogPane
          kind="stream"
          title="Journal" subject={pane.unit} icon={<ScrollText size={12} />}
          stream={journal}
          stopped={stopped}
          onStop={() => setStopped(true)}
          onRestart={() => { setStopped(false); setRunKey((k) => k + 1); }}
          onTerminal={() => sendToTerminal(socket, `journalctl -u ${shQuote(pane.unit)} -f -n ${tail}`)}
          onExplain={(text) => askAI(sessionId, `Journal for ${pane.unit}:\n${text}`)}
          highlight
          options={<TailSelect value={tail} onChange={setTail} />}
          downloadName={`${pane.unit}-journal.log`}
          wide={wide} onToggleWide={() => setWide((w) => !w)}
          onClose={() => { setPane(null); setWide(false); }}
        />
      ) : (
        <LogPane
          kind="static"
          title="Status" subject={pane.unit} icon={<Clock size={12} />}
          text={pane.text}
          onRefresh={() => openStatus(pane.unit)}
          onExplain={(text) => askAI(sessionId, `systemctl status ${pane.unit}:\n${text}`)}
          highlight
          downloadName={`${pane.unit}-status.txt`}
          wide={wide} onToggleWide={() => setWide((w) => !w)}
          onClose={() => { setPane(null); setWide(false); }}
        />
      ))}
    </FloatingPanel>
  );
}
