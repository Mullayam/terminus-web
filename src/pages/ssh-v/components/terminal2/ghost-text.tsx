import { useEffect, useRef, useState, useMemo, memo } from "react";
import type { Terminal } from "@xterm/xterm";

interface GhostTextProps {
  /** The xterm Terminal instance */
  term: Terminal | null;
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
 * - Accepts on **Tab** or **→** (right arrow)
 * - Dismissed on **Escape** or when typing diverges
 */
const GhostText = memo(function GhostText({
  term,
  commandBuffer,
  suggestions,
  onAccept,
  containerRef,
}: GhostTextProps) {
  const overlayRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const completion = useMemo(
    () => getGhostCompletion(commandBuffer, suggestions),
    [commandBuffer, suggestions],
  );

  /* ── Recompute position whenever cursor moves or buffer changes ── */
  useEffect(() => {
    if (!term || !completion) {
      setPos(null);
      return;
    }

    const updatePos = () => {
      const core = (term as any)._core;
      if (!core) return;

      const dims = core._renderService?.dimensions;
      if (!dims) return;

      const buffer = term.buffer.active;
      const cellWidth = dims.css.cell.width;
      const cellHeight = dims.css.cell.height;

      // Cursor position in the viewport (0-based)
      const cursorX = buffer.cursorX;
      const cursorY = buffer.cursorY;

      setPos({
        x: cursorX * cellWidth,
        y: cursorY * cellHeight,
      });
    };

    updatePos();

    const cursorDispose = term.onCursorMove(updatePos);
    return () => cursorDispose.dispose();
  }, [term, completion]);

  /* ── Intercept Tab / → to accept the suggestion ── */
  useEffect(() => {
    if (!completion || !containerRef.current) return;

    const handler = (e: KeyboardEvent) => {
      if (!completion) return;
      if (e.key === "Tab" || (e.key === "ArrowRight" && commandBuffer.length > 0)) {
        e.preventDefault();
        e.stopPropagation();
        onAccept(completion.full);
      }
    };

    // Capture phase so we can intercept before xterm processes the key
    const el = containerRef.current;
    el.addEventListener("keydown", handler, true);
    return () => el.removeEventListener("keydown", handler, true);
  }, [completion, commandBuffer, onAccept, containerRef]);

  if (!completion || !pos) return null;

  return (
    <span
      ref={overlayRef}
      aria-hidden
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        pointerEvents: "none",
        whiteSpace: "pre",
        fontFamily: term?.options.fontFamily ?? "monospace",
        fontSize: term?.options.fontSize ?? 15,
        lineHeight: "normal",
        color: "rgba(255,255,255,0.30)",
        zIndex: 10,
        // Prevent accidental text selection
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {completion.ghost}
    </span>
  );
});

export default GhostText;
