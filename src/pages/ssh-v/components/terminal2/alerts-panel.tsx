import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  BellOff,
  Bell,
  CheckCheck,
  ExternalLink,
  FlaskConical,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import {
  RULE_DEFAULTS,
  RULE_TYPE_LABEL,
  newRuleId,
  useWatcherStore,
  type RuleType,
  type WatchAlert,
  type WatchRule,
} from "@/store/watcherStore";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { Chip, ConfirmBar, IconBtn } from "./widget-parts";
import { askAI } from "./widget-utils";
import { compilePattern, openAlertTarget, runCheck, watchedSessionCount } from "./watcher-engine";
import type { PanelProps } from "./panels";

const RULE_TYPES: RuleType[] = ["service-failed", "container-exited", "disk-usage", "memory", "high-load", "log-pattern", "command-finished"];
const POLLING: RuleType[] = ["service-failed", "container-exited", "disk-usage", "memory", "high-load"];

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ruleSummary(r: WatchRule): string {
  const every = POLLING.includes(r.type) ? ` · every ${r.intervalSec >= 60 ? `${Math.round(r.intervalSec / 60)}m` : `${r.intervalSec}s`}` : "";
  switch (r.type) {
    case "disk-usage": return `any disk ≥ ${r.threshold ?? 90}%${every}`;
    case "memory": return `available ≤ ${r.threshold ?? 10}%${every}`;
    case "high-load": return `load/CPU ≥ ${r.threshold ?? 1.5} for ${r.consecutive ?? 3} checks${every}`;
    case "log-pattern": return `/${r.pattern ?? ""}/i in ${r.source === "journal" ? `journal${r.target ? ` -u ${r.target}` : ""}` : r.target} · cooldown ${r.cooldownSec ?? 60}s`;
    case "command-finished": return `commands ≥ ${r.minSeconds ?? 30}s in background tabs`;
    default: return `on change${every}`;
  }
}

/** Validation message for a draft rule, or null when it's fine. */
function validate(r: WatchRule): string | null {
  if (!r.name.trim()) return "Give the rule a name.";
  if (POLLING.includes(r.type) && (!(r.intervalSec >= 15) || r.intervalSec > 86400)) return "Interval must be 15 s – 24 h.";
  if (r.type === "disk-usage" && !((r.threshold ?? 0) >= 1 && (r.threshold ?? 0) <= 100)) return "Disk threshold must be 1–100 %.";
  if (r.type === "memory" && !((r.threshold ?? 0) >= 1 && (r.threshold ?? 0) <= 90)) return "Memory threshold must be 1–90 %.";
  if (r.type === "high-load" && !((r.threshold ?? 0) > 0 && (r.threshold ?? 0) <= 50)) return "Load threshold must be above 0.";
  if (r.type === "high-load" && !((r.consecutive ?? 0) >= 1 && (r.consecutive ?? 0) <= 60)) return "Consecutive checks must be 1–60.";
  if (r.type === "log-pattern") {
    if (r.source === "file" && !(r.target ?? "").trim().startsWith("/")) return "Use an absolute file path.";
    if (!compilePattern(r.pattern)) return "The pattern isn't a valid regular expression.";
    if (!((r.cooldownSec ?? -1) >= 0)) return "Cooldown must be 0 or more seconds.";
  }
  if (r.type === "command-finished" && !((r.minSeconds ?? 0) >= 1)) return "Minimum duration must be at least 1 s.";
  return null;
}

type Tab = "alerts" | "rules";

export default function AlertsPanel({ sessionId, onClose }: PanelProps) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;
  const sevColor = { critical: colors.red, warning: colors.yellow, info: colors.green } as const;

  const alerts = useWatcherStore((s) => s.alerts);
  const rules = useWatcherStore((s) => s.rules);
  const settings = useWatcherStore((s) => s.settings);
  const { markRead, markAllRead, dismiss, clearAlerts, updateRule, removeRule, addRule, setSettings } = useWatcherStore.getState();

  const sessions = useSSHStore((s) => s.sessions);
  const socket = sessions[sessionId]?.socket;
  const currentHost = sessions[sessionId]?.host ?? "";
  const hostKeys = useMemo(
    () => [...new Set(Object.values(sessions).map((s) => `${s.username}@${s.host}`))],
    [sessions],
  );

  const [tab, setTab] = useState<Tab>("alerts");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [editing, setEditing] = useState<WatchRule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [tests, setTests] = useState<Record<string, string>>({});
  const [, forceTick] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  // Keep "time ago" labels fresh.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const unread = alerts.filter((a) => !a.read && !a.recovered).length;
  const shown = onlyUnread ? alerts.filter((a) => !a.read) : alerts;

  const toggleNotifications = async () => {
    if (settings.notifications) { setSettings({ notifications: false }); return; }
    if (typeof Notification === "undefined") { setPermission("unsupported"); return; }
    let p = Notification.permission;
    if (p === "default") p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") setSettings({ notifications: true });
  };

  const startNew = () => {
    const type: RuleType = "disk-usage";
    setIsNew(true);
    setEditing({
      id: newRuleId(), type, name: RULE_TYPE_LABEL[type], enabled: true, scope: null,
      intervalSec: 60, notifyRecovery: false, ...RULE_DEFAULTS[type],
    });
  };

  const saveRule = () => {
    if (!editing || validate(editing)) return;
    if (isNew) addRule(editing);
    else updateRule(editing.id, editing);
    setEditing(null);
  };

  const testRule = async (rule: WatchRule) => {
    if (!socket) { setTests((t) => ({ ...t, [rule.id]: "This tab isn't connected." })); return; }
    setTests((t) => ({ ...t, [rule.id]: "Checking…" }));
    const res = await runCheck(rule, socket, currentHost);
    const myKey = `${sessions[sessionId]?.username}@${currentHost}`;
    const note = rule.scope && rule.scope !== myKey ? ` (ran on ${currentHost}; this rule watches ${rule.scope})` : "";
    setTests((t) => ({ ...t, [rule.id]: `${res.summary}${note}` }));
  };

  const openAlert = (a: WatchAlert) => openAlertTarget(a);

  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 11, color: fg, background: `${fg}0d`, border: `1px solid ${border}`,
    borderRadius: 5, padding: "4px 7px", outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: `${fg}88`, marginBottom: 3, display: "block" };

  return (
    <FloatingPanel
      title="Alerts"
      icon={<BellRing size={15} />}
      subtitle={unread ? <span style={{ color: colors.red, fontWeight: 600 }}>{unread} unread</span> : "watching in the background"}
      onClose={onClose}
      width={480}
      offset={{ right: 110, top: 70 }}
      actions={
        <>
          <IconBtn fg={fg} title={settings.sound ? "Sound on" : "Sound off"} onClick={() => setSettings({ sound: !settings.sound })}>
            {settings.sound ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </IconBtn>
          <IconBtn
            fg={fg}
            title={permission === "denied" ? "Browser notifications are blocked for this site" : settings.notifications ? "Browser notifications on" : "Turn on browser notifications"}
            onClick={() => void toggleNotifications()}
          >
            {settings.notifications ? <Bell size={13} style={{ color: colors.green }} /> : <BellOff size={13} />}
          </IconBtn>
        </>
      }
      footer={
        <>
          <span>Watching {watchedSessionCount()} host{watchedSessionCount() === 1 ? "" : "s"} · {rules.filter((r) => r.enabled).length} rules on</span>
          {permission === "denied" && <span style={{ marginLeft: "auto", color: colors.yellow }}>notifications blocked in browser</span>}
        </>
      }
    >
      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <Chip fg={fg} border={border} accent={colors.blue} active={tab === "alerts"} onClick={() => setTab("alerts")}>
          Alerts{alerts.length ? ` (${alerts.length})` : ""}
        </Chip>
        <Chip fg={fg} border={border} accent={colors.blue} active={tab === "rules"} onClick={() => setTab("rules")}>
          Rules ({rules.length})
        </Chip>
        <div style={{ flex: 1 }} />
        {tab === "alerts" ? (
          <>
            <Chip fg={fg} border={border} accent={colors.blue} active={onlyUnread} onClick={() => setOnlyUnread((v) => !v)}>Unread</Chip>
            <IconBtn fg={fg} title="Mark all read" onClick={() => markAllRead()} disabled={!unread}><CheckCheck size={13} /></IconBtn>
            <IconBtn fg={fg} title="Clear all" onClick={() => setConfirmClear(true)} disabled={!alerts.length}><Trash2 size={13} /></IconBtn>
          </>
        ) : (
          <button
            onClick={startNew}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "#fff", background: colors.blue, border: "none", borderRadius: 5, padding: "3px 9px", cursor: "pointer" }}
          >
            <Plus size={12} /> Add rule
          </button>
        )}
      </div>

      {confirmClear && tab === "alerts" && (
        <ConfirmBar text="Clear all alerts?" fg={fg} border={border} red={colors.red}
          onYes={() => { clearAlerts(); setConfirmClear(false); }} onNo={() => setConfirmClear(false)} />
      )}

      <div className="scrollbar-green" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {tab === "alerts" ? (
          shown.length === 0 ? (
            <PanelMessage icon={<BellRing size={22} style={{ color: `${fg}55` }} />}>
              {alerts.length ? "No unread alerts." : "No alerts yet. Watchers check every connected host in the background."}
            </PanelMessage>
          ) : (
            shown.map((a) => {
              const color = sevColor[a.severity];
              return (
                <div
                  key={a.id}
                  onClick={() => markRead(a.id)}
                  style={{
                    display: "flex", gap: 8, borderRadius: 8, padding: "7px 9px",
                    border: `1px solid ${a.read ? border : `${color}55`}`,
                    background: a.read ? `${fg}06` : `${color}12`, cursor: "default",
                  }}
                >
                  <span style={{ width: 3, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {!a.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />}
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.title}>{a.title}</span>
                      <span style={{ marginLeft: "auto", fontSize: 9.5, color: `${fg}66`, whiteSpace: "nowrap" }}>{timeAgo(a.at)}</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: `${fg}77` }}>{a.hostKey} · {RULE_TYPE_LABEL[a.ruleType]}</div>
                    {a.detail && (
                      <div style={{ fontSize: 10, color: `${fg}aa`, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 48, overflow: "hidden" }}>{a.detail}</div>
                    )}
                    <div style={{ display: "flex", gap: 4, marginTop: 1 }}>
                      <SmallBtn fg={fg} border={border} onClick={(e) => { e.stopPropagation(); openAlert(a); }}><ExternalLink size={11} /> Open</SmallBtn>
                      {!a.recovered && (
                        <SmallBtn fg={fg} border={border} onClick={(e) => {
                          e.stopPropagation();
                          markRead(a.id);
                          askAI(a.sessionId, `Alert on ${a.hostKey} (${RULE_TYPE_LABEL[a.ruleType]}): ${a.title}\n${a.detail}\nWhat is likely wrong and how do I fix it?`);
                        }}><Sparkles size={11} /> Ask AI</SmallBtn>
                      )}
                      <div style={{ flex: 1 }} />
                      <IconBtn fg={fg} title="Dismiss" onClick={() => dismiss(a.id)}><X size={12} /></IconBtn>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : editing ? (
          <RuleForm
            rule={editing}
            isNew={isNew}
            hostKeys={hostKeys}
            onChange={setEditing}
            onSave={saveRule}
            onCancel={() => setEditing(null)}
            error={validate(editing)}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />
        ) : (
          rules.map((r) => (
            <div key={r.id} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: "7px 9px", display: "flex", flexDirection: "column", gap: 5, background: `${fg}06`, opacity: r.enabled ? 1 : 0.65 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Toggle on={r.enabled} onClick={() => updateRule(r.id, { enabled: !r.enabled })} fg={fg} accent={colors.green} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div style={{ fontSize: 9.5, color: `${fg}77`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ruleSummary(r)}>
                    {RULE_TYPE_LABEL[r.type]} · {r.scope ?? "all hosts"} · {ruleSummary(r)}
                  </div>
                </div>
                <IconBtn fg={fg} title="Test now on this tab's host" onClick={() => void testRule(r)}><FlaskConical size={13} /></IconBtn>
                <IconBtn fg={fg} title="Edit" onClick={() => { setIsNew(false); setEditing({ ...r }); }}><Pencil size={12} /></IconBtn>
                <IconBtn fg={fg} title="Delete" onClick={() => setConfirmDel(r.id)}><Trash2 size={12} /></IconBtn>
              </div>
              {tests[r.id] && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 10, color: `${fg}aa`, background: `${fg}0a`, borderRadius: 5, padding: "4px 6px" }}>
                  {tests[r.id] === "Checking…" ? <RefreshCw size={11} style={{ animation: "fpSpin 0.9s linear infinite", flexShrink: 0, marginTop: 1 }} /> : <FlaskConical size={11} style={{ flexShrink: 0, marginTop: 1 }} />}
                  <span style={{ wordBreak: "break-word" }}>{tests[r.id]}</span>
                </div>
              )}
              {confirmDel === r.id && (
                <ConfirmBar inline text={`Delete “${r.name}”?`} fg={fg} border={border} red={colors.red}
                  onYes={() => { removeRule(r.id); setConfirmDel(null); }} onNo={() => setConfirmDel(null)} />
              )}
            </div>
          ))
        )}
      </div>
    </FloatingPanel>
  );
}

/* ── Rule form ──────────────────────────────────────────────── */

function RuleForm({ rule, isNew, hostKeys, onChange, onSave, onCancel, error, inputStyle, labelStyle }: {
  rule: WatchRule; isNew: boolean; hostKeys: string[];
  onChange: (r: WatchRule) => void; onSave: () => void; onCancel: () => void;
  error: string | null; inputStyle: React.CSSProperties; labelStyle: React.CSSProperties;
}) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const set = (patch: Partial<WatchRule>) => onChange({ ...rule, ...patch });
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const polling = POLLING.includes(rule.type);

  const changeType = (type: RuleType) => {
    // Reset type-specific fields to that type's defaults; keep name if customised.
    const keepName = rule.name.trim() && rule.name !== RULE_TYPE_LABEL[rule.type];
    onChange({
      id: rule.id, enabled: rule.enabled, scope: rule.scope, type,
      name: keepName ? rule.name : RULE_TYPE_LABEL[type],
      intervalSec: 60, notifyRecovery: false, ...RULE_DEFAULTS[type],
    });
  };

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      {node}
      {hint && <div style={{ fontSize: 9.5, color: `${fg}66`, marginTop: 2 }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: fg }}>{isNew ? "New rule" : "Edit rule"}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {field("Type", (
          <select value={rule.type} onChange={(e) => changeType(e.target.value as RuleType)} style={inputStyle}>
            {RULE_TYPES.map((t) => <option key={t} value={t} style={{ color: "#000" }}>{RULE_TYPE_LABEL[t]}</option>)}
          </select>
        ))}
        {field("Name", <input value={rule.name} onChange={(e) => set({ name: e.target.value })} style={inputStyle} />)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {field("Hosts", (
          <select value={rule.scope ?? ""} onChange={(e) => set({ scope: e.target.value || null })} style={inputStyle}>
            <option value="" style={{ color: "#000" }}>All hosts</option>
            {[...new Set([...hostKeys, ...(rule.scope ? [rule.scope] : [])])].map((h) => <option key={h} value={h} style={{ color: "#000" }}>{h}</option>)}
          </select>
        ))}
        {polling && field("Check every (seconds)", (
          <input type="number" min={15} value={Number.isNaN(rule.intervalSec) ? "" : rule.intervalSec} onChange={(e) => set({ intervalSec: num(e.target.value) })} style={inputStyle} />
        ))}
      </div>

      {rule.type === "disk-usage" && field("Alert when any disk is at least (%)", (
        <input type="number" min={1} max={100} value={rule.threshold ?? ""} onChange={(e) => set({ threshold: num(e.target.value) })} style={inputStyle} />
      ), "Snap, overlay, tmpfs and other pseudo filesystems are ignored.")}
      {rule.type === "memory" && field("Alert when available memory is at most (%)", (
        <input type="number" min={1} max={90} value={rule.threshold ?? ""} onChange={(e) => set({ threshold: num(e.target.value) })} style={inputStyle} />
      ))}
      {rule.type === "high-load" && (
        <div style={{ display: "flex", gap: 8 }}>
          {field("Load per CPU at least", (
            <input type="number" step={0.1} min={0.1} value={rule.threshold ?? ""} onChange={(e) => set({ threshold: num(e.target.value) })} style={inputStyle} />
          ), "1.0 = every CPU busy")}
          {field("For consecutive checks", (
            <input type="number" min={1} value={rule.consecutive ?? ""} onChange={(e) => set({ consecutive: num(e.target.value) })} style={inputStyle} />
          ))}
        </div>
      )}
      {rule.type === "log-pattern" && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            {field("Source", (
              <select value={rule.source ?? "file"} onChange={(e) => set({ source: e.target.value as "file" | "journal", target: e.target.value === "journal" ? "" : "/var/log/syslog" })} style={inputStyle}>
                <option value="file" style={{ color: "#000" }}>Log file</option>
                <option value="journal" style={{ color: "#000" }}>systemd journal</option>
              </select>
            ))}
            {field(rule.source === "journal" ? "Unit (empty = all)" : "File path", (
              <input value={rule.target ?? ""} onChange={(e) => set({ target: e.target.value })} placeholder={rule.source === "journal" ? "nginx" : "/var/log/app.log"} style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {field("Pattern (regex, case-insensitive)", (
              <input value={rule.pattern ?? ""} onChange={(e) => set({ pattern: e.target.value })} style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }} />
            ))}
            <div style={{ width: 110 }}>
              {field("Cooldown (s)", (
                <input type="number" min={0} value={rule.cooldownSec ?? ""} onChange={(e) => set({ cooldownSec: num(e.target.value) })} style={inputStyle} />
              ))}
            </div>
          </div>
        </>
      )}
      {rule.type === "command-finished" && field("Only commands that ran at least (seconds)", (
        <input type="number" min={1} value={rule.minSeconds ?? ""} onChange={(e) => set({ minSeconds: num(e.target.value) })} style={inputStyle} />
      ), "Uses Command Blocks (Settings) to know when a command ends. Alerts only for tabs you're not looking at.")}

      {polling && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: `${fg}aa`, cursor: "pointer" }}>
          <input type="checkbox" checked={rule.notifyRecovery} onChange={(e) => set({ notifyRecovery: e.target.checked })} />
          Also tell me when it recovers
        </label>
      )}

      {error && <div style={{ fontSize: 10.5, color: colors.red }}>{error}</div>}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ fontSize: 10.5, color: `${fg}aa`, background: "transparent", border: `1px solid ${fg}22`, borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
        <button
          onClick={onSave}
          disabled={!!error}
          style={{ fontSize: 10.5, fontWeight: 600, color: error ? `${fg}55` : "#fff", background: error ? "transparent" : colors.blue, border: `1px solid ${error ? `${fg}22` : colors.blue}`, borderRadius: 5, padding: "4px 12px", cursor: error ? "default" : "pointer" }}
        >
          {isNew ? "Add rule" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ── Small building blocks ──────────────────────────────────── */

function Toggle({ on, onClick, fg, accent }: { on: boolean; onClick: () => void; fg: string; accent: string }) {
  return (
    <button
      onClick={onClick}
      title={on ? "On — click to pause this rule" : "Off — click to turn on"}
      style={{ width: 28, height: 16, borderRadius: 8, border: "none", padding: 2, background: on ? accent : `${fg}33`, cursor: "pointer", flexShrink: 0, display: "flex", justifyContent: on ? "flex-end" : "flex-start", transition: "background 0.15s" }}
    >
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff" }} />
    </button>
  );
}

function SmallBtn({ fg, border, onClick, children }: { fg: string; border: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: `${fg}cc`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "2px 7px", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}
