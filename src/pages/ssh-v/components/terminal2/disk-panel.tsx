import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  Brush,
  Copy,
  File as FileIcon,
  Folder,
  FolderOpen,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal as TerminalIcon,
  Trash2,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import type { PanelProps } from "./panels";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { Chip, ConfirmBar, IconBtn, MoreMenu, type MenuItem } from "./widget-parts";
import { askAI, sendToTerminal, shQuote, useSilentExec } from "./widget-utils";
import { openPathInFiles } from "../../files-link";
import {
  CLEANUP_ACTIONS,
  CLEANUP_CMD,
  MOUNTS_CMD,
  baseName,
  bigFilesCmd,
  crumbs,
  deleteCmd,
  duCmd,
  fmtBytes,
  isProtected,
  normPath,
  parentOf,
  parseBigFiles,
  parseCleanup,
  parseDu,
  parseMounts,
  splitRc,
  type BigFile,
  type CleanupInfo,
  type CleanupKey,
  type DuResult,
  type Mount,
} from "./disk-utils";

type View = "overview" | "explore" | "cleanup";
type ExploreMode = "folders" | "files";

interface Target { path: string; size: number | null; isDir: boolean }

const PERM_RE = /permission denied|operation not permitted|read-only file system/i;

export default function DiskPanel({ sessionId, onClose }: PanelProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host ?? "");
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;
  const track = `${fg}14`;
  const connected = status === "connected" && !!socket;
  const run = useSilentExec(connected ? socket : null, `disk-${sessionId}`);

  const [view, setView] = useState<View>("overview");
  const [mounts, setMounts] = useState<Mount[] | null>(null);
  const [mountsLoading, setMountsLoading] = useState(false);

  const [path, setPath] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [mode, setMode] = useState<ExploreMode>("folders");
  const [sudo, setSudo] = useState(false);
  const [du, setDu] = useState<DuResult | null>(null);
  const [files, setFiles] = useState<{ files: BigFile[]; timedOut: boolean; noSudo: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  const duCache = useRef(new Map<string, DuResult>());
  const reqRef = useRef(0);

  const [cleanup, setCleanup] = useState<CleanupInfo | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupConfirm, setCleanupConfirm] = useState<{ key: CleanupKey; label: string } | null>(null);

  const [confirmDel, setConfirmDel] = useState<Target | null>(null);
  const [delErr, setDelErr] = useState<{ target: Target; message: string; perm: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);

  const mountPoints = useMemo(() => (mounts ?? []).map((m) => m.mount), [mounts]);

  /* ── Loaders ─────────────────────────────────────────────── */

  const loadMounts = useCallback(async () => {
    setMountsLoading(true);
    const out = await run(MOUNTS_CMD);
    setMounts(parseMounts(out));
    setMountsLoading(false);
  }, [run]);

  useEffect(() => {
    if (connected) void loadMounts();
  }, [connected, loadMounts]);

  const scanFolders = useCallback(async (p: string, withSudo: boolean, force = false) => {
    const key = `${withSudo ? "S" : "U"}:${p}`;
    const cached = duCache.current.get(key);
    const id = ++reqRef.current; // also invalidates any scan still in flight
    if (cached && !force) { setDu(cached); setScanning(false); return; }
    setScanning(true);
    setDu(null);
    const res = parseDu(await run(duCmd(p, withSudo)), p);
    if (id !== reqRef.current) return; // navigated away meanwhile
    if (!res.noSudo) duCache.current.set(key, res);
    setDu(res);
    setScanning(false);
  }, [run]);

  const scanFiles = useCallback(async (p: string, withSudo: boolean) => {
    const id = ++reqRef.current;
    setScanning(true);
    setFiles(null);
    const res = parseBigFiles(await run(bigFilesCmd(p, withSudo)));
    if (id !== reqRef.current) return;
    setFiles(res);
    setScanning(false);
  }, [run]);

  // Re-scan whenever the folder, mode or sudo choice changes.
  useEffect(() => {
    if (!connected || !path || view !== "explore") return;
    if (mode === "folders") void scanFolders(path, sudo);
    else void scanFiles(path, sudo);
  }, [connected, path, mode, sudo, view, scanFolders, scanFiles]);

  const loadCleanup = useCallback(async () => {
    setCleanupLoading(true);
    setCleanup(parseCleanup(await run(CLEANUP_CMD)));
    setCleanupLoading(false);
  }, [run]);

  useEffect(() => {
    if (connected && view === "cleanup" && !cleanup && !cleanupLoading) void loadCleanup();
  }, [connected, view, cleanup, cleanupLoading, loadCleanup]);

  /* ── Navigation ──────────────────────────────────────────── */

  const go = (p: string, pushHistory = true) => {
    const next = normPath(p);
    if (pushHistory && path && path !== next) setHistory((h) => [...h, path].slice(-30));
    setPath(next);
    setView("explore");
    setConfirmDel(null);
    setDelErr(null);
    setNotice(null);
  };
  const back = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    go(prev, false);
  };

  const refresh = () => {
    if (view === "overview") void loadMounts();
    else if (view === "cleanup") void loadCleanup();
    else if (path) {
      if (mode === "folders") void scanFolders(path, sudo, true);
      else void scanFiles(path, sudo);
    }
  };

  /* ── Row actions ─────────────────────────────────────────── */

  const copy = (text: string) => { void navigator.clipboard?.writeText(text).catch(() => { }); };

  const requestDelete = (t: Target) => {
    setDelErr(null);
    if (isProtected(t.path, mountPoints)) {
      setNotice(`${t.path} is a system folder or mount point — it can't be deleted from here.`);
      setConfirmDel(null);
      return;
    }
    setNotice(null);
    setConfirmDel(t);
  };

  const doDelete = async (t: Target) => {
    setConfirmDel(null);
    setBusyPath(t.path);
    const { body, rc } = splitRc(await run(deleteCmd(t.path, t.isDir)));
    setBusyPath(null);
    if (rc !== 0) {
      setDelErr({ target: t, message: body.split("\n").find((l) => l.trim()) || `rm failed (exit ${rc})`, perm: PERM_RE.test(body) });
      return;
    }
    setNotice(`Deleted ${t.path}${t.size ? ` (${fmtBytes(t.size)})` : ""}.`);
    // Sizes up the tree are stale now.
    duCache.current.clear();
    refresh();
  };

  const rowMenu = (t: Target): MenuItem[] => [
    { label: "Open in Files", icon: <FolderOpen size={12} />, onClick: () => void openPathInFiles(sessionId, t.path) },
    { label: "Copy path", icon: <Copy size={12} />, onClick: () => copy(t.path) },
    { label: "Delete…", icon: <Trash2 size={12} />, danger: true, onClick: () => requestDelete(t) },
  ];

  const explain = () => {
    const lines: string[] = [`Disk usage on ${host}:`];
    for (const m of mounts ?? []) {
      lines.push(`${m.mount} (${m.type || m.fs}): ${fmtBytes(m.used)} used of ${fmtBytes(m.size)} — ${m.pct}%${m.inodePct !== null && m.inodePct >= 80 ? `, inodes ${m.inodePct}%` : ""}`);
    }
    if (path && du && du.children.length) {
      lines.push("", `Largest folders in ${path} (total ${fmtBytes(du.total)}):`);
      for (const c of du.children.slice(0, 15)) lines.push(`${fmtBytes(c.size)}\t${c.path}`);
    }
    if (path && files && files.files.length) {
      lines.push("", `Biggest files under ${path}:`);
      for (const f of files.files.slice(0, 15)) lines.push(`${fmtBytes(f.size)}\t${f.date}\t${f.path}`);
    }
    lines.push("", "What is using the space, and what is safe to clean up?");
    askAI(sessionId, lines.join("\n"));
  };

  /* ── Render helpers ──────────────────────────────────────── */

  const pctColor = (pct: number) => (pct >= 90 ? colors.red : pct >= 80 ? colors.yellow : colors.green);

  const bar = (pct: number, color: string) => (
    <div style={{ height: 4, borderRadius: 2, background: track, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: color, transition: "width 0.3s ease" }} />
    </div>
  );

  const rowStyle: React.CSSProperties = {
    border: `1px solid ${border}`, borderRadius: 8, padding: "6px 8px",
    display: "flex", flexDirection: "column", gap: 4, background: `${fg}08`,
  };

  const spinner = <RefreshCw size={14} style={{ animation: "fpSpin 0.9s linear infinite" }} />;

  const sudoHint = (noSudo: boolean, skipped: boolean) => {
    if (noSudo) {
      return (
        <div style={{ fontSize: 10.5, color: fg, background: `${colors.yellow}18`, borderRadius: 6, padding: "5px 8px" }}>
          sudo needs a password on this host, so the panel can't scan as root. Run the scan in the terminal instead:
          <button
            onClick={() => path && sendToTerminal(socket, mode === "folders"
              ? `sudo du -x -h -d1 ${shQuote(path)} 2>/dev/null | sort -hr | head -40`
              : `sudo find ${shQuote(path)} -xdev -type f -size +20M -exec ls -lh {} + 2>/dev/null | sort -k5 -hr | head -40`)}
            style={{ marginLeft: 6, fontSize: 10, color: fg, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "1px 7px", cursor: "pointer" }}
          >
            <TerminalIcon size={10} style={{ verticalAlign: -1 }} /> Run in terminal
          </button>
          <button onClick={() => setSudo(false)} style={{ marginLeft: 4, fontSize: 10, color: `${fg}aa`, background: "transparent", border: "none", cursor: "pointer" }}>
            Scan without sudo
          </button>
        </div>
      );
    }
    if (skipped && !sudo) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: `${fg}aa`, background: `${colors.yellow}12`, borderRadius: 6, padding: "4px 8px" }}>
          <AlertTriangle size={11} style={{ color: colors.yellow, flexShrink: 0 }} />
          <span>Some folders couldn't be read and were skipped, so sizes may be low.</span>
          <button onClick={() => setSudo(true)} style={{ marginLeft: "auto", fontSize: 10, color: fg, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "1px 7px", cursor: "pointer", whiteSpace: "nowrap" }}>
            <ShieldCheck size={10} style={{ verticalAlign: -1 }} /> Scan with sudo
          </button>
        </div>
      );
    }
    return null;
  };

  /* ── Views ───────────────────────────────────────────────── */

  const overview = !connected ? (
    <PanelMessage>Session not connected.</PanelMessage>
  ) : !mounts ? (
    <PanelMessage icon={spinner}>Reading mounts…</PanelMessage>
  ) : mounts.length === 0 ? (
    <PanelMessage icon={<HardDrive size={22} style={{ color: `${fg}55` }} />}>No disks reported by <code>df</code>.</PanelMessage>
  ) : (
    mounts.map((m) => (
      <button
        key={m.mount}
        onClick={() => { setHistory([]); setMode("folders"); go(m.mount, false); }}
        title={`Explore ${m.mount}`}
        style={{ ...rowStyle, textAlign: "left", cursor: "pointer", color: fg }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${colors.blue}66`; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = border; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
          <HardDrive size={12} style={{ color: pctColor(m.pct), flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.mount}</span>
          <span style={{ fontSize: 9.5, color: `${fg}66`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.fs}>{m.type || m.fs}</span>
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: pctColor(m.pct), fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{m.pct}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          {bar(m.pct, pctColor(m.pct))}
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 9.5, color: `${fg}88`, width: "100%", fontVariantNumeric: "tabular-nums" }}>
          <span>{fmtBytes(m.used)} used</span>
          <span>{fmtBytes(m.free)} free</span>
          <span>{fmtBytes(m.size)} total</span>
          {m.inodePct !== null && m.inodePct >= 80 && (
            <span style={{ marginLeft: "auto", color: pctColor(m.inodePct) }} title="Inode usage — many small files">inodes {m.inodePct}%</span>
          )}
        </div>
      </button>
    ))
  );

  const total = du?.total ?? du?.children.reduce((s, c) => s + c.size, 0) ?? 0;
  const childSum = du?.children.reduce((s, c) => s + c.size, 0) ?? 0;
  const looseFiles = du?.total !== null && du?.total !== undefined ? Math.max(0, du.total - childSum) : 0;

  const folderRow = (t: Target, pctOfParent: number | null, clickable: boolean) => {
    const confirming = confirmDel?.path === t.path;
    const busy = busyPath === t.path;
    return (
      <div key={t.path} style={rowStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {t.isDir ? <Folder size={12} style={{ color: colors.blue, flexShrink: 0 }} /> : <FileIcon size={12} style={{ color: `${fg}88`, flexShrink: 0 }} />}
          <button
            onClick={() => clickable && go(t.path)}
            disabled={!clickable}
            title={t.path}
            style={{ background: "transparent", border: "none", padding: 0, color: fg, cursor: clickable ? "pointer" : "default", fontSize: 11, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", minWidth: 0, flex: 1 }}
          >
            {path && t.path.startsWith(path === "/" ? "/" : `${path}/`) ? t.path.slice(path === "/" ? 1 : path.length + 1) : t.path}
          </button>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: fg, fontVariantNumeric: "tabular-nums" }}>{fmtBytes(t.size)}</span>
          {pctOfParent !== null && <span style={{ fontSize: 9.5, color: `${fg}66`, width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pctOfParent.toFixed(pctOfParent < 10 ? 1 : 0)}%</span>}
          {busy ? spinner : <MoreMenu items={rowMenu(t)} fg={fg} bg={colors.background} border={border} />}
        </div>
        {pctOfParent !== null && bar(pctOfParent, pctOfParent >= 50 ? colors.yellow : colors.cyan)}
        {confirming && (
          <ConfirmBar
            inline
            text={`Delete ${t.isDir ? "folder" : "file"} ${t.path}${t.size ? ` (${fmtBytes(t.size)})` : ""}? This can't be undone.`}
            fg={fg} border={border} red={colors.red}
            onYes={() => void doDelete(t)}
            onNo={() => setConfirmDel(null)}
          />
        )}
        {delErr?.target.path === t.path && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: colors.red }}>
            <AlertTriangle size={11} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={delErr.message}>{delErr.message}</span>
            {delErr.perm && (
              <button
                onClick={() => { sendToTerminal(socket, `sudo rm ${t.isDir ? "-rf" : "-f"} -- ${shQuote(t.path)}`); setDelErr(null); }}
                style={{ marginLeft: "auto", fontSize: 10, color: fg, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "1px 7px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <TerminalIcon size={10} style={{ verticalAlign: -1 }} /> Run in terminal with sudo
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const explore = !path ? (
    <PanelMessage>Pick a disk in Overview to start exploring.</PanelMessage>
  ) : scanning ? (
    <PanelMessage icon={spinner}>
      Scanning {path}…
      <div style={{ fontSize: 10, color: `${fg}66`, marginTop: 4 }}>This can take a while on big disks (stops after 60s).</div>
    </PanelMessage>
  ) : mode === "folders" ? (
    !du ? null : (
      <>
        {sudoHint(du.noSudo, du.partial)}
        {du.timedOut && (
          <div style={{ fontSize: 10.5, color: colors.yellow, display: "flex", alignItems: "center", gap: 5 }}>
            <AlertTriangle size={11} /> The scan hit the 60s limit — sizes below are partial. Drill into a sub-folder for exact numbers.
          </div>
        )}
        {!du.noSudo && du.children.length === 0 && (
          <PanelMessage>{du.total !== null ? `No sub-folders — ${fmtBytes(du.total)} in files here. Try “Biggest files”.` : "Nothing could be read here."}</PanelMessage>
        )}
        {du.children.map((c) => folderRow({ path: c.path, size: c.size, isDir: true }, total ? (c.size / total) * 100 : 0, true))}
        {looseFiles > 0 && du.children.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, color: `${fg}77`, padding: "2px 9px" }}>
            <FileIcon size={11} /> files directly in this folder
            <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{fmtBytes(looseFiles)}</span>
          </div>
        )}
      </>
    )
  ) : (
    !files ? null : (
      <>
        {sudoHint(files.noSudo, false)}
        {files.timedOut && (
          <div style={{ fontSize: 10.5, color: colors.yellow, display: "flex", alignItems: "center", gap: 5 }}>
            <AlertTriangle size={11} /> The search hit the 60s limit — the list may be incomplete.
          </div>
        )}
        {!files.noSudo && files.files.length === 0 && (
          <PanelMessage>No files over 20 MB under {path}.</PanelMessage>
        )}
        {files.files.map((f) => (
          <div key={f.path}>
            {folderRow({ path: f.path, size: f.size, isDir: false }, null, false)}
            <div style={{ fontSize: 9, color: `${fg}55`, padding: "1px 9px 0" }}>modified {f.date}</div>
          </div>
        ))}
      </>
    )
  );

  const cleanupRow = (key: CleanupKey, label: string, detail: React.ReactNode, show: boolean) => {
    if (!show) return null;
    const cmd = CLEANUP_ACTIONS[key];
    const confirming = cleanupConfirm?.key === key;
    return (
      <div key={key} style={rowStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Brush size={12} style={{ color: colors.cyan, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: fg }}>{label}</span>
          <span style={{ fontSize: 10.5, color: `${fg}aa`, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{detail}</span>
          <button
            onClick={() => setCleanupConfirm({ key, label })}
            style={{ fontSize: 10, color: fg, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "2px 8px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Clean…
          </button>
        </div>
        <code style={{ fontSize: 9.5, color: `${fg}77`, fontFamily: "ui-monospace, monospace" }}>{cmd}</code>
        {confirming && (
          <ConfirmBar
            inline
            text={`Run “${cmd}” in the terminal?`}
            fg={fg} border={border} red={colors.red}
            onYes={() => { sendToTerminal(socket, cmd); setCleanupConfirm(null); setCleanup(null); }}
            onNo={() => setCleanupConfirm(null)}
          />
        )}
      </div>
    );
  };

  const cleanupView = !connected ? (
    <PanelMessage>Session not connected.</PanelMessage>
  ) : cleanupLoading || !cleanup ? (
    <PanelMessage icon={spinner}>Checking the usual space hogs…</PanelMessage>
  ) : (
    <>
      <div style={{ fontSize: 10.5, color: `${fg}77` }}>
        Each clean-up runs in the terminal so you can see it and enter a sudo password. Sizes refresh when you come back here.
      </div>
      {cleanupRow("apt", "APT package cache", fmtBytes(cleanup.apt), cleanup.apt !== null && cleanup.apt > 0)}
      {cleanupRow("journal", "systemd journal", cleanup.journal ?? "—", cleanup.journal !== null)}
      {cleanupRow("rotated", "Rotated logs in /var/log", fmtBytes(cleanup.rotated), cleanup.rotated !== null && cleanup.rotated > 0)}
      {cleanupRow("docker", "Docker (unused images, containers, cache)",
        cleanup.docker?.filter((d) => !/^0B/.test(d.reclaimable)).map((d) => `${d.type}: ${d.reclaimable}`).join(" · ") || "nothing reclaimable",
        !!cleanup.docker)}
      {cleanupRow("cache", "Your ~/.cache", fmtBytes(cleanup.cache), cleanup.cache !== null && cleanup.cache > 0)}
      {cleanup.snap && cleanup.snap.length > 0 && (
        <div style={rowStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Brush size={12} style={{ color: `${fg}66` }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: fg }}>Old snap revisions</span>
            <span style={{ fontSize: 10, color: `${fg}77`, marginLeft: "auto" }}>{cleanup.snap.length} disabled</span>
          </div>
          <div style={{ fontSize: 10, color: `${fg}99`, fontFamily: "ui-monospace, monospace" }}>{cleanup.snap.join(", ")}</div>
          <div style={{ fontSize: 9.5, color: `${fg}66` }}>Remove one with <code>sudo snap remove &lt;name&gt; --revision=&lt;rev&gt;</code>.</div>
        </div>
      )}
      {cleanup.apt === null && !cleanup.journal && !cleanup.rotated && !cleanup.docker && !cleanup.cache && !(cleanup.snap?.length) && (
        <PanelMessage>Nothing obvious to clean up.</PanelMessage>
      )}
    </>
  );

  return (
    <FloatingPanel
      title="Disk usage"
      icon={<HardDrive size={15} />}
      subtitle={host}
      onClose={onClose}
      width={500}
      maxHeight="82vh"
      offset={{ right: 50, top: 100 }}
      actions={
        <>
          <IconBtn fg={fg} title="Ask AI about disk usage" onClick={explain} disabled={!mounts}><Sparkles size={13} /></IconBtn>
          <IconBtn fg={fg} title="Refresh" onClick={refresh}>
            <RefreshCw size={13} style={mountsLoading || scanning || cleanupLoading ? { animation: "fpSpin 0.9s linear infinite" } : undefined} />
          </IconBtn>
        </>
      }
      footer={
        view === "explore" && path ? (
          <>
            <span>{mode === "folders" ? `Total ${fmtBytes(du?.total ?? null)}` : `${files?.files.length ?? 0} files over 20 MB`}</span>
            {sudo && <span style={{ color: colors.yellow }}>scanning as root</span>}
            <span style={{ marginLeft: "auto" }}>same filesystem only (-x)</span>
          </>
        ) : undefined
      }
    >
      {/* View switch */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <Chip fg={fg} border={border} accent={colors.blue} active={view === "overview"} onClick={() => setView("overview")}>
          <HardDrive size={11} /> Overview
        </Chip>
        <Chip fg={fg} border={border} accent={colors.blue} active={view === "explore"} onClick={() => setView("explore")}>
          <Folder size={11} /> Explore
        </Chip>
        <Chip fg={fg} border={border} accent={colors.blue} active={view === "cleanup"} onClick={() => setView("cleanup")}>
          <Brush size={11} /> Clean up
        </Chip>
        {view === "explore" && path && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <Chip fg={fg} border={border} accent={colors.cyan} active={mode === "folders"} onClick={() => setMode("folders")}>Folders</Chip>
            <Chip fg={fg} border={border} accent={colors.cyan} active={mode === "files"} onClick={() => setMode("files")}>Biggest files</Chip>
          </div>
        )}
      </div>

      {/* Breadcrumbs */}
      {view === "explore" && path && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "5px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0, minWidth: 0 }}>
          <IconBtn fg={fg} title="Back" onClick={back} disabled={history.length === 0}><ArrowLeft size={12} /></IconBtn>
          <IconBtn fg={fg} title="Up one folder" onClick={() => go(parentOf(path))} disabled={path === "/"}><ArrowUp size={12} /></IconBtn>
          <div className="scrollbar-green" style={{ display: "flex", alignItems: "center", gap: 1, overflowX: "auto", minWidth: 0, flex: 1, fontSize: 10.5, fontFamily: "ui-monospace, monospace" }}>
            {crumbs(path).map((c, i, all) => (
              <span key={c} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                {i > 1 && <span style={{ color: `${fg}44`, margin: "0 1px" }}>/</span>}
                <button
                  onClick={() => go(c)}
                  disabled={i === all.length - 1}
                  style={{ background: "transparent", border: "none", padding: "1px 3px", borderRadius: 4, cursor: i === all.length - 1 ? "default" : "pointer", color: i === all.length - 1 ? fg : `${fg}99`, fontWeight: i === all.length - 1 ? 600 : 400, fontFamily: "inherit", fontSize: "inherit" }}
                >
                  {i === 0 ? "/" : baseName(c)}
                </button>
              </span>
            ))}
          </div>
          <IconBtn fg={fg} title="Open this folder in Files" onClick={() => void openPathInFiles(sessionId, path)}><FolderOpen size={12} /></IconBtn>
        </div>
      )}

      {/* Body */}
      <div className="scrollbar-green" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1, minHeight: 0 }}>
        {notice && (
          <div style={{ fontSize: 10.5, color: fg, background: `${colors.blue}18`, borderRadius: 6, padding: "4px 8px" }}>{notice}</div>
        )}
        {view === "overview" ? overview : view === "explore" ? explore : cleanupView}
      </div>
    </FloatingPanel>
  );
}
