import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileText,
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldOff,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import type { PanelProps } from "./panels";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { LogPane } from "./log-pane";
import { Chip, IconBtn } from "./widget-parts";
import { sendToTerminal, shQuote, useSilentExec } from "./widget-utils";

/* ── Reading ───────────────────────────────────────────────── */

type Fw = "ufw" | "firewalld" | "iptables" | "none";

/** What each firewall is read with (also shown/run in the terminal when sudo needs a password). */
const READ_ARGS: Record<Exclude<Fw, "none">, string> = {
  ufw: "ufw status numbered",
  firewalld: "firewall-cmd --list-all",
  iptables: "iptables -S",
};

/**
 * Detect the firewall and read it non-interactively. sbin dirs are added
 * because non-root PATHs often lack them; `sudo -n` never prompts.
 * SSH_CONNECTION's last field is the port this session came in on.
 */
const READ_CMD =
  'PATH="$PATH:/usr/sbin:/sbin:/usr/local/sbin"; S="sudo -n"; [ "$(id -u)" = 0 ] && S=""; ' +
  'echo "__UID__:$(id -u)"; echo "__SSHPORT__:${SSH_CONNECTION##* }"; ' +
  `if command -v ufw >/dev/null 2>&1; then echo __FW__:ufw; $S ${READ_ARGS.ufw} 2>&1; echo "__RC__:$?"; ` +
  `elif command -v firewall-cmd >/dev/null 2>&1; then echo __FW__:firewalld; $S ${READ_ARGS.firewalld} 2>&1; echo "__RC__:$?"; ` +
  `elif command -v iptables >/dev/null 2>&1; then echo __FW__:iptables; $S ${READ_ARGS.iptables} 2>&1; echo "__RC__:$?"; ` +
  "else echo __FW__:none; fi";

interface UfwRule { num: number; to: string; action: string; dir: string; from: string; v6: boolean }
interface FirewalldInfo { zone: string; interfaces: string; services: string[]; ports: string[]; richRules: string[] }

interface FwState {
  fw: Fw;
  root: boolean;
  sshPort: number | null;
  needsSudo: boolean;
  error: string | null;
  active: boolean | null;
  raw: string;
  ufw: UfwRule[];
  firewalld: FirewalldInfo | null;
  iptables: { policies: string[]; rules: string[] };
}

const SUDO_PW_RE = /sudo: (a )?password is required|a terminal is required|no tty present/i;
const NOT_SUDOER_RE = /not in the sudoers|is not allowed to (run|execute)|may not run sudo/i;
const NO_SUDO_RE = /sudo: (command )?not found|sudo: No such file/i;

function parseUfw(body: string): { active: boolean | null; rules: UfwRule[] } {
  const st = body.match(/Status:\s*(active|inactive)/i);
  const rules: UfwRule[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\[\s*(\d+)\]\s+(.*)$/);
    if (!m) continue;
    const r = m[2].match(/^(.*?)\s+(ALLOW|DENY|REJECT|LIMIT)(?:\s+(IN|OUT|FWD))?\s+(.*)$/);
    if (!r) continue;
    rules.push({ num: Number(m[1]), to: r[1].trim(), action: r[2], dir: r[3] ?? "IN", from: r[4].trim(), v6: /\(v6\)/.test(m[2]) });
  }
  return { active: st ? st[1].toLowerCase() === "active" : null, rules };
}

function parseFirewalld(body: string): FirewalldInfo | null {
  const lines = body.split("\n");
  const head = lines.find((l) => /^\S/.test(l));
  if (!head) return null;
  const info: FirewalldInfo = { zone: head.trim(), interfaces: "", services: [], ports: [], richRules: [] };
  let inRich = false;
  for (const line of lines) {
    const kv = line.match(/^\s+([a-z-]+(?: [a-z-]+)?):\s*(.*)$/);
    if (kv) {
      inRich = kv[1] === "rich rules";
      const words = kv[2].trim().split(/\s+/).filter(Boolean);
      if (kv[1] === "services") info.services = words;
      else if (kv[1] === "ports") info.ports = words;
      else if (kv[1] === "interfaces") info.interfaces = kv[2].trim();
      else if (inRich && kv[2].trim()) info.richRules.push(kv[2].trim());
      continue;
    }
    if (inRich && /^\s+rule\s/.test(line)) info.richRules.push(line.trim());
  }
  return info;
}

function parseRead(out: string): FwState {
  const uid = out.match(/__UID__:(\d+)/);
  const ssh = out.match(/__SSHPORT__:(\d+)/);
  const fwM = out.match(/__FW__:(\w+)/);
  const fw = (fwM?.[1] ?? "none") as Fw;
  const afterFw = fwM ? out.slice(out.indexOf(fwM[0]) + fwM[0].length).replace(/^\n/, "") : "";
  const rcIdx = afterFw.lastIndexOf("__RC__:");
  const body = rcIdx >= 0 ? afterFw.slice(0, rcIdx) : afterFw;
  const rc = rcIdx >= 0 ? parseInt(afterFw.slice(rcIdx + 7), 10) : null;

  const state: FwState = {
    fw, root: uid?.[1] === "0", sshPort: ssh ? Number(ssh[1]) : null,
    needsSudo: false, error: null, active: null, raw: body,
    ufw: [], firewalld: null, iptables: { policies: [], rules: [] },
  };
  if (!out.trim()) { state.error = "No reply from the server."; return state; }
  if (fw === "none") return state;
  if (SUDO_PW_RE.test(body)) { state.needsSudo = true; return state; }
  if (NOT_SUDOER_RE.test(body)) { state.error = "This user isn't allowed to use sudo, so the firewall can't be read. Log in as root or a sudoer."; return state; }
  if (NO_SUDO_RE.test(body)) { state.error = "sudo isn't installed on this host. Log in as root to manage the firewall."; return state; }

  if (fw === "ufw") {
    const u = parseUfw(body);
    if (rc !== 0 && u.active === null) { state.error = body.trim() || `ufw exited with ${rc}`; return state; }
    state.active = u.active;
    state.ufw = u.rules;
  } else if (fw === "firewalld") {
    if (/not running/i.test(body)) { state.active = false; return state; }
    if (rc !== 0) { state.error = body.trim() || `firewall-cmd exited with ${rc}`; return state; }
    state.active = true;
    state.firewalld = parseFirewalld(body);
  } else {
    if (rc !== 0) { state.error = body.trim() || `iptables exited with ${rc}`; return state; }
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    state.iptables = { policies: lines.filter((l) => l.startsWith("-P ")), rules: lines.filter((l) => l.startsWith("-A ")) };
    const inputPolicy = state.iptables.policies.find((p) => p.startsWith("-P INPUT "));
    state.active = state.iptables.rules.length > 0 || (!!inputPolicy && !/ACCEPT$/.test(inputPolicy));
  }
  return state;
}

/* ── Input validation & command building ─────────────────────── */

type Proto = "tcp" | "udp" | "both";

/** "22", "8000-8100" or "8000:8100" → [lo, hi]; null when invalid. */
function parsePort(text: string): [number, number] | null {
  const m = text.trim().match(/^(\d{1,5})(?:[-:](\d{1,5}))?$/);
  if (!m) return null;
  const lo = Number(m[1]), hi = m[2] ? Number(m[2]) : lo;
  if (lo < 1 || hi > 65535 || lo > hi) return null;
  return [lo, hi];
}

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(\/(3[0-2]|[12]?\d))?$/;
const IPV6_RE = /^(?=.*:)[0-9a-fA-F:]{2,39}(\/(12[0-8]|1[01]\d|[1-9]?\d))?$/;
/** Strict source check — the value ends up in a shell command. */
function validSource(text: string): boolean {
  const t = text.trim();
  return !t || IPV4_RE.test(t) || (IPV6_RE.test(t) && (t.match(/::/g) ?? []).length <= 1);
}

function portSpec([lo, hi]: [number, number], sep: ":" | "-"): string {
  return lo === hi ? String(lo) : `${lo}${sep}${hi}`;
}

function buildAddCommands(fw: Exclude<Fw, "none">, allow: boolean, port: [number, number], proto: Proto, src: string, sudo: string): string[] {
  const protos: ("tcp" | "udp")[] = proto === "both" ? ["tcp", "udp"] : [proto];
  const range = port[0] !== port[1];
  if (fw === "ufw") {
    const verb = allow ? "allow" : "deny";
    const p = portSpec(port, ":");
    // ufw needs an explicit protocol for ranges, so "both" becomes two rules.
    if (!src) {
      if (proto === "both" && !range) return [`${sudo}ufw ${verb} ${p}`];
      return protos.map((pr) => `${sudo}ufw ${verb} ${p}/${pr}`);
    }
    if (proto === "both" && !range) return [`${sudo}ufw ${verb} from ${src} to any port ${p}`];
    return protos.map((pr) => `${sudo}ufw ${verb} from ${src} to any port ${p} proto ${pr}`);
  }
  if (fw === "firewalld") {
    const p = portSpec(port, "-");
    const cmds = protos.map((pr) => {
      if (allow && !src) return `${sudo}firewall-cmd --permanent --add-port=${p}/${pr}`;
      const family = src.includes(":") ? "ipv6" : "ipv4";
      const source = src ? ` source address="${src}"` : "";
      const rule = `rule family="${family}"${source} port port="${p}" protocol="${pr}" ${allow ? "accept" : "reject"}`;
      return `${sudo}firewall-cmd --permanent --add-rich-rule=${shQuote(rule)}`;
    });
    return [...cmds, `${sudo}firewall-cmd --reload`];
  }
  const bin = src.includes(":") ? "ip6tables" : "iptables";
  const p = portSpec(port, ":");
  return protos.map((pr) => `${sudo}${bin} -I INPUT -p ${pr} --dport ${p}${src ? ` -s ${src}` : ""} -j ${allow ? "ACCEPT" : "DROP"}`);
}

function coversPort(spec: string, port: number): boolean {
  const m = spec.match(/^(\d+)(?:[:-](\d+))?/);
  if (!m) return false;
  const lo = Number(m[1]), hi = m[2] ? Number(m[2]) : lo;
  return port >= lo && port <= hi;
}

/* ── Component ─────────────────────────────────────────────── */

interface Pending {
  label: string;
  command: string;
  warning?: string;
  danger?: boolean;
  /** When set, a checkbox offers this command instead (e.g. allow SSH before enabling). */
  safer?: { label: string; command: string };
}

export default function FirewallPanel({ sessionId, onClose }: PanelProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host);
  const { colors } = useSessionTheme();
  const run = useSilentExec(socket, `fw-${sessionId}`);
  const connected = status === "connected" && !!socket;

  const [state, setState] = useState<FwState | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [useSafer, setUseSafer] = useState(true);
  const [stale, setStale] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawWide, setRawWide] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(parseRead(await run(READ_CMD)));
      setStale(false);
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    if (connected) void load();
  }, [connected, load]);

  const fg = colors.foreground;
  const border = `${fg}22`;
  const muted = `${fg}88`;
  const sudo = state?.root ? "" : "sudo ";
  const sshPort = state?.sshPort ?? 22;
  const sshPorts = useMemo(() => [...new Set([22, sshPort])], [sshPort]);

  const ask = (p: Pending) => { setUseSafer(true); setPending(p); };
  const runPending = () => {
    if (!pending) return;
    const cmd = pending.safer && useSafer ? pending.safer.command : pending.command;
    sendToTerminal(socket, cmd);
    setPending(null);
    setStale(true);
  };

  const sshAllowedByUfw = (state?.ufw ?? []).some((r) =>
    (r.action === "ALLOW" || r.action === "LIMIT") && r.dir === "IN" &&
    (/^OpenSSH\b/i.test(r.to) || sshPorts.some((p) => coversPort(r.to, p))));

  const toggleFirewall = () => {
    if (!state || state.fw === "none" || state.fw === "iptables") return;
    if (state.active) {
      ask({
        label: "Disable the firewall",
        command: state.fw === "ufw" ? `${sudo}ufw disable` : `${sudo}systemctl stop firewalld`,
        danger: true,
        warning: "Disabling the firewall exposes every listening port on this host to the network.",
      });
    } else if (state.fw === "ufw") {
      const enable = `${sudo}ufw --force enable`;
      ask({
        label: "Enable ufw",
        command: enable,
        warning: sshAllowedByUfw ? undefined : `No rule allows SSH (port ${sshPort}). Enabling ufw now will cut off this session and lock you out.`,
        danger: !sshAllowedByUfw,
        safer: sshAllowedByUfw ? undefined : { label: `Allow SSH (${sshPort}/tcp) first`, command: `${sudo}ufw allow ${sshPort}/tcp && ${enable}` },
      });
    } else {
      ask({ label: "Start firewalld", command: `${sudo}systemctl start firewalld` });
    }
  };

  const sshWarning = (what: string) => `${what} may block SSH (port ${sshPort}) and lock you out of this server.`;

  const deleteUfw = (r: UfwRule) => {
    const allowsSsh = (r.action === "ALLOW" || r.action === "LIMIT") && (/^OpenSSH\b/i.test(r.to) || sshPorts.some((p) => coversPort(r.to, p)));
    ask({
      label: `Delete rule ${r.num} (${r.action} ${r.to})`,
      command: `${sudo}ufw --force delete ${r.num}`,
      danger: allowsSsh,
      warning: allowsSsh ? sshWarning("Removing this rule") : undefined,
    });
  };

  const deleteFirewalld = (kind: "service" | "port" | "rich", value: string) => {
    const flag = kind === "service" ? `--remove-service=${shQuote(value)}` : kind === "port" ? `--remove-port=${shQuote(value)}` : `--remove-rich-rule=${shQuote(value)}`;
    const ssh = (kind === "service" && value === "ssh") || (kind === "port" && sshPorts.some((p) => coversPort(value, p)));
    ask({
      label: `Remove ${kind === "rich" ? "rich rule" : `${kind} ${value}`}`,
      command: `${sudo}firewall-cmd --permanent ${flag} && ${sudo}firewall-cmd --reload`,
      danger: ssh,
      warning: ssh ? sshWarning("Removing this") : undefined,
    });
  };

  const deleteIptables = (rule: string) => {
    const ssh = /-j ACCEPT/.test(rule) && sshPorts.some((p) => new RegExp(`--dport ${p}\\b`).test(rule));
    ask({
      label: "Delete iptables rule",
      command: `${sudo}iptables ${rule.replace(/^-A /, "-D ")}`,
      danger: ssh,
      warning: ssh ? sshWarning("Deleting this rule") : undefined,
    });
  };

  const fwLabel = state?.fw === "ufw" ? "ufw" : state?.fw === "firewalld" ? "firewalld" : state?.fw === "iptables" ? "iptables" : "";
  const canToggle = state && !state.needsSudo && !state.error && (state.fw === "ufw" || state.fw === "firewalld");

  return (
    <FloatingPanel
      title="Firewall"
      icon={<Shield size={15} />}
      subtitle={host}
      onClose={onClose}
      width={showRaw && rawWide ? 760 : 470}
      offset={{ right: 100, top: 130 }}
      actions={
        <IconBtn fg={fg} title="Refresh" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={13} style={loading ? { animation: "fpSpin 0.9s linear infinite" } : undefined} />
        </IconBtn>
      }
      footer={state && state.fw !== "none" && !state.needsSudo && !state.error ? (
        <>
          <span>{fwLabel} · SSH port {sshPort}</span>
          <span style={{ marginLeft: "auto" }}>Changes run in the terminal with sudo</span>
          <Chip fg={fg} border={border} accent={colors.blue} active={showRaw} onClick={() => setShowRaw((v) => !v)} title="Raw output">
            <FileText size={11} /> Raw
          </Chip>
        </>
      ) : undefined}
    >
      <div className="scrollbar-green" style={{ flex: "1 1 auto", minHeight: 80, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {!connected ? (
          <PanelMessage>Session not connected.</PanelMessage>
        ) : !state ? (
          <PanelMessage icon={<RefreshCw size={16} style={{ animation: "fpSpin 0.9s linear infinite" }} />}>Detecting firewall…</PanelMessage>
        ) : state.fw === "none" ? (
          <PanelMessage icon={<ShieldOff size={22} style={{ color: `${fg}55` }} />}>No ufw, firewalld or iptables found on this host.</PanelMessage>
        ) : state.needsSudo ? (
          <PanelMessage icon={<KeyRound size={20} style={{ color: colors.yellow }} />}>
            Reading {fwLabel} rules needs sudo, and sudo is asking for a password.
            <div style={{ fontSize: 10.5, color: muted, marginTop: 6, maxWidth: 340 }}>
              Run the read in the terminal to authenticate there — the rules print in the terminal. Depending on your sudo settings,
              the password may only be remembered for that terminal, so Retry here can still ask.
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
              <Chip fg={fg} border={border} accent={colors.blue} active={false} onClick={() => sendToTerminal(socket, `sudo ${READ_ARGS[state.fw as Exclude<Fw, "none">]}`)}>
                <TerminalIcon size={11} /> Run in terminal
              </Chip>
              <Chip fg={fg} border={border} accent={colors.green} active={false} onClick={() => void load()}>
                <RefreshCw size={11} /> Retry
              </Chip>
            </div>
          </PanelMessage>
        ) : state.error ? (
          <PanelMessage tone="error" icon={<AlertTriangle size={20} />}>{state.error}</PanelMessage>
        ) : (
          <>
            {/* Status */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 9, padding: "9px 10px", border: `1px solid ${state.active ? `${colors.green}55` : `${colors.red}55`}`, background: state.active ? `${colors.green}10` : `${colors.red}10` }}>
              {state.active ? <ShieldCheck size={22} style={{ color: colors.green }} /> : <ShieldOff size={22} style={{ color: colors.red }} />}
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: state.active ? colors.green : colors.red }}>
                  {state.active ? "Active" : "Inactive"}
                </span>
                <span style={{ fontSize: 10, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fwLabel}
                  {state.fw === "firewalld" && state.firewalld ? ` · zone ${state.firewalld.zone}${state.firewalld.interfaces ? ` · ${state.firewalld.interfaces}` : ""}` : ""}
                  {state.fw === "iptables" ? ` · ${state.iptables.rules.length} rule${state.iptables.rules.length === 1 ? "" : "s"} (not persistent)` : ""}
                </span>
              </div>
              <div style={{ flex: 1 }} />
              {canToggle && (
                <Chip fg={fg} border={border} accent={state.active ? colors.red : colors.green} active={false} onClick={toggleFirewall}>
                  {state.active ? "Disable" : "Enable"}
                </Chip>
              )}
              <Chip fg={fg} border={border} accent={colors.blue} active={showAdd} onClick={() => setShowAdd((v) => !v)}>
                <Plus size={11} /> Rule
              </Chip>
            </div>

            {stale && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: colors.cyan, background: `${colors.cyan}14`, borderRadius: 6, padding: "6px 8px" }}>
                <TerminalIcon size={12} style={{ flexShrink: 0 }} />
                <span>Sent to the terminal — enter your sudo password there if asked, then refresh.</span>
                <div style={{ flex: 1 }} />
                <Chip fg={fg} border={border} accent={colors.cyan} active={false} onClick={() => void load()}><RefreshCw size={11} /> Refresh</Chip>
              </div>
            )}

            {pending && (
              <ConfirmCommand
                pending={pending}
                useSafer={useSafer}
                onSafer={setUseSafer}
                onRun={runPending}
                onCancel={() => setPending(null)}
              />
            )}

            {showAdd && (
              <AddRuleForm
                fw={state.fw as Exclude<Fw, "none">}
                sudo={sudo}
                sshPorts={sshPorts}
                onSubmit={(p) => { setShowAdd(false); ask(p); }}
                onCancel={() => setShowAdd(false)}
              />
            )}

            {/* Rules */}
            {state.fw === "ufw" && (
              state.ufw.length === 0 ? (
                <PanelMessage>{state.active ? "No rules — incoming traffic follows the default policy." : "ufw is inactive; rules apply once it's enabled."}</PanelMessage>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {state.ufw.map((r) => (
                    <div key={r.num} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, border: `1px solid ${border}`, borderRadius: 7, padding: "5px 8px", background: `${fg}06` }}>
                      <span style={{ color: `${fg}66`, fontVariantNumeric: "tabular-nums", minWidth: 22 }}>[{r.num}]</span>
                      <code style={{ color: fg, fontFamily: "ui-monospace, monospace", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 1 auto" }} title={r.to}>{r.to.replace(/\s*\(v6\)/, "")}</code>
                      <ActionBadge action={r.action} />
                      <span style={{ color: `${fg}66` }}>{r.dir}</span>
                      <span style={{ color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }} title={r.from}>from {r.from.replace(/\s*\(v6\)/, "")}</span>
                      {r.v6 && <span style={{ fontSize: 8.5, color: `${fg}77`, border: `1px solid ${border}`, borderRadius: 3, padding: "0 3px" }}>v6</span>}
                      <IconBtn fg={fg} title={stale ? "Refresh first — rule numbers may have changed" : "Delete rule"} disabled={stale} onClick={() => deleteUfw(r)}>
                        <Trash2 size={12} style={{ color: stale ? undefined : colors.red }} />
                      </IconBtn>
                    </div>
                  ))}
                </div>
              )
            )}

            {state.fw === "firewalld" && state.firewalld && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ChipList title="Services" items={state.firewalld.services} onRemove={(v) => deleteFirewalld("service", v)} disabled={stale} />
                <ChipList title="Ports" items={state.firewalld.ports} onRemove={(v) => deleteFirewalld("port", v)} disabled={stale} />
                {state.firewalld.richRules.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: `${fg}77`, marginBottom: 4 }}>Rich rules</div>
                    {state.firewalld.richRules.map((r) => (
                      <div key={r} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, border: `1px solid ${border}`, borderRadius: 6, padding: "4px 7px", marginBottom: 3 }}>
                        <code style={{ flex: 1, minWidth: 0, color: `${fg}cc`, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r}>{r}</code>
                        <IconBtn fg={fg} title="Remove" disabled={stale} onClick={() => deleteFirewalld("rich", r)}><Trash2 size={11} style={{ color: stale ? undefined : colors.red }} /></IconBtn>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {state.fw === "iptables" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {state.iptables.policies.length > 0 && (
                  <div style={{ fontSize: 10, color: muted, fontFamily: "ui-monospace, monospace" }}>
                    {state.iptables.policies.map((p) => p.replace(/^-P /, "")).join(" · ")}
                  </div>
                )}
                {state.iptables.rules.length === 0 ? (
                  <PanelMessage>No iptables rules.</PanelMessage>
                ) : state.iptables.rules.map((r, i) => (
                  <div key={`${i}-${r}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, border: `1px solid ${border}`, borderRadius: 6, padding: "4px 7px" }}>
                    <code style={{ flex: 1, minWidth: 0, color: /-j (DROP|REJECT)/.test(r) ? colors.red : /-j ACCEPT/.test(r) ? colors.green : `${fg}cc`, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r}>{r}</code>
                    <IconBtn fg={fg} title="Delete rule" disabled={stale} onClick={() => deleteIptables(r)}><Trash2 size={11} style={{ color: stale ? undefined : colors.red }} /></IconBtn>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showRaw && state && (
        <LogPane
          kind="static"
          title={fwLabel || "firewall"}
          subject={host ?? ""}
          icon={<FileText size={12} />}
          text={state.raw}
          onRefresh={() => void load()}
          downloadName={`firewall-${fwLabel || "rules"}.txt`}
          wide={rawWide}
          onToggleWide={() => setRawWide((w) => !w)}
          onClose={() => { setShowRaw(false); setRawWide(false); }}
          height="28vh"
        />
      )}
    </FloatingPanel>
  );
}

/* ── Pieces ────────────────────────────────────────────────── */

function ActionBadge({ action }: { action: string }) {
  const { colors } = useSessionTheme();
  const c = action === "ALLOW" ? colors.green : action === "LIMIT" ? colors.yellow : colors.red;
  return <span style={{ fontSize: 9, fontWeight: 700, color: c, background: `${c}18`, border: `1px solid ${c}44`, borderRadius: 4, padding: "0 5px" }}>{action}</span>;
}

function ChipList({ title, items, onRemove, disabled }: { title: string; items: string[]; onRemove: (v: string) => void; disabled: boolean }) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  return (
    <div>
      <div style={{ fontSize: 10, color: `${fg}77`, marginBottom: 4 }}>{title}</div>
      {items.length === 0 ? (
        <span style={{ fontSize: 10, color: `${fg}55` }}>none</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {items.map((v) => (
            <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontFamily: "ui-monospace, monospace", color: fg, border: `1px solid ${fg}22`, borderRadius: 5, padding: "1px 2px 1px 6px", background: `${colors.green}10` }}>
              {v}
              <IconBtn fg={fg} title={`Remove ${v}`} disabled={disabled} onClick={() => onRemove(v)}><X size={10} /></IconBtn>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmCommand({ pending, useSafer, onSafer, onRun, onCancel }: {
  pending: Pending; useSafer: boolean; onSafer: (v: boolean) => void; onRun: () => void; onCancel: () => void;
}) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const accent = pending.danger && !(pending.safer && useSafer) ? colors.red : colors.blue;
  const cmd = pending.safer && useSafer ? pending.safer.command : pending.command;
  return (
    <div style={{ border: `1px solid ${accent}66`, background: `${accent}10`, borderRadius: 8, padding: 9, display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: fg }}>{pending.label}</div>
      {pending.warning && (
        <div style={{ display: "flex", gap: 6, fontSize: 10.5, color: colors.red, background: `${colors.red}18`, borderRadius: 6, padding: "6px 8px", fontWeight: 600 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{pending.warning}</span>
        </div>
      )}
      {pending.safer && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: fg, cursor: "pointer" }}>
          <input type="checkbox" checked={useSafer} onChange={(e) => onSafer(e.target.checked)} />
          {pending.safer.label}
        </label>
      )}
      <code style={{ fontSize: 10.5, fontFamily: "ui-monospace, monospace", color: fg, background: `${fg}10`, borderRadius: 5, padding: "5px 7px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {cmd}
      </code>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button onClick={onCancel} style={{ fontSize: 10.5, color: `${fg}aa`, background: "transparent", border: `1px solid ${fg}22`, borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>Cancel</button>
        <button onClick={onRun} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>
          <TerminalIcon size={11} /> Run in terminal
        </button>
      </div>
    </div>
  );
}

function AddRuleForm({ fw, sudo, sshPorts, onSubmit, onCancel }: {
  fw: Exclude<Fw, "none">; sudo: string; sshPorts: number[];
  onSubmit: (p: Pending) => void; onCancel: () => void;
}) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;
  const [allow, setAllow] = useState(true);
  const [port, setPort] = useState("");
  const [proto, setProto] = useState<Proto>("tcp");
  const [src, setSrc] = useState("");

  const parsed = parsePort(port);
  const portErr = port && !parsed ? "Port must be 1-65535, or a range like 8000-8100" : null;
  const srcErr = !validSource(src) ? "Source must be an IPv4/IPv6 address or CIDR" : null;
  const ok = !!parsed && !srcErr;
  const blocksSsh = !allow && !!parsed && proto !== "udp" && sshPorts.some((p) => p >= parsed[0] && p <= parsed[1]);

  const submit = () => {
    if (!parsed || srcErr) return;
    const cmds = buildAddCommands(fw, allow, parsed, proto, src.trim(), sudo);
    onSubmit({
      label: `${allow ? "Allow" : "Deny"} ${portSpec(parsed, "-")}/${proto}${src.trim() ? ` from ${src.trim()}` : ""}`,
      command: cmds.join(" && "),
      danger: blocksSsh || !allow,
      warning: blocksSsh ? `This denies the SSH port${src.trim() ? ` for ${src.trim()}` : ""} — if your address matches, this session drops and you're locked out.` : undefined,
    });
  };

  const input: React.CSSProperties = {
    fontSize: 11, fontFamily: "ui-monospace, monospace", color: fg, background: `${fg}0d`,
    border: `1px solid ${border}`, borderRadius: 6, padding: "4px 7px", outline: "none", minWidth: 0,
  };

  return (
    <div style={{ border: `1px solid ${colors.blue}55`, borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 7, background: `${colors.blue}0a` }}>
      <div style={{ display: "flex", gap: 4 }}>
        <Chip fg={fg} border={border} accent={colors.green} active={allow} onClick={() => setAllow(true)}>Allow</Chip>
        <Chip fg={fg} border={border} accent={colors.red} active={!allow} onClick={() => setAllow(false)}>Deny</Chip>
        <div style={{ flex: 1 }} />
        {(["tcp", "udp", "both"] as const).map((p) => (
          <Chip key={p} fg={fg} border={border} accent={colors.blue} active={proto === p} onClick={() => setProto(p)}>{p}</Chip>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="Port, e.g. 443 or 8000-8100" spellCheck={false}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ ...input, flex: 1, borderColor: portErr ? `${colors.red}88` : border }} />
        <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="From (optional) 203.0.113.0/24" spellCheck={false}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ ...input, flex: 1, borderColor: srcErr ? `${colors.red}88` : border }} />
      </div>
      {(portErr || srcErr) && <div style={{ fontSize: 10, color: colors.red }}>{portErr ?? srcErr}</div>}
      {blocksSsh && (
        <div style={{ display: "flex", gap: 6, fontSize: 10.5, color: colors.red, fontWeight: 600 }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> This blocks the SSH port — you may lock yourself out.
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button onClick={onCancel} style={{ fontSize: 10.5, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>Cancel</button>
        <button onClick={submit} disabled={!ok} style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: ok ? colors.blue : `${fg}33`, border: "none", borderRadius: 5, padding: "3px 10px", cursor: ok ? "pointer" : "default" }}>
          Review command
        </button>
      </div>
    </div>
  );
}
