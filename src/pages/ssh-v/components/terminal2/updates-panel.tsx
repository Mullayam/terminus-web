import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  PackageCheck,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal as TerminalIcon,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import type { PanelProps } from "./panels";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { LogPane } from "./log-pane";
import { useExecStream } from "./use-exec-stream";
import { ActionBtn, Chip, ConfirmBar, IconBtn, SearchInput } from "./widget-parts";
import { askAI, sendToTerminal, useSilentExec } from "./widget-utils";
import {
  ACTION_LABEL,
  LIST_CMD,
  MANAGER_LABEL,
  buildCommand,
  parseUpdates,
  relTime,
  supports,
  type BuiltCommand,
  type UpdateAction,
  type UpdatesInfo,
} from "./updates-utils";

interface Pending {
  action: UpdateAction;
  cmd: BuiltCommand;
  count: number;
}

interface Running {
  action: UpdateAction;
  cmd: string;
}

export default function UpdatesPanel({ sessionId, onClose }: PanelProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host ?? "");
  const { colors } = useSessionTheme();
  const connected = status === "connected" && !!socket;
  const run = useSilentExec(connected ? socket : null, `upd-${sessionId}`);

  const [info, setInfo] = useState<UpdatesInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [securityOnly, setSecurityOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [rebootConfirm, setRebootConfirm] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);

  const [running, setRunning] = useState<Running | null>(null);
  const [stopped, setStopped] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [wide, setWide] = useState(false);

  const fg = colors.foreground;
  const border = `${fg}22`;

  const load = useCallback(async () => {
    setLoading(true);
    const out = await run(LIST_CMD);
    if (out.trim()) setInfo(parseUpdates(out));
    setLoading(false);
  }, [run]);

  useEffect(() => {
    if (connected) void load();
  }, [connected, load]);

  const stream = useExecStream(socket, running && connected && !stopped ? running.cmd : null, runKey);

  // A live run finished: reload the list and report the outcome.
  const liveRef = useRef(false);
  useEffect(() => {
    if (!running) { liveRef.current = false; return; }
    if (stream.live) { liveRef.current = true; return; }
    if (!liveRef.current) return;
    liveRef.current = false;
    if (stream.error) setNotice({ tone: "error", text: stream.error });
    else if (stream.exitCode) setNotice({ tone: "error", text: `${ACTION_LABEL[running.action]} failed (exit ${stream.exitCode}) — see the output below.` });
    else setNotice({ tone: "ok", text: `${ACTION_LABEL[running.action]} finished.` });
    setSelected(new Set());
    void load();
  }, [stream.live, stream.exitCode, stream.error, running, load]);

  const busy = !!running && stream.live;
  const manager = info?.manager ?? null;
  const pkgs = useMemo(() => info?.pkgs ?? [], [info]);
  const securityCount = pkgs.filter((p) => p.security).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pkgs.filter((p) => (!securityOnly || p.security) && (!q || p.name.toLowerCase().includes(q)));
  }, [pkgs, query, securityOnly]);

  const ask = (action: UpdateAction) => {
    if (!info || !manager) return;
    const names = [...selected];
    const cmd = buildCommand(manager, action, info, names);
    const count = action === "all" ? pkgs.length : action === "security" ? securityCount : action === "selected" ? names.length : 0;
    setNotice(null);
    setPending({ action, cmd, count });
  };

  const execute = (p: Pending) => {
    setPending(null);
    if (p.cmd.live) {
      setStopped(false);
      setRunning({ action: p.action, cmd: p.cmd.live });
      setRunKey((k) => k + 1);
    } else {
      sendToTerminal(socket, p.cmd.terminal);
      setNotice({ tone: "info", text: "Sent to the terminal — enter your sudo password there, then refresh this list." });
    }
  };

  const closePane = () => {
    if (busy && !window.confirm("Closing the output cancels the running upgrade. Cancel it?")) return;
    setRunning(null);
    setWide(false);
  };

  const toggle = (name: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.name));
  const toggleAll = () => setSelected((s) => {
    const next = new Set(s);
    if (allVisibleSelected) visible.forEach((p) => next.delete(p.name));
    else visible.forEach((p) => next.add(p.name));
    return next;
  });

  const subtitle = info
    ? manager
      ? `${MANAGER_LABEL[manager]} · ${pkgs.length} pending${securityCount ? ` · ${securityCount} security` : ""}`
      : "no package manager"
    : host;

  const noticeColor = notice?.tone === "error" ? colors.red : notice?.tone === "ok" ? colors.green : colors.blue;

  return (
    <FloatingPanel
      title="Updates"
      icon={<PackageCheck size={15} />}
      subtitle={subtitle}
      onClose={() => { if (!busy || window.confirm("An upgrade is still running. Closing cancels it. Close anyway?")) onClose(); }}
      width={running ? (wide ? 980 : 640) : 500}
      maxHeight={wide ? "90vh" : "84vh"}
      offset={{ right: 90, top: 100 }}
      actions={
        <IconBtn fg={fg} title="Re-check the list" onClick={() => void load()} disabled={!connected || loading}>
          <RefreshCw size={13} style={loading ? { animation: "fpSpin 0.9s linear infinite" } : undefined} />
        </IconBtn>
      }
      footer={info && manager ? (
        <>
          <span>{info.lastUpdate ? `Package lists refreshed ${relTime(info.lastUpdate)}` : "Package lists: refresh time unknown"}</span>
          <span style={{ marginLeft: "auto" }}>
            {info.priv === "none" ? "runs in the terminal (sudo asks for a password)" : "runs here with live output"}
          </span>
        </>
      ) : undefined}
    >
      {!connected ? (
        <PanelMessage>Session not connected.</PanelMessage>
      ) : !info ? (
        loading
          ? <PanelMessage icon={<RefreshCw size={16} style={{ animation: "fpSpin 0.9s linear infinite" }} />}>Checking for updates…</PanelMessage>
          : <PanelMessage tone="error">Couldn't read the package list.</PanelMessage>
      ) : !manager ? (
        <PanelMessage icon={<PackageCheck size={22} style={{ color: `${fg}55` }} />}>
          No supported package manager found (apt, dnf, yum, zypper, apk, pacman).
        </PanelMessage>
      ) : (
        <>
          {/* Reboot banner */}
          {info.reboot.required && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10.5, color: fg, background: `${colors.yellow}18`, padding: "6px 12px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} style={{ color: colors.yellow }} />
                <span>A reboot is required to finish earlier updates{info.reboot.pkgs.length ? ` (${info.reboot.pkgs.slice(0, 4).join(", ")}${info.reboot.pkgs.length > 4 ? ", …" : ""})` : ""}.</span>
                <button
                  onClick={() => setRebootConfirm((v) => !v)}
                  style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: fg, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "2px 8px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <Power size={11} /> Reboot…
                </button>
              </div>
              {rebootConfirm && (
                <ConfirmBar
                  inline
                  text={`Run "${info.priv === "root" ? "reboot" : "sudo reboot"}" in the terminal? Every session on the host disconnects.`}
                  fg={fg} border={border} red={colors.red}
                  onYes={() => { sendToTerminal(socket, info.priv === "root" ? "reboot" : "sudo reboot"); setRebootConfirm(false); }}
                  onNo={() => setRebootConfirm(false)}
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, padding: "8px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0, flexWrap: "wrap" }}>
            <ActionBtn label="Refresh lists" icon={<RefreshCw size={12} />} disabled={busy} onClick={() => ask("refresh")} fg={fg} border={border} accent={colors.cyan} />
            <ActionBtn label={`Upgrade all${pkgs.length ? ` (${pkgs.length})` : ""}`} icon={<Download size={12} />} disabled={busy || pkgs.length === 0} onClick={() => ask("all")} fg={fg} border={border} accent={colors.green} />
            {supports(manager, "security", info) && (
              <ActionBtn label={`Security${securityCount ? ` (${securityCount})` : ""}`} icon={<ShieldAlert size={12} />} disabled={busy} onClick={() => ask("security")} fg={fg} border={border} accent={colors.red} />
            )}
            {supports(manager, "selected", info) && (
              <ActionBtn label={`Selected (${selected.size})`} icon={<CheckCircle2 size={12} />} disabled={busy || selected.size === 0} onClick={() => ask("selected")} fg={fg} border={border} accent={colors.blue} />
            )}
          </div>

          {/* Confirm with the exact command */}
          {pending && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10.5, color: `${fg}aa`, display: "flex", alignItems: "center", gap: 5 }}>
                {pending.cmd.live ? <Download size={11} /> : <TerminalIcon size={11} />}
                {ACTION_LABEL[pending.action]}{pending.count ? ` · ${pending.count} package${pending.count > 1 ? "s" : ""}` : ""}
                {" — "}{pending.cmd.live ? "runs here with live output" : "runs in the terminal"}
              </div>
              <code style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: `${fg}cc`, background: `${fg}0d`, border: `1px solid ${border}`, borderRadius: 5, padding: "4px 7px", wordBreak: "break-all", maxHeight: 90, overflowY: "auto" }}>
                {pending.cmd.display}
              </code>
              <ConfirmBar inline text="Run it?" fg={fg} border={border} red={colors.red} onYes={() => execute(pending)} onNo={() => setPending(null)} />
            </div>
          )}

          {notice && (
            <div style={{ fontSize: 10.5, color: noticeColor, background: `${noticeColor}14`, padding: "5px 12px", flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
              {notice.tone === "error" ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />} {notice.text}
            </div>
          )}

          {/* Filter */}
          {pkgs.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              {supports(manager, "selected", info) && (
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} title="Select all shown" style={{ accentColor: colors.blue, cursor: "pointer" }} />
              )}
              <SearchInput value={query} onChange={setQuery} placeholder="Filter packages" fg={fg} border={border} icon={<Search size={12} />} />
              {securityCount > 0 && (
                <Chip fg={fg} border={border} accent={colors.red} active={securityOnly} onClick={() => setSecurityOnly((v) => !v)}>
                  <ShieldAlert size={11} /> Security
                </Chip>
              )}
            </div>
          )}

          {/* Package list */}
          <div className="scrollbar-green" style={{ flex: "1 1 auto", minHeight: running ? 80 : 0, overflowY: "auto", padding: "4px 6px" }}>
            {pkgs.length === 0 ? (
              <PanelMessage icon={<CheckCircle2 size={20} style={{ color: colors.green }} />}>
                Everything is up to date{info.lastUpdate ? "" : " (refresh the package lists to be sure)"}.
              </PanelMessage>
            ) : visible.length === 0 ? (
              <PanelMessage>No packages match.</PanelMessage>
            ) : (
              visible.map((p) => (
                <label
                  key={`${p.name}.${p.arch}`}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 6px", borderRadius: 5, cursor: supports(manager, "selected", info) ? "pointer" : "default", fontSize: 11 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${fg}0a`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {supports(manager, "selected", info) && (
                    <input type="checkbox" checked={selected.has(p.name)} onChange={() => toggle(p.name)} style={{ accentColor: colors.blue, cursor: "pointer" }} />
                  )}
                  <span style={{ fontWeight: 500, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }} title={p.repo ? `${p.name} (${p.repo})` : p.name}>{p.name}</span>
                  {p.security && (
                    <span style={{ fontSize: 8.5, fontWeight: 600, color: colors.red, border: `1px solid ${colors.red}66`, borderRadius: 4, padding: "0 4px", flexShrink: 0 }}>SECURITY</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 10, color: `${fg}77`, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, textAlign: "right" }} title={`${p.current || "?"} → ${p.next}`}>
                    {p.current ? <>{p.current} <span style={{ color: `${fg}55` }}>→</span> </> : null}
                    <span style={{ color: colors.green }}>{p.next}</span>
                  </span>
                </label>
              ))
            )}
          </div>

          {/* Live output */}
          {running && (
            <LogPane
              kind="stream"
              title={ACTION_LABEL[running.action]}
              subject={`${MANAGER_LABEL[manager]} on ${host}`}
              icon={<Download size={12} />}
              stream={stream}
              stopped={stopped}
              onStop={() => { if (window.confirm("Cancel the running upgrade? Interrupting a package manager can leave a lock or half-configured packages.")) setStopped(true); }}
              onRestart={() => { setStopped(false); setRunKey((k) => k + 1); }}
              onExplain={(text) => askAI(sessionId, `Output of "${running.cmd}" on ${host}:\n${text}`)}
              highlight
              downloadName={`updates-${running.action}.log`}
              wide={wide}
              onToggleWide={() => setWide((w) => !w)}
              onClose={closePane}
              height="40vh"
            />
          )}
        </>
      )}
    </FloatingPanel>
  );
}
