/**
 * @module components/EditorTerminalPanel
 *
 * VS Code-style bottom terminal panel for the Monaco Editor module.
 * Uses the existing XtermTerminal from editor/terminal.
 * If no terminalUrl is provided, shows a friendly error message.
 *
 * Features:
 *  - Drag-to-resize handle at the top
 *  - Header with title, minimize, maximize, close buttons
 *  - Integrated xterm.js terminal via Socket.IO
 *  - Graceful error when terminalUrl is missing
 */
import React, { useState, useCallback, useRef, memo } from "react";
import { X, Minus, Maximize2, Terminal, AlertTriangle } from "lucide-react";
import { XtermTerminal, type TerminalEvents } from "../../editor/terminal/XtermTerminal";
import { EditorTerminalWithGhost } from "../../editor/terminal/EditorTerminalWithGhost";
import type { ITheme } from "@xterm/xterm";

/* ── Types ─────────────────────────────────────────────────── */

export interface EditorTerminalPanelProps {
  /** Whether the terminal panel is open */
  open: boolean;
  /** Toggle the terminal panel (minimize / restore — keeps connection alive) */
  onToggle: () => void;
  /** Close the terminal entirely (unmounts the terminal, killing the connection) */
  onClose?: () => void;
  /** Socket.IO server URL for the terminal backend */
  terminalUrl?: string;
  /** Session identifier for the terminal connection */
  sessionId?: string;
  /** Current working directory */
  cwd?: string;
  /** Custom socket event names */
  events?: TerminalEvents;
  /** Font size */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
  /** Xterm theme derived from the active Monaco editor theme */
  terminalTheme?: ITheme;
}

/* ── Component ─────────────────────────────────────────────── */

export const EditorTerminalPanel = memo(function EditorTerminalPanel({
  open,
  onToggle,
  onClose,
  terminalUrl,
  sessionId = "default",
  cwd = "/",
  events,
  fontSize = 14,
  fontFamily,
  terminalTheme,
}: EditorTerminalPanelProps) {
  const [height, setHeight] = useState(220);
  const prevHeightRef = useRef(220);
  const maximized = height > window.innerHeight * 0.6;

  // ── Maximize toggle ─────────────────────────────────────
  const toggleMaximize = useCallback(() => {
    if (maximized) {
      setHeight(
        prevHeightRef.current > window.innerHeight * 0.6
          ? 220
          : prevHeightRef.current,
      );
    } else {
      prevHeightRef.current = height;
      setHeight(window.innerHeight * 0.65);
    }
  }, [maximized, height]);

  // ── Drag-to-resize ──────────────────────────────────────
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartY.current = e.clientY;
      dragStartHeight.current = height;
    },
    [height],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const delta = dragStartY.current - e.clientY;
      const newH = Math.max(100, Math.min(window.innerHeight * 0.8, dragStartHeight.current + delta));
      setHeight(newH);
    },
    [],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  // Keep the terminal mounted (hidden) when not open, so the socket stays alive.
  // Only the outer wrapper is hidden — the xterm instance persists in the DOM.
  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        height: open ? height : 0,
        minHeight: open ? 100 : 0,
        contain: "layout paint style",
        borderTop: open ? "1px solid var(--editor-border, #3c3c3c)" : "none",
        overflow: open ? undefined : "hidden",
        visibility: open ? "visible" : "hidden",
        position: open ? undefined : "absolute",
        pointerEvents: open ? undefined : "none",
      }}
    >
      {/* ── Resize handle ────────────────────────────────── */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="h-[4px] cursor-ns-resize shrink-0 hover:bg-[var(--editor-accent,#007acc)] transition-colors"
        style={{ touchAction: "none" }}
      />

      {/* ── Header bar ───────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 h-[30px] min-h-[30px] select-none shrink-0"
        style={{ background: "var(--editor-sidebar-bg, #252526)", borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#007acc]" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Terminal
          </span>
        </div>
        <div className="flex items-center gap-1">
          <PanelBtn
            icon={<Minus className="w-3.5 h-3.5" />}
            title="Minimize"
            onClick={onToggle}
          />
          <PanelBtn
            icon={<Maximize2 className="w-3 h-3" />}
            title={maximized ? "Restore" : "Maximize"}
            onClick={toggleMaximize}
          />
          <PanelBtn
            icon={<X className="w-3.5 h-3.5" />}
            title="Close terminal"
            onClick={onClose ?? onToggle}
          />
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ background: terminalTheme?.background ?? "var(--editor-bg, #1e1e2e)" }}>
        {terminalUrl ? (
          <EditorTerminalWithGhost
            socketUrl={terminalUrl}
            sessionId={sessionId}
            cwd={cwd}
            events={events}
            visible={open}
            fontSize={fontSize}
            fontFamily={fontFamily}
            theme={terminalTheme}
          />
        ) : (
          /* ── No URL error state ───────────────────────── */
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <AlertTriangle className="w-8 h-8 text-yellow-500 opacity-60" />
            <p className="text-[12px] font-medium text-gray-300">Terminal Not Configured</p>
            <p className="text-[11px] text-gray-500 text-center max-w-[280px]">
              The terminal is enabled, but no <span className="text-gray-300">terminalUrl</span> has
              been provided. Please configure a Socket.IO server URL to use the integrated terminal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Helper ───────────────────────────────────────────────── */

function PanelBtn({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-[22px] h-[22px] rounded text-gray-500 hover:text-gray-200 hover:bg-[var(--editor-hover-bg,#3c3c3c)] transition-colors"
    >
      {icon}
    </button>
  );
}

EditorTerminalPanel.displayName = "EditorTerminalPanel";
