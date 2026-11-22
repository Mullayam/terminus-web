import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { FastForward, Pause, Play, RotateCcw, X } from "lucide-react";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { Chip, IconBtn } from "./widget-parts";
import { formatDuration, parseCast, type ParsedCast } from "./recorder";

const SPEEDS = [0.5, 1, 2, 4] as const;
const IDLE_CAP = 1; // seconds

interface TimedEvent { t: number; type: "o" | "r"; data: string }

/** Re-time events; with `skipIdle`, any pause longer than IDLE_CAP is shortened to it. */
function timeline(cast: ParsedCast, skipIdle: boolean): { events: TimedEvent[]; duration: number } {
  let prev = 0;
  let clock = 0;
  const events = cast.events.map(([t, type, data]) => {
    const gap = Math.max(0, t - prev);
    prev = t;
    clock += skipIdle ? Math.min(gap, IDLE_CAP) : gap;
    return { t: clock, type, data };
  });
  return { events, duration: clock };
}

function parseSize(data: string): { cols: number; rows: number } | null {
  const m = data.match(/^(\d+)x(\d+)$/);
  return m ? { cols: Number(m[1]), rows: Number(m[2]) } : null;
}

export interface RecorderPlayerProps {
  /** Raw asciicast v2 text. */
  cast: string;
  title: string;
  onClose: () => void;
}

/** Full-screen asciicast player rendered into a real xterm at the recorded size. */
export default function RecorderPlayer({ cast, title, onClose }: RecorderPlayerProps) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;

  const { parsed, parseError } = useMemo<{ parsed: ParsedCast | null; parseError: string | null }>(() => {
    try { return { parsed: parseCast(cast), parseError: null }; }
    catch (e) { return { parsed: null, parseError: (e as Error).message }; }
  }, [cast]);

  const [skipIdle, setSkipIdle] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [playing, setPlaying] = useState(true);
  const [position, setPosition] = useState(0);

  const line = useMemo(() => (parsed ? timeline(parsed, skipIdle) : { events: [], duration: 0 }), [parsed, skipIdle]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const idxRef = useRef(0);
  const posRef = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // One terminal per opened recording.
  useEffect(() => {
    if (!parsed || !hostRef.current) return;
    const term = new Terminal({
      cols: parsed.width,
      rows: parsed.height,
      disableStdin: true,
      cursorBlink: false,
      scrollback: 5000,
      fontSize: 13,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      theme: {
        background: colors.background, foreground: colors.foreground,
        black: colors.black, red: colors.red, green: colors.green, yellow: colors.yellow,
        blue: colors.blue, magenta: colors.magenta, cyan: colors.cyan, white: colors.white,
        brightBlack: colors.brightBlack,
      },
    });
    term.open(hostRef.current);
    termRef.current = term;
    return () => {
      termRef.current = null;
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed]);

  /** Rebuild the screen at `target` seconds by replaying everything before it. */
  const seek = useCallback((target: number) => {
    const term = termRef.current;
    if (!term || !parsed) return;
    term.reset();
    term.resize(parsed.width, parsed.height);
    let out = "";
    let i = 0;
    for (; i < line.events.length && line.events[i].t <= target; i++) {
      const e = line.events[i];
      if (e.type === "o") out += e.data;
      else {
        const s = parseSize(e.data);
        if (s) {
          if (out) { term.write(out); out = ""; }
          term.resize(s.cols, s.rows);
        }
      }
    }
    if (out) term.write(out);
    idxRef.current = i;
    posRef.current = target;
    setPosition(target);
  }, [line, parsed]);

  // Timeline changed (skip idle toggled) or terminal created → restart from the same spot.
  useEffect(() => {
    seek(Math.min(posRef.current, line.duration));
  }, [seek, line.duration]);

  // Playback loop.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      const term = termRef.current;
      if (!term) { raf = requestAnimationFrame(tick); return; }
      posRef.current += ((now - last) / 1000) * speedRef.current;
      last = now;
      let out = "";
      const evs = line.events;
      while (idxRef.current < evs.length && evs[idxRef.current].t <= posRef.current) {
        const e = evs[idxRef.current++];
        if (e.type === "o") out += e.data;
        else {
          const s = parseSize(e.data);
          if (s) {
            if (out) { term.write(out); out = ""; }
            term.resize(s.cols, s.rows);
          }
        }
      }
      if (out) term.write(out);
      if (posRef.current >= line.duration) {
        posRef.current = line.duration;
        setPosition(line.duration);
        setPlaying(false);
        return;
      }
      if (now - lastUi > 100) { lastUi = now; setPosition(posRef.current); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, line]);

  const togglePlay = useCallback(() => {
    if (!playing && posRef.current >= line.duration) seek(0);
    setPlaying((p) => !p);
  }, [playing, line.duration, seek]);

  const restart = () => { seek(0); setPlaying(true); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, togglePlay]);

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div style={{ width: "min(1200px, 96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", background: colors.background, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${border}` }}>
          <Play size={14} style={{ color: colors.red }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={title}>{title}</span>
          {parsed && <span style={{ fontSize: 10, color: `${fg}66` }}>{parsed.width}×{parsed.height}</span>}
          <div style={{ flex: 1 }} />
          <IconBtn fg={fg} title="Close (Esc)" onClick={onClose}><X size={15} /></IconBtn>
        </div>

        <div className="scrollbar-green" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12, background: colors.background }}>
          {parseError
            ? <div style={{ color: colors.red, fontSize: 12, padding: 20, textAlign: "center" }}>Can't play this file: {parseError}</div>
            : <div ref={hostRef} style={{ display: "inline-block" }} />}
        </div>

        {parsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: `1px solid ${border}` }}>
            <IconBtn fg={fg} title={playing ? "Pause (Space)" : "Play (Space)"} onClick={togglePlay}>
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </IconBtn>
            <IconBtn fg={fg} title="Restart" onClick={restart}><RotateCcw size={14} /></IconBtn>
            <span style={{ fontSize: 10.5, color: `${fg}aa`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {formatDuration(position)} / {formatDuration(line.duration)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(line.duration, 0.001)}
              step={0.05}
              value={Math.min(position, line.duration)}
              onChange={(e) => seek(Number(e.target.value))}
              style={{ flex: 1, accentColor: colors.red, cursor: "pointer" }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              {SPEEDS.map((s) => (
                <Chip key={s} fg={fg} border={border} accent={colors.blue} active={speed === s} onClick={() => setSpeed(s)}>{s}x</Chip>
              ))}
            </div>
            <Chip fg={fg} border={border} accent={colors.blue} active={skipIdle} onClick={() => setSkipIdle((v) => !v)} title="Shorten pauses longer than 1s">
              <FastForward size={11} /> Skip idle
            </Chip>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
