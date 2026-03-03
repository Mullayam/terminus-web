import { useEffect, useRef, useMemo, memo } from "react";
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
 * Renders an absolutely-positioned dim text overlay inside the terminal
 * container, aligned with the cursor, showing the remaining part of the
 * top matching suggestion.
 *
 * Position updates use requestAnimationFrame to avoid blocking xterm's
 * internal render pipeline.
 *
 * - Accepts on **Tab** or **→** (right arrow)
 * - Dismissed on **Escape** or when typing diverges
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

  const completion = useMemo(
    () => getGhostCompletion(commandBuffer, suggestions),
    [commandBuffer, suggestions],
  );

  // Keep refs so event handlers always see the latest values without re-subscribing
  const completionRef = useRef(completion);
  completionRef.current = completion;
  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;
  const bufferLenRef = useRef(commandBuffer.length);
  bufferLenRef.current = commandBuffer.length;

  /* ── Position the overlay via rAF-batched DOM writes ── */
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const syncPosition = () => {
      const el = overlayRef.current;
      if (!el) return;

      const core = (term as any)._core;
      const dims = core?._renderService?.dimensions;
      if (!dims) return;

      // Account for xterm's internal viewport offset (.xterm-screen)
      const screen = term.element?.querySelector(".xterm-screen") as HTMLElement | null;
      const offsetX = screen?.offsetLeft ?? 0;
      const offsetY = screen?.offsetTop ?? 0;

      const buf = term.buffer.active;
      const x = buf.cursorX * dims.css.cell.width + offsetX;
      const y = buf.cursorY * dims.css.cell.height + offsetY;

      el.style.transform = `translate3d(${x}px,${y}px,0)`;
    };

    const scheduleSync = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(syncPosition);
    };

    // Initial position
    scheduleSync();

    const disposable = term.onCursorMove(scheduleSync);
    return () => {
      disposable.dispose();
      cancelAnimationFrame(rafId.current);
    };
  }, [termRef]);

  // Re-sync position when completion changes (buffer changed but cursor didn't fire)
  useEffect(() => {
    const term = termRef.current;
    const el = overlayRef.current;
    if (!term || !el) return;

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
  }, [completion, termRef]);

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
        contain: "layout style",
        pointerEvents: "none",
        whiteSpace: "pre",
        fontFamily: term?.options.fontFamily ?? "monospace",
        fontSize: term?.options.fontSize ?? 15,
        lineHeight: "normal",
        color: "rgba(255,255,255,0.30)",
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
