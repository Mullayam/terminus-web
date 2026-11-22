import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  Copy,
  Download,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  WrapText,
  X,
} from "lucide-react";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { Chip, IconBtn } from "./widget-parts";
import { TAIL_OPTIONS, type Tail } from "./widget-utils";
import type { ExecStream } from "./use-exec-stream";

export type { Tail };

/** Error-ish lines get tinted so problems stand out while scrolling. */
const ERROR_RE = /\b(error|err|fatal|panic|exception|failed|failure|critical|crit|emerg|traceback)\b/i;
const WARN_RE = /\b(warn|warning|deprecated)\b/i;

interface LogPaneBase {
  title: string;
  /** What the output belongs to (container, file, unit, …). */
  subject: string;
  icon: React.ReactNode;
  wide: boolean;
  onToggleWide: () => void;
  onClose: () => void;
  /** Extra controls in the options row (tail size, timestamps, …). */
  options?: React.ReactNode;
  /** Run the same thing in the interactive terminal. */
  onTerminal?: () => void;
  /** Hand the visible lines to the AI chat. */
  onExplain?: (text: string) => void;
  downloadName: string;
  /** Tint error / warning lines. */
  highlight?: boolean;
  /** Pane height when not expanded (expanded uses 56vh). */
  height?: string;
}

/** Live output from `useExecStream`, with stop / reconnect. */
export interface StreamLogPaneProps extends LogPaneBase {
  kind: "stream";
  stream: ExecStream;
  stopped: boolean;
  onStop: () => void;
  onRestart: () => void;
}

/** A fixed snapshot (inspect, status, …) with a refresh button. */
export interface StaticLogPaneProps extends LogPaneBase {
  kind: "static";
  /** null while loading. */
  text: string | null;
  onRefresh: () => void;
}

export type LogPaneProps = StreamLogPaneProps | StaticLogPaneProps;

export function LogPane(props: LogPaneProps) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;
  const accent = colors.blue;
  const { green, red, yellow } = colors;
  const isStream = props.kind === "stream";

  const [filter, setFilter] = useState("");
  const [wrap, setWrap] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLPreElement | null>(null);
  const atBottomRef = useRef(true);

  const streamLines = isStream ? props.stream.lines : null;
  const staticText = !isStream ? props.text : null;
  const allLines = useMemo(
    () => streamLines ?? (staticText === null ? [] : staticText.split("\n")),
    [streamLines, staticText],
  );
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? allLines.filter((l) => l.toLowerCase().includes(q)) : allLines;
  }, [allLines, filter]);
  const text = useMemo(() => shown.join("\n"), [shown]);

  // Stick to the bottom like a terminal, unless the user scrolled up to read.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [text]);

  // New target → start at the bottom again.
  useEffect(() => {
    atBottomRef.current = true;
    setAtBottom(true);
  }, [props.subject, props.title]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    atBottomRef.current = bottom;
    setAtBottom(bottom);
  };
  const jumpToBottom = () => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setAtBottom(true);
  };

  const copy = () => {
    void navigator.clipboard?.writeText(text).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = props.downloadName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const live = isStream && props.stream.live;
  const streamError = isStream ? props.stream.error : null;
  let statusEl: React.ReactNode = null;
  if (isStream) {
    if (live) {
      statusEl = (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 600, color: green, letterSpacing: 0.4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: green, animation: "lpPulse 1.4s ease-in-out infinite" }} /> LIVE
        </span>
      );
    } else if (streamError) {
      statusEl = <span style={{ fontSize: 9.5, color: red }} title={streamError}>error</span>;
    } else {
      const code = props.stream.exitCode;
      statusEl = (
        <span style={{ fontSize: 9.5, color: code && code !== 0 ? red : `${fg}77` }}>
          {props.stopped ? "stopped" : code !== null ? `ended (exit ${code})` : "ended"}
        </span>
      );
    }
  }

  const loading = isStream ? live && allLines.length === 0 : props.text === null;
  const paneHeight = props.wide ? "56vh" : props.height ?? "36vh";

  // Render line-by-line only when highlighting; plain text is much cheaper.
  const body = props.highlight
    ? shown.map((l, i) => {
      const color = ERROR_RE.test(l) ? red : WARN_RE.test(l) ? yellow : undefined;
      return <span key={i} style={color ? { color } : undefined}>{l}{"\n"}</span>;
    })
    : text;

  return (
    <div style={{ borderTop: `1px solid ${border}`, display: "flex", flexDirection: "column", height: paneHeight, flexShrink: 0 }}>
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px 6px 12px", borderBottom: `1px solid ${border}` }}>
        <span style={{ display: "flex", color: accent }}>{props.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: fg, whiteSpace: "nowrap" }}>{props.title}</span>
        <span style={{ fontSize: 10.5, color: `${fg}88`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }} title={props.subject}>{props.subject}</span>
        {statusEl}
        <div style={{ flex: 1 }} />

        {isStream ? (
          <>
            {live ? (
              <IconBtn fg={fg} title="Stop streaming" onClick={props.onStop}><Square size={12} /></IconBtn>
            ) : (
              <IconBtn fg={fg} title="Reconnect stream" onClick={props.onRestart}><Play size={12} /></IconBtn>
            )}
            <IconBtn fg={fg} title="Clear" onClick={props.stream.clear}><Trash2 size={12} /></IconBtn>
          </>
        ) : (
          <IconBtn fg={fg} title="Refresh" onClick={props.onRefresh}><RefreshCw size={12} /></IconBtn>
        )}
        {props.onTerminal && <IconBtn fg={fg} title="Run in the terminal" onClick={props.onTerminal}><TerminalIcon size={12} /></IconBtn>}
        {props.onExplain && (
          <IconBtn fg={fg} title="Ask AI about these lines" onClick={() => props.onExplain!(shown.slice(-80).join("\n"))}>
            <Sparkles size={12} />
          </IconBtn>
        )}
        <IconBtn fg={fg} title={copied ? "Copied" : "Copy"} onClick={copy}>{copied ? <Check size={12} style={{ color: green }} /> : <Copy size={12} />}</IconBtn>
        <IconBtn fg={fg} title="Download" onClick={download}><Download size={12} /></IconBtn>
        <IconBtn fg={fg} title={props.wide ? "Shrink" : "Expand"} onClick={props.onToggleWide}>{props.wide ? <Minimize2 size={12} /> : <Maximize2 size={12} />}</IconBtn>
        <IconBtn fg={fg} title="Close" onClick={props.onClose}><X size={13} /></IconBtn>
      </div>

      {/* Options row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 12px", borderBottom: `1px solid ${border}` }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, border: `1px solid ${border}`, borderRadius: 5, padding: "2px 6px", minWidth: 0 }}>
          <Search size={11} style={{ color: `${fg}66`, flexShrink: 0 }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter lines"
            spellCheck={false}
            style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: fg, background: "transparent", border: "none", outline: "none" }}
          />
          {filter && <span style={{ fontSize: 9.5, color: `${fg}77`, whiteSpace: "nowrap" }}>{shown.length}/{allLines.length}</span>}
        </div>
        {props.options}
        <Chip fg={fg} border={border} accent={accent} active={wrap} onClick={() => setWrap((w) => !w)} title="Wrap long lines">
          <WrapText size={11} />
        </Chip>
      </div>

      {/* Body */}
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <pre
          ref={bodyRef}
          onScroll={onScroll}
          className="scrollbar-green"
          style={{
            position: "absolute", inset: 0, margin: 0, padding: "8px 12px",
            fontSize: 10.5, lineHeight: 1.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: `${fg}cc`, overflow: "auto",
            whiteSpace: wrap ? "pre-wrap" : "pre", wordBreak: wrap ? "break-all" : undefined,
          }}
        >
          {isStream && props.stream.dropped > 0 && !filter && (
            <span style={{ color: `${fg}55` }}>… {props.stream.dropped} older lines dropped …{"\n"}</span>
          )}
          {loading
            ? <span style={{ color: `${fg}66` }}>{isStream ? "Waiting for output…" : "Loading…"}</span>
            : shown.length ? body : <span style={{ color: `${fg}55` }}>{filter ? "No matching lines." : "No output."}</span>}
          {streamError && <span style={{ color: red }}>{"\n"}{streamError}</span>}
        </pre>
        {!atBottom && (
          <button
            onClick={jumpToBottom}
            style={{
              position: "absolute", right: 14, bottom: 10, display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, color: "#fff", background: accent, border: "none", borderRadius: 12,
              padding: "3px 9px", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            }}
          >
            <ArrowDownToLine size={11} /> {live ? "Jump to live" : "Bottom"}
          </button>
        )}
      </div>
      <style>{`@keyframes lpPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
}

/** "last 100 / 500 / 1000 / all" picker for the options row. */
export function TailSelect({ value, onChange }: { value: Tail; onChange: (t: Tail) => void }) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Tail)}
      title="Lines of history to load"
      style={{ fontSize: 10, color: fg, background: "transparent", border: `1px solid ${fg}22`, borderRadius: 5, padding: "2px 4px", cursor: "pointer" }}
    >
      {TAIL_OPTIONS.map((t) => <option key={t} value={t} style={{ color: "#000" }}>{t === "all" ? "all" : `last ${t}`}</option>)}
    </select>
  );
}
