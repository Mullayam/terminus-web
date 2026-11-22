import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  FileText,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import type { PanelProps } from "./panels";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { LogPane } from "./log-pane";
import { Chip, ConfirmBar, IconBtn } from "./widget-parts";
import { sendToTerminal, useSilentExec } from "./widget-utils";
import {
  CRON_PRESETS,
  describeSchedule,
  formatRelative,
  formatRunTime,
  jobLine,
  nextRuns,
  parseCrontab,
  serializeCrontab,
  toBase64Utf8,
  validateSchedule,
  type CronJob,
  type CronLine,
} from "./cron-utils";

/** `date +%z` gives the server's UTC offset so next-run times use server wall-clock time. */
const READ_CMD =
  "if ! command -v crontab >/dev/null 2>&1; then echo __NOCRON__; else " +
  "echo \"__TZ__:$(date +%z)\"; crontab -l 2>&1; echo \"__RC__:$?\"; fi";

type ReadResult =
  | { kind: "ok"; text: string; tzOffsetMin: number | null }
  | { kind: "nocron" }
  | { kind: "error"; message: string };

function parseRead(out: string): ReadResult {
  if (out.includes("__NOCRON__")) return { kind: "nocron" };
  const tz = out.match(/^__TZ__:([+-])(\d{2})(\d{2})\n/);
  const body = tz ? out.slice(tz[0].length) : out;
  const rcIdx = body.lastIndexOf("__RC__:");
  if (rcIdx < 0) return { kind: "error", message: out.trim() || "Couldn't read the crontab (no reply from the server)." };
  const rc = parseInt(body.slice(rcIdx + 7), 10);
  const text = body.slice(0, rcIdx);
  const tzOffsetMin = tz ? (tz[1] === "-" ? -1 : 1) * (Number(tz[2]) * 60 + Number(tz[3])) : null;
  if (rc === 0) return { kind: "ok", text, tzOffsetMin };
  if (/no crontab for/i.test(text)) return { kind: "ok", text: "", tzOffsetMin };
  return { kind: "error", message: text.trim() || `crontab -l exited with ${rc}` };
}

type Notice = { tone: "info" | "error"; text: string };

export default function CronPanel({ sessionId, onClose }: PanelProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host);
  const { colors } = useSessionTheme();
  const run = useSilentExec(socket, `cron-${sessionId}`);
  const connected = status === "connected" && !!socket;

  const [loaded, setLoaded] = useState<string | null>(null);
  const [tzOffsetMin, setTzOffsetMin] = useState<number | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "nocron" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // job id or "new"
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [rawWide, setRawWide] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const readCrontab = useCallback(async () => parseRead(await run(READ_CMD)), [run]);

  const load = useCallback(async () => {
    const r = await readCrontab();
    if (r.kind === "ok") {
      setLoaded(r.text);
      setTzOffsetMin(r.tzOffsetMin);
      setPhase("ready");
      setLoadError(null);
    } else if (r.kind === "nocron") {
      setPhase("nocron");
    } else {
      setPhase("error");
      setLoadError(r.message);
    }
  }, [readCrontab]);

  useEffect(() => {
    if (connected) void load();
  }, [connected, load]);

  const lines = useMemo(() => (loaded === null ? [] : parseCrontab(loaded)), [loaded]);
  const jobs = useMemo(() => lines.filter((l): l is CronJob => l.kind === "job"), [lines]);
  const envLines = lines.filter((l) => l.kind === "env");
  const commentCount = lines.filter((l) => l.kind === "comment").length;

  /**
   * Shift between browser and server wall clocks: schedules are evaluated in a
   * "server-local" frame, then shifted back for relative times.
   */
  const shiftMs = useMemo(() => {
    if (tzOffsetMin === null) return 0;
    const browserOffset = -now.getTimezoneOffset();
    return (tzOffsetMin - browserOffset) * 60_000;
  }, [tzOffsetMin, now]);

  const runsFor = useCallback((schedule: string, count: number) => {
    const serverNow = new Date(now.getTime() + shiftMs);
    return nextRuns(schedule, count, serverNow).map((wall) => ({ wall, real: new Date(wall.getTime() - shiftMs) }));
  }, [now, shiftMs]);

  /** Re-read, refuse if the crontab changed underneath us, then install `next`. */
  const write = async (next: CronLine[], done: string) => {
    if (loaded === null) return;
    setBusy(true);
    setNotice(null);
    try {
      const fresh = await readCrontab();
      if (fresh.kind !== "ok") {
        setNotice({ tone: "error", text: fresh.kind === "error" ? fresh.message : "crontab is not available." });
        return;
      }
      if (fresh.text !== loaded) {
        setLoaded(fresh.text);
        setEditing(null);
        setConfirmDel(null);
        setNotice({ tone: "error", text: "The crontab changed on the server since it was loaded. It has been reloaded — please make your change again." });
        return;
      }
      const b64 = toBase64Utf8(serializeCrontab(next));
      const out = await run(`printf '%s' '${b64}' | base64 -d | crontab - 2>&1; echo "__RC__:$?"`);
      const rcIdx = out.lastIndexOf("__RC__:");
      const rc = rcIdx >= 0 ? parseInt(out.slice(rcIdx + 7), 10) : -1;
      if (rc !== 0) {
        const msg = (rcIdx >= 0 ? out.slice(0, rcIdx) : out).trim();
        setNotice({ tone: "error", text: msg || "crontab rejected the new file." });
        return;
      }
      setEditing(null);
      setConfirmDel(null);
      setNotice({ tone: "info", text: done });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const replaceJob = (job: CronJob, patch: Partial<Pick<CronJob, "enabled" | "schedule" | "command">>) => {
    const updated = { ...job, ...patch };
    return lines.map((l) => (l === job ? { ...updated, raw: jobLine(updated.enabled, updated.schedule, updated.command) } : l));
  };

  const toggleJob = (job: CronJob) =>
    void write(replaceJob(job, { enabled: !job.enabled }), job.enabled ? "Job disabled." : "Job enabled.");
  const saveJob = (job: CronJob, schedule: string, command: string) =>
    void write(replaceJob(job, { schedule, command }), "Job saved.");
  const deleteJob = (job: CronJob) =>
    void write(lines.filter((l) => l !== job), "Job deleted.");
  const addJob = (schedule: string, command: string) =>
    void write([...lines, { kind: "job", id: "new", enabled: true, schedule, command, raw: jobLine(true, schedule, command) }], "Job added.");

  /** Cron treats an unescaped % as a newline; in a shell it's literal. */
  const runNow = (job: CronJob) => sendToTerminal(socket, job.command.replace(/\\%/g, "%"));

  const fg = colors.foreground;
  const border = `${fg}22`;
  const muted = `${fg}88`;

  const header = (
    <>
      <IconBtn fg={fg} title="Add job" disabled={phase !== "ready" || busy} onClick={() => { setEditing("new"); setConfirmDel(null); }}>
        <Plus size={14} />
      </IconBtn>
      <IconBtn fg={fg} title="Reload" disabled={busy} onClick={() => void load()}>
        <RefreshCw size={13} style={busy ? { animation: "fpSpin 0.9s linear infinite" } : undefined} />
      </IconBtn>
    </>
  );

  const footer = phase === "ready" ? (
    <>
      <span>
        {jobs.length} job{jobs.length === 1 ? "" : "s"}
        {(envLines.length > 0 || commentCount > 0) && ` · ${envLines.length + commentCount} other line${envLines.length + commentCount === 1 ? "" : "s"} kept`}
      </span>
      <span style={{ marginLeft: "auto" }} title="Next-run times use the server's time zone">
        {tzOffsetMin !== null ? `server UTC${tzOffsetMin >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, "0")}:${String(Math.abs(tzOffsetMin) % 60).padStart(2, "0")}` : ""}
      </span>
      <Chip fg={fg} border={border} accent={colors.blue} active={showRaw} onClick={() => setShowRaw((v) => !v)} title="Show the raw crontab">
        <FileText size={11} /> Raw
      </Chip>
    </>
  ) : undefined;

  return (
    <FloatingPanel
      title="Cron"
      icon={<CalendarClock size={15} />}
      subtitle={host}
      actions={header}
      footer={footer}
      onClose={onClose}
      width={showRaw && rawWide ? 760 : 480}
      offset={{ right: 80, top: 110 }}
    >
      <div className="scrollbar-green" style={{ flex: "1 1 auto", minHeight: 80, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {!connected ? (
          <PanelMessage>Session not connected.</PanelMessage>
        ) : phase === "loading" ? (
          <PanelMessage icon={<RefreshCw size={16} style={{ animation: "fpSpin 0.9s linear infinite" }} />}>Reading crontab…</PanelMessage>
        ) : phase === "nocron" ? (
          <PanelMessage icon={<CalendarClock size={22} style={{ color: `${fg}55` }} />}>crontab is not installed on this host.</PanelMessage>
        ) : phase === "error" ? (
          <PanelMessage tone="error" icon={<AlertTriangle size={20} />}>{loadError}</PanelMessage>
        ) : (
          <>
            {notice && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 10.5, borderRadius: 6, padding: "6px 8px", color: notice.tone === "error" ? colors.red : colors.green, background: `${notice.tone === "error" ? colors.red : colors.green}14` }}>
                {notice.tone === "error" ? <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> : <Check size={12} style={{ flexShrink: 0, marginTop: 1 }} />}
                <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{notice.text}</span>
              </div>
            )}

            {envLines.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {envLines.map((l, i) => (
                  <span key={i} title={l.raw} style={{ fontSize: 9.5, fontFamily: "ui-monospace, monospace", color: muted, border: `1px solid ${border}`, borderRadius: 4, padding: "1px 5px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.raw.trim()}
                  </span>
                ))}
              </div>
            )}

            {editing === "new" && (
              <JobForm
                title="New job"
                initialSchedule="*/5 * * * *"
                initialCommand=""
                busy={busy}
                runsFor={runsFor}
                onSave={addJob}
                onCancel={() => setEditing(null)}
              />
            )}

            {jobs.length === 0 && editing !== "new" ? (
              <PanelMessage icon={<CalendarClock size={22} style={{ color: `${fg}55` }} />}>
                No cron jobs for this user yet.
                <div style={{ marginTop: 8 }}>
                  <Chip fg={fg} border={border} accent={colors.green} active={false} onClick={() => setEditing("new")}><Plus size={11} /> Add job</Chip>
                </div>
              </PanelMessage>
            ) : (
              jobs.map((job) => {
                if (editing === job.id) {
                  return (
                    <JobForm
                      key={job.id}
                      title="Edit job"
                      initialSchedule={job.schedule}
                      initialCommand={job.command}
                      busy={busy}
                      runsFor={runsFor}
                      onSave={(s, c) => saveJob(job, s, c)}
                      onCancel={() => setEditing(null)}
                    />
                  );
                }
                const next = job.enabled ? runsFor(job.schedule, 1)[0] : undefined;
                const reboot = job.schedule.toLowerCase() === "@reboot";
                const dot = job.enabled ? colors.green : `${fg}44`;
                return (
                  <div key={job.id} style={{ border: `1px solid ${border}`, borderRadius: 9, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 5, background: `${fg}08`, opacity: job.enabled ? 1 : 0.7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: job.enabled ? `0 0 6px ${dot}` : "none" }} />
                      <code style={{ fontSize: 11, color: fg, fontFamily: "ui-monospace, monospace" }}>{job.schedule}</code>
                      <span style={{ fontSize: 10.5, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{describeSchedule(job.schedule)}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: job.enabled ? colors.cyan : `${fg}66`, whiteSpace: "nowrap" }} title={next ? `${formatRunTime(next.wall)} (server time)` : undefined}>
                        {!job.enabled ? "disabled" : reboot ? "at boot" : next ? formatRelative(next.real, now) : "never"}
                      </span>
                    </div>
                    <div title={job.command} style={{ fontSize: 10.5, fontFamily: "ui-monospace, monospace", color: `${fg}bb`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.command}
                    </div>
                    {confirmDel === job.id ? (
                      <ConfirmBar inline text="Delete this job?" fg={fg} border={border} red={colors.red} onYes={() => deleteJob(job)} onNo={() => setConfirmDel(null)} />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <IconBtn fg={fg} title={job.enabled ? "Disable" : "Enable"} disabled={busy} onClick={() => toggleJob(job)}>
                          <Power size={12} style={{ color: job.enabled ? colors.green : undefined }} />
                        </IconBtn>
                        <IconBtn fg={fg} title="Edit" disabled={busy} onClick={() => { setEditing(job.id); setConfirmDel(null); }}><Pencil size={12} /></IconBtn>
                        <IconBtn fg={fg} title="Run now in the terminal" onClick={() => runNow(job)}><Play size={12} /></IconBtn>
                        <div style={{ flex: 1 }} />
                        <IconBtn fg={fg} title="Delete" disabled={busy} onClick={() => setConfirmDel(job.id)}><Trash2 size={12} style={{ color: colors.red }} /></IconBtn>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {showRaw && phase === "ready" && (
        <LogPane
          kind="static"
          title="crontab -l"
          subject={host ?? ""}
          icon={<FileText size={12} />}
          text={loaded}
          onRefresh={() => void load()}
          downloadName="crontab.txt"
          wide={rawWide}
          onToggleWide={() => setRawWide((w) => !w)}
          onClose={() => { setShowRaw(false); setRawWide(false); }}
          height="30vh"
        />
      )}
    </FloatingPanel>
  );
}

/* ── Add / edit form ───────────────────────────────────────── */

function JobForm({ title, initialSchedule, initialCommand, busy, runsFor, onSave, onCancel }: {
  title: string;
  initialSchedule: string;
  initialCommand: string;
  busy: boolean;
  runsFor: (schedule: string, count: number) => { wall: Date; real: Date }[];
  onSave: (schedule: string, command: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;
  const [schedule, setSchedule] = useState(initialSchedule);
  const [command, setCommand] = useState(initialCommand);

  const scheduleErr = validateSchedule(schedule);
  const commandErr = !command.trim() ? "Command is required" : /[\r\n]/.test(command) ? "Command must be a single line" : null;
  const reboot = schedule.trim().toLowerCase() === "@reboot";
  const runs = scheduleErr || reboot ? [] : runsFor(schedule, 3);
  const canSave = !scheduleErr && !commandErr && !busy;

  const input: React.CSSProperties = {
    width: "100%", fontSize: 11, fontFamily: "ui-monospace, monospace", color: fg,
    background: `${fg}0d`, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 7px", outline: "none",
  };

  return (
    <div style={{ border: `1px solid ${colors.blue}55`, borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 7, background: `${colors.blue}0a` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: fg }}>{title}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {CRON_PRESETS.map((p) => (
          <Chip key={p.schedule} fg={fg} border={border} accent={colors.blue} active={schedule.trim() === p.schedule} onClick={() => setSchedule(p.schedule)}>
            {p.label}
          </Chip>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 9.5, color: `${fg}77`, marginBottom: 3 }}>Schedule — minute hour day-of-month month day-of-week, or @macro</div>
        <input value={schedule} onChange={(e) => setSchedule(e.target.value)} spellCheck={false} placeholder="*/5 * * * *"
          style={{ ...input, borderColor: scheduleErr ? `${colors.red}88` : border }} />
        <div style={{ fontSize: 10, marginTop: 3, color: scheduleErr ? colors.red : `${fg}99` }}>
          {scheduleErr ?? (reboot
            ? "Runs once when the server boots."
            : <>{describeSchedule(schedule)} · next: {runs.length ? runs.map((r) => formatRunTime(r.wall)).join(", ") : "never"}</>)}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9.5, color: `${fg}77`, marginBottom: 3 }}>Command</div>
        <input value={command} onChange={(e) => setCommand(e.target.value)} spellCheck={false} placeholder="/usr/local/bin/backup.sh >> /var/log/backup.log 2>&1"
          onKeyDown={(e) => { if (e.key === "Enter" && canSave) onSave(schedule.trim(), command.trim()); }}
          style={{ ...input, borderColor: command && commandErr ? `${colors.red}88` : border }} />
        {command && commandErr && <div style={{ fontSize: 10, marginTop: 3, color: colors.red }}>{commandErr}</div>}
        {/(^|[^\\])%/.test(command) && (
          <div style={{ fontSize: 10, marginTop: 3, color: colors.yellow }}>Cron treats an unescaped % as a newline — write \% for a literal percent sign.</div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button onClick={onCancel} style={{ fontSize: 10.5, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>Cancel</button>
        <button
          onClick={() => canSave && onSave(schedule.trim(), command.trim())}
          disabled={!canSave}
          style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: canSave ? colors.green : `${fg}33`, border: "none", borderRadius: 5, padding: "3px 10px", cursor: canSave ? "pointer" : "default" }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
