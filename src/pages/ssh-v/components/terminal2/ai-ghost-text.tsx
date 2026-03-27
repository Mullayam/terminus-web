import { useEffect, useRef, useState, memo } from "react";
import type { Terminal } from "@xterm/xterm";
import { useAIChatStore } from "@/store/aiChatStore";

interface AIGhostTextProps {
  termRef: React.RefObject<Terminal | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  sessionId: string;
  onAccept: (command: string) => void;
}

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
    y: (buf.cursorY + 1) * dims.css.cell.height + offsetY,
  };
}

/**
 * Renders AI-suggested command as ghost text below the cursor in xterm.
 * Accepts on Tab key. Dismisses on any other keypress or Escape.
 */
const AIGhostText = memo(function AIGhostText({
  termRef,
  containerRef,
  sessionId,
  onAccept,
}: AIGhostTextProps) {
  const ghostCommand = useAIChatStore((s) => s.ghostCommand[sessionId]);
  const clearGhostCommand = useAIChatStore((s) => s.clearGhostCommand);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const ghostCommandRef = useRef(ghostCommand);
  ghostCommandRef.current = ghostCommand;
  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;

  // Position the ghost text when a command appears
  useEffect(() => {
    if (!ghostCommand) {
      setPos(null);
      return;
    }
    const term = termRef.current;
    if (!term) return;

    const p = getCursorPixelPos(term);
    if (p) setPos(p);
  }, [ghostCommand, termRef]);

  // Intercept keyboard: Tab = accept, Escape/other = dismiss
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !ghostCommand) return;

    const handler = (e: KeyboardEvent) => {
      const cmd = ghostCommandRef.current;
      if (!cmd) return;

      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        onAcceptRef.current(cmd);
        clearGhostCommand(sessionId);
      } else if (e.key === "Escape" || e.key.length === 1) {
        clearGhostCommand(sessionId);
      }
    };

    container.addEventListener("keydown", handler, true);
    return () => container.removeEventListener("keydown", handler, true);
  }, [containerRef, ghostCommand, sessionId, clearGhostCommand]);

  if (!ghostCommand || !pos) return null;

  const term = termRef.current;

  return (
    <div
      ref={overlayRef}
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate3d(${pos.x}px,${pos.y}px,0)`,
        pointerEvents: "none",
        whiteSpace: "pre",
        fontFamily: term?.options.fontFamily ?? "monospace",
        fontSize: term?.options.fontSize ?? 15,
        lineHeight: "normal",
        color: "#9ca3af",
        zIndex: 10,
        userSelect: "none",
        WebkitUserSelect: "none",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
      }}
    >
      <span>{ghostCommand}</span>
      <span
        style={{
          fontSize: "10px",
          opacity: 0.7,
          color: "rgba(255,255,255,0.35)",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span style={{ padding: "1px 4px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.15)", fontSize: "9px" }}>Tab</span>
        <span>to accept</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ padding: "1px 4px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.15)", fontSize: "9px" }}>Esc</span>
        <span>to dismiss</span>
      </span>
    </div>
  );
});

export default AIGhostText;
