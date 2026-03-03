import { useEffect, useRef, useMemo, useState, memo } from "react";
import type { Terminal } from "@xterm/xterm";

interface GhostTextProps {
  /** Ref to the xterm Terminal instance (avoids re-renders when ref is set) */
  termRef: React.RefObject<Terminal | null>;
  /** The partial input the user has typed so far */
  commandBuffer: string;
  /** All available suggestions (already filtered by parent or raw list) */
  suggestions: string[];
  /** Callback when the user accepts the ghost suggestion (Tab / →) */
  onAccept: (fullCommand: string) => void;
  /** Container element ref — ghost text is positioned inside this */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Computes the remaining text of the best matching suggestion.
 * Returns `null` when there is nothing useful to show.
 */
function getGhostCompletion(
  buffer: string,
  suggestions: string[],
): { full: string; ghost: string } | null {
  if (!buffer.trim()) return null;
  const lower = buffer.toLowerCase();
  const match = suggestions.find(
    (s) => s.toLowerCase().startsWith(lower) && s.length > buffer.length,
  );
  if (!match) return null;
  return { full: match, ghost: match.slice(buffer.length) };
}

/**
 * Reads the cursor pixel coordinates from xterm internals.
 * Returns null if the terminal isn't ready.
 */
function getCursorPixelPos(term: Terminal) {
  const core = (term as any)._core;
  const dims = core?._renderService?.dimensions;
  if (!dims) return null;

  const screen = term.element?.querySelector(".xterm-screen") as HTMLElement | null;
  const offsetX = screen?.offsetLeft ?? 0;
  const offsetY = screen?.offsetTop ?? 0;

  const buf = term.buffer.active;
  return {
    x: buf.cursorX * dims.css.cell.width + offsetX,
    y: buf.cursorY * dims.css.cell.height + offsetY,
  };
}

/**
 * Ghost text overlay — appears right after the cursor once the terminal
 * has finished processing the echo from the server, so it never overlaps
 * the character being typed.
 *
 * Flow:
 *  1. User types → commandBuffer updates → completion recalculated
 *  2. Ghost is HIDDEN (settled = false) to avoid stale-cursor overlap
 *  3. SSH echo arrives → xterm cursor moves → onCursorMove fires
 *  4. Ghost positions at new cursorX and becomes VISIBLE (settled = true)
 *
 * Accepts on Tab or → (right arrow)
 */
const GhostText = memo(function GhostText({
  termRef,
  commandBuffer,
  suggestions,
  onAccept,
  containerRef,
}: GhostTextProps) {
  const overlayRef = useRef<HTMLSpanElement>(null);
  const rafId = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether the cursor has settled after the last keystroke echo
  const [settled, setSettled] = useState(false);

  const completion = useMemo(
    () => getGhostCompletion(commandBuffer, suggestions),
    [commandBuffer, suggestions],
  );

  // Keep refs so event handlers always see the latest values
  const completionRef = useRef(completion);
  completionRef.current = completion;
  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;
  const bufferLenRef = useRef(commandBuffer.length);
  bufferLenRef.current = commandBuffer.length;

  /* ── When completion changes, hide ghost until cursor settles ── */
  useEffect(() => {
    setSettled(false);

    // Fallback: if cursor doesn't move within 120ms (e.g. local echo off
    // or cursor happened to already be at the right cell), settle anyway.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (completion) {
      settleTimer.current = setTimeout(() => {
        // Position at whatever the cursor says now
        const term = termRef.current;
        const el = overlayRef.current;
        if (term && el) {
          const pos = getCursorPixelPos(term);
          if (pos) {
            el.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
          }
        }
        setSettled(true);
      }, 120);
    }
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [completion, termRef]);

  /* ── Listen to cursor moves — position overlay + mark settled ── */
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const syncAndSettle = () => {
      const el = overlayRef.current;
      if (!el) return;

      const pos = getCursorPixelPos(term);
      if (!pos) return;

      el.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;

      // Clear the fallback timer — real cursor move arrived
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
      setSettled(true);
    };

    const scheduleSync = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(syncAndSettle);
    };

    const disposable = term.onCursorMove(scheduleSync);
    return () => {
      disposable.dispose();
      cancelAnimationFrame(rafId.current);
    };
  }, [termRef]);

  /* ── Intercept Tab / → to accept the suggestion ── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: KeyboardEvent) => {
      const cur = completionRef.current;
      if (!cur) return;
      if (e.key === "Tab" || (e.key === "ArrowRight" && bufferLenRef.current > 0)) {
        e.preventDefault();
        e.stopPropagation();
        onAcceptRef.current(cur.full);
      }
    };

    container.addEventListener("keydown", handler, true);
    return () => container.removeEventListener("keydown", handler, true);
  }, [containerRef]);

  if (!completion) return null;

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
        lineHeight: "normal",
        color: "rgba(255,255,255,0.30)",
        // Hidden until cursor settles after echo, then fades in
        opacity: settled ? 1 : 0,
        transition: "opacity 0.06s ease-in",
        zIndex: 10,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {completion.ghost}
    </span>
  );
});

export default GhostText;
