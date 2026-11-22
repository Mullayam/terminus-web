import { useEffect, useMemo, useState } from "react";
import { BookOpen, FileText, FolderSearch, RefreshCw, ScrollText, Search, X } from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { LogPane, TailSelect } from "./log-pane";
import { Chip, IconBtn, SearchInput } from "./widget-parts";
import { askAI, sendToTerminal, shQuote, useSilentExec, type Tail } from "./widget-utils";
import { useExecStream } from "./use-exec-stream";
import type { PanelProps } from "./panels";

/** Well-known log locations; only files that exist and are readable are listed. */
const LOG_GLOBS = [
  "/var/log/syslog", "/var/log/messages", "/var/log/auth.log", "/var/log/secure",
  "/var/log/kern.log", "/var/log/dmesg", "/var/log/*.log",
  "/var/log/nginx/*.log", "/var/log/apache2/*.log", "/var/log/httpd/*_log",
  "/var/log/mysql/*.log", "/var/log/postgresql/*.log", "/var/log/redis/*.log",
  "/var/log/mongodb/*.log", "/var/log/supervisor/*.log", "$HOME/.pm2/logs/*.log",
];

const DISCOVER_CMD =
  `for f in ${LOG_GLOBS.join(" ")}; do ` +
  `[ -f "$f" ] && [ -r "$f" ] && printf '%s|%s\\n' "$(stat -c %s "$f" 2>/dev/null || wc -c < "$f")" "$f"; ` +
  `done 2>/dev/null | sort -u -t '|' -k2`;

const PRIORITIES = [
  { value: "", label: "all levels" },
  { value: "err", label: "errors" },
  { value: "warning", label: "warnings+" },
  { value: "info", label: "info+" },
] as const;

type Source = "files" | "journal";
type Target =
  | { kind: "file"; path: string }
  | { kind: "journal"; unit: string; priority: string };

interface LogFile { path: string; size: number }

function fmtSize(n: number): string {
  if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(1)}G`;
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)}M`;
  if (n >= 1 << 10) return `${Math.round(n / (1 << 10))}K`;
  return `${n}B`;
}

function targetCmd(t: Target, tail: Tail): string {
  const n = tail === "all" ? "+1" : tail;
  if (t.kind === "file") return `tail -n ${n} -F ${shQuote(t.path)} 2>&1`;
  const lines = tail === "all" ? "all" : tail;
  return `journalctl -f -n ${lines} --no-pager -o short-iso` +
    (t.unit ? ` -u ${shQuote(t.unit)}` : "") +
    (t.priority ? ` -p ${t.priority}` : "") + " 2>&1";
}

function targetLabel(t: Target): string {
  if (t.kind === "file") return t.path;
  return `journal${t.unit ? ` · ${t.unit}` : ""}${t.priority ? ` · ${t.priority}` : ""}`;
}

export default function LogsPanel({ sessionId, onClose }: PanelProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host ?? "");
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;
  const connected = status === "connected" && !!socket;
  const run = useSilentExec(connected ? socket : null, `logs-${sessionId}`);

  const recentKey = `terminus-recent-logs:${host}`;
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(recentKey) ?? "[]"); } catch { return []; }
  });

  const [source, setSource] = useState<Source>("files");
  const [files, setFiles] = useState<LogFile[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pathDraft, setPathDraft] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [unit, setUnit] = useState("");
  const [priority, setPriority] = useState("");

  const [target, setTarget] = useState<Target | null>(null);
  const [tail, setTail] = useState<Tail>("100");
  const [stopped, setStopped] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [wide, setWide] = useState(false);

  const scan = async () => {
    setScanning(true);
    const out = await run(DISCOVER_CMD);
    const list: LogFile[] = [];
    for (const line of out.split("\n")) {
      const i = line.indexOf("|");
      if (i < 0) continue;
      const path = line.slice(i + 1).trim();
      if (path.startsWith("/")) list.push({ path, size: Number(line.slice(0, i)) || 0 });
    }
    setFiles(list);
    setScanning(false);
  };

  useEffect(() => {
    if (connected) void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const remember = (path: string) => {
    const next = [path, ...recent.filter((p) => p !== path)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const openFile = (path: string) => {
    const p = path.trim();
    if (!p) return;
    remember(p);
    setStopped(false);
    setTarget({ kind: "file", path: p });
  };
  const openJournal = () => {
    setStopped(false);
    setTarget({ kind: "journal", unit: unit.trim(), priority });
  };

  const cmd = target && connected && !stopped ? targetCmd(target, tail) : null;
  const stream = useExecStream(socket, cmd, runKey);

  // Permission problems are common for /var/log — offer the sudo route.
  const denied = useMemo(
    () => stream.lines.slice(0, 5).some((l) => /permission denied|cannot open|no journal files|not seeing messages/i.test(l)),
    [stream.lines],
  );

  const visibleFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    return (files ?? []).filter((f) => !q || f.path.toLowerCase().includes(q));
  }, [files, fileQuery]);

  const terminalCmd = target
    ? `${denied ? "sudo " : ""}${targetCmd(target, tail).replace(/ 2>&1$/, "")}`
    : "";

  return (
    <FloatingPanel
      title="Logs"
      icon={<ScrollText size={15} />}
      subtitle={host}
      onClose={onClose}
      width={target ? (wide ? 980 : 600) : 440}
      maxHeight={wide ? "90vh" : "82vh"}
      offset={{ right: 30, top: 84 }}
    >
      {/* Source picker */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <Chip fg={fg} border={border} accent={colors.blue} active={source === "files"} onClick={() => setSource("files")}>
          <FileText size={11} /> Files
        </Chip>
        <Chip fg={fg} border={border} accent={colors.blue} active={source === "journal"} onClick={() => setSource("journal")}>
          <BookOpen size={11} /> Journal
        </Chip>
        <div style={{ flex: 1 }} />
        {source === "files" && (
          <IconBtn fg={fg} title="Rescan log files" onClick={() => void scan()}>
            <RefreshCw size={12} style={scanning ? { animation: "fpSpin 0.9s linear infinite" } : undefined} />
          </IconBtn>
        )}
      </div>

      {source === "files" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", flexShrink: 0, maxHeight: target ? 190 : 420, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <SearchInput
              value={pathDraft} onChange={setPathDraft} onEnter={() => openFile(pathDraft)}
              placeholder="/path/to/app.log — Enter to follow" fg={fg} border={border} icon={<FolderSearch size={12} />}
            />
            <button
              onClick={() => openFile(pathDraft)}
              disabled={!pathDraft.trim()}
              style={{ fontSize: 10.5, color: pathDraft.trim() ? "#fff" : `${fg}55`, background: pathDraft.trim() ? colors.blue : "transparent", border: `1px solid ${pathDraft.trim() ? colors.blue : border}`, borderRadius: 6, padding: "3px 10px", cursor: pathDraft.trim() ? "pointer" : "default" }}
            >
              Follow
            </button>
          </div>

          {recent.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {recent.map((p) => (
                <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 9.5, color: `${fg}aa`, border: `1px solid ${border}`, borderRadius: 10, padding: "1px 4px 1px 7px", maxWidth: 220 }}>
                  <button onClick={() => openFile(p)} title={p} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", fontSize: 9.5, padding: 0 }}>
                    {p.split("/").pop()}
                  </button>
                  <IconBtn fg={fg} title="Forget" onClick={() => {
                    const next = recent.filter((r) => r !== p);
                    setRecent(next);
                    try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* ignore */ }
                  }}><X size={9} /></IconBtn>
                </span>
              ))}
            </div>
          )}

          {(files?.length ?? 0) > 6 && (
            <SearchInput value={fileQuery} onChange={setFileQuery} placeholder="Filter discovered logs" fg={fg} border={border} icon={<Search size={11} />} />
          )}

          <div className="scrollbar-green" style={{ overflowY: "auto", minHeight: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            {!connected ? (
              <PanelMessage>Session not connected.</PanelMessage>
            ) : files === null ? (
              <PanelMessage><RefreshCw size={13} style={{ animation: "fpSpin 0.9s linear infinite" }} /> Looking for log files…</PanelMessage>
            ) : visibleFiles.length === 0 ? (
              <PanelMessage>
                No readable logs found in the usual places. Type a path above, or use Journal.
              </PanelMessage>
            ) : (
              visibleFiles.map((f) => {
                const active = target?.kind === "file" && target.path === f.path;
                return (
                  <button
                    key={f.path}
                    onClick={() => openFile(f.path)}
                    title={f.path}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                      fontSize: 10.5, color: active ? fg : `${fg}bb`, fontFamily: "ui-monospace, monospace",
                      background: active ? `${colors.blue}1e` : "transparent", border: `1px solid ${active ? `${colors.blue}55` : "transparent"}`,
                      borderRadius: 5, padding: "3px 7px", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = `${fg}0d`; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <FileText size={11} style={{ flexShrink: 0, color: `${fg}66` }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{f.path}</span>
                    <span style={{ color: `${fg}55`, fontSize: 9.5 }}>{fmtSize(f.size)}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", flexShrink: 0 }}>
          <SearchInput value={unit} onChange={setUnit} onEnter={openJournal} placeholder="unit (e.g. nginx) — empty for all" fg={fg} border={border} icon={<BookOpen size={12} />} />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={{ fontSize: 10.5, color: fg, background: "transparent", border: `1px solid ${border}`, borderRadius: 6, padding: "3px 4px" }}
          >
            {PRIORITIES.map((p) => <option key={p.value} value={p.value} style={{ color: "#000" }}>{p.label}</option>)}
          </select>
          <button
            onClick={openJournal}
            style={{ fontSize: 10.5, color: "#fff", background: colors.blue, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            Follow
          </button>
        </div>
      )}

      {target && denied && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: fg, background: `${colors.yellow}18`, padding: "5px 12px", flexShrink: 0 }}>
          <span>This log needs more permissions than the SSH user has.</span>
          <button
            onClick={() => sendToTerminal(socket, terminalCmd)}
            style={{ marginLeft: "auto", fontSize: 10, color: fg, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "2px 8px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Open with sudo in terminal
          </button>
        </div>
      )}

      {target && (
        <LogPane
          kind="stream"
          title={target.kind === "file" ? "File" : "Journal"}
          subject={targetLabel(target)}
          icon={target.kind === "file" ? <FileText size={12} /> : <BookOpen size={12} />}
          stream={stream}
          stopped={stopped}
          onStop={() => setStopped(true)}
          onRestart={() => { setStopped(false); setRunKey((k) => k + 1); }}
          onTerminal={() => sendToTerminal(socket, terminalCmd)}
          onExplain={(text) => askAI(sessionId, `Recent lines from ${targetLabel(target)} on ${host}:\n${text}`)}
          highlight
          options={<TailSelect value={tail} onChange={setTail} />}
          downloadName={`${(target.kind === "file" ? target.path.split("/").pop() : "journal") || "log"}.log`}
          wide={wide}
          onToggleWide={() => setWide((w) => !w)}
          onClose={() => { setTarget(null); setWide(false); }}
          height="44vh"
        />
      )}
    </FloatingPanel>
  );
}
