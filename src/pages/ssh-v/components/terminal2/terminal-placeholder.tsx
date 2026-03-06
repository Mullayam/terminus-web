import { useEffect, useRef, useCallback, useState, memo } from "react";
import type { Terminal } from "@xterm/xterm";

// Module-level counter persists across re-renders but resets on page reload
let showCount = 0;
// Cache the last fetched joke to avoid re-fetching on every visibility toggle
let cachedJoke: string | null = null;

async function fetchJoke(fallback: string): Promise<string> {
  // Return cached joke if we already have one (refresh every 10th show)
  if (cachedJoke && showCount % 10 !== 0) return cachedJoke;
  try {
    const res = await fetch('https://icanhazdadjoke.com/', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return cachedJoke ?? fallback;
    const data = await res.json();
    const joke = typeof data?.joke === 'string' ? `😂 ${data.joke}` : fallback;
    cachedJoke = joke;
    return joke;
  } catch {
    return cachedJoke ?? fallback;
  }
}

interface TerminalPlaceholderProps {
  /** Ref to the xterm Terminal instance */
  termRef: React.RefObject<Terminal | null>;
  /** Current command buffer — placeholder hides when non-empty */
  commandBuffer: string;
  /** Container element ref (the terminal wrapper div) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** The hint text to display, e.g. "Press Ctrl+I to use AI" */
  hint?: string;
}

/**
 * Renders a dim placeholder ghost text at the terminal cursor position
 * when the shell input is empty.  Disappears as soon as the user types.
 */
const TerminalPlaceholder = memo(function TerminalPlaceholder({
  termRef,
  commandBuffer,
  containerRef,
  hint = "💡 Like this project? Press ⭐ on GitHub to support it.",
}: TerminalPlaceholderProps) {
  const overlayRef = useRef<HTMLSpanElement>(null);
  const rafId = useRef(0);
  const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayHint, setDisplayHint] = useState(hint);

  const visible = commandBuffer.trim().length === 0;

  // Show default hint for the first 3 times, then fetch a joke
  useEffect(() => {
    if (!visible) return;
    showCount++;
    if (showCount <= 3) {
      setDisplayHint(hint);
    } else {
      let cancelled = false;
      fetchJoke(hint!).then((joke) => {
        if (!cancelled) setDisplayHint(joke);
      });
      return () => { cancelled = true; };
    }
  }, [visible, hint]);

  const syncPosition = useCallback(() => {
    const el = overlayRef.current;
    const term = termRef.current;
    if (!el || !term) return;

    const core = (term as any)._core;
    const dims = core?._renderService?.dimensions;
    if (!dims) return;

    const screen = term.element?.querySelector(".xterm-screen") as HTMLElement | null;
    const offsetX = screen?.offsetLeft ?? 0;
    const offsetY = screen?.offsetTop ?? 0;

    const buf = term.buffer.active;
    const x = buf.cursorX * dims.css.cell.width + offsetX;
    const y = buf.cursorY * dims.css.cell.height + offsetY;

    el.style.transform = `translate3d(${x}px,${y}px,0)`;
  }, [termRef]);

  /* ── Subscribe to cursor moves + poll until terminal is ready ── */
  useEffect(() => {
    if (!visible) return;

    const scheduleSync = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(syncPosition);
    };

    // Poll every 200ms until the terminal instance is ready, then sync + subscribe
    let disposed = false;
    let cursorDisposable: { dispose(): void } | null = null;

    const tryAttach = () => {
      const term = termRef.current;
      if (!term || disposed) return false;

      scheduleSync();
      cursorDisposable = term.onCursorMove(scheduleSync);

      // Clear the polling interval once attached
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
      return true;
    };

    // Try immediately, then poll if terminal isn't ready yet
    if (!tryAttach()) {
      intervalId.current = setInterval(() => tryAttach(), 200);
    }

    return () => {
      disposed = true;
      cursorDisposable?.dispose();
      cancelAnimationFrame(rafId.current);
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
    };
  }, [visible, syncPosition, termRef]);

  /* ── Re-sync position whenever visibility toggles back on ── */
  useEffect(() => {
    if (!visible) return;
    // Small delay to ensure the span has mounted into the DOM
    const id = requestAnimationFrame(syncPosition);
    return () => cancelAnimationFrame(id);
  }, [visible, syncPosition]);

  if (!visible) return null;

  const term = termRef.current;

  return (
    <span
      ref={overlayRef}
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        willChange: "transform",
        pointerEvents: "none",
        whiteSpace: "pre",
        fontFamily: term?.options.fontFamily ?? "monospace",
        fontSize: term?.options.fontSize ?? 15,
        lineHeight: `${((term as any)?._core?._renderService?.dimensions?.css?.cell?.height) ?? 18}px`,
        color: "rgba(255,255,255,0.20)",
        zIndex: 10,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {displayHint}
    </span>
  );
});

export default TerminalPlaceholder;
