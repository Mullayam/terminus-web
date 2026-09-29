import type React from "react";
import { useRef, useState } from "react";
import { Check, GripHorizontal, Plus, X, Zap } from "lucide-react";
import { useQuickCommandsStore } from "@/store/quickCommandsStore";
import { terminalEvents, TerminalEventKey } from "@/lib/terminalEvents";

interface QuickCommandsProps {
  /** Owning terminal session — the run request is emitted on the event bus for it. */
  sessionId: string;
  bg: string;
  fg: string;
  accent: string;
  border: string;
  /** Distance from the terminal bottom, raised to clear the Command Blocks launcher. */
  bottomOffset?: number;
}

/** Drag the bar down past this many pixels to dismiss it. */
const CLOSE_THRESHOLD = 44;

/**
 * A row of user-defined buttons docked bottom-right that run a fixed command on
 * click (e.g. a `clear` button) so common commands never have to be re-typed.
 * The bar can be dragged downward to dismiss it (mobile-app style); a small
 * floating chip then lets the user bring it back and manage the buttons.
 */
const QuickCommands: React.FC<QuickCommandsProps> = ({ sessionId, bg, fg, accent, border, bottomOffset = 10 }) => {
  const buttons = useQuickCommandsStore((s) => s.buttons);
  const visible = useQuickCommandsStore((s) => s.visible);
  const add = useQuickCommandsStore((s) => s.add);
  const remove = useQuickCommandsStore((s) => s.remove);
  const setVisible = useQuickCommandsStore((s) => s.setVisible);

  // Fire-and-forget onto the terminal event bus — the terminal runs it without
  // this component (or the terminal) re-rendering as a result.
  const runCommand = (command: string) =>
    terminalEvents.emit(TerminalEventKey.RUN_COMMAND, { command, sessionId });

  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [dragY, setDragY] = useState(0);
  const dragRef = useRef<{ startY: number; pointerId: number } | null>(null);

  const onDragStart = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    // Only track downward movement — the gesture is "swipe down to close".
    setDragY(Math.max(0, e.clientY - dragRef.current.startY));
  };
  const onDragEnd = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(dragRef.current.pointerId);
    const shouldClose = e.clientY - dragRef.current.startY > CLOSE_THRESHOLD;
    dragRef.current = null;
    setDragY(0);
    if (shouldClose) setVisible(false);
  };

  const saveNew = () => {
    if (!newCommand.trim()) return;
    add(newLabel, newCommand);
    setNewLabel("");
    setNewCommand("");
    setAdding(false);
  };

  // Collapsed: a small chip the user can click to reopen and manage buttons.
  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        title="Show quick commands"
        style={{
          position: "absolute",
          right: 10,
          bottom: bottomOffset,
          zIndex: 21,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          background: `${bg}f2`,
          border: `1px solid ${border}`,
          borderRadius: 999,
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: accent,
          cursor: "pointer",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: 11,
        }}
      >
        <Zap size={13} />
        <span style={{ color: `${fg}cc` }}>Quick</span>
      </button>
    );
  }

  const dragOpacity = dragY > 0 ? Math.max(0.35, 1 - dragY / (CLOSE_THRESHOLD * 3)) : 1;

  return (
    <div
      style={{
        position: "absolute",
        right: 10,
        bottom: bottomOffset,
        zIndex: 21,
        maxWidth: "calc(100% - 20px)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        background: `${bg}f2`,
        border: `1px solid ${border}`,
        borderRadius: 10,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 11,
        transform: `translateY(${dragY}px)`,
        opacity: dragOpacity,
        transition: dragRef.current ? "none" : "transform 0.16s ease, opacity 0.16s ease",
        touchAction: "none",
      }}
    >
      {/* Drag handle — swipe down to dismiss the bar. */}
      <span
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        title="Drag down to hide"
        style={{ display: "flex", alignItems: "center", color: `${fg}66`, cursor: "grab", flexShrink: 0 }}
      >
        <GripHorizontal size={14} />
      </span>

      {adding ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="label"
            style={inputStyle(fg, border, 70)}
          />
          <input
            value={newCommand}
            autoFocus
            onChange={(e) => setNewCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNew();
              if (e.key === "Escape") { setAdding(false); setNewLabel(""); setNewCommand(""); }
            }}
            placeholder="command to run"
            style={inputStyle(fg, border, 150)}
          />
          <button onClick={saveNew} title="Save" style={iconBtnStyle(accent, border)}>
            <Check size={13} />
          </button>
          <button
            onClick={() => { setAdding(false); setNewLabel(""); setNewCommand(""); }}
            title="Cancel"
            style={iconBtnStyle(`${fg}aa`, border)}
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 5, overflowX: "auto", scrollbarWidth: "none", maxWidth: 460 }}>
          {buttons.length === 0 && (
            <span style={{ color: `${fg}66`, whiteSpace: "nowrap", padding: "0 4px" }}>No quick commands</span>
          )}
          {buttons.map((b) => (
            <span key={b.id} style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
              onMouseEnter={(e) => {
                const del = e.currentTarget.querySelector<HTMLElement>("[data-del]");
                if (del) del.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                const del = e.currentTarget.querySelector<HTMLElement>("[data-del]");
                if (del) del.style.opacity = "0";
              }}
            >
              <button
                onClick={() => runCommand(b.command)}
                title={b.command}
                style={{
                  padding: "3px 9px",
                  borderRadius: 6,
                  border: `1px solid ${border}`,
                  background: "transparent",
                  color: `${fg}dd`,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.12s, color 0.12s, border-color 0.12s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${accent}22`;
                  e.currentTarget.style.color = fg;
                  e.currentTarget.style.borderColor = `${accent}80`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = `${fg}dd`;
                  e.currentTarget.style.borderColor = border;
                }}
              >
                {b.label}
              </button>
              <span
                data-del
                onClick={(e) => { e.stopPropagation(); remove(b.id); }}
                title="Remove"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 14,
                  height: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  background: bg,
                  border: `1px solid ${border}`,
                  color: `${fg}cc`,
                  cursor: "pointer",
                  opacity: 0,
                  transition: "opacity 0.12s",
                }}
              >
                <X size={9} />
              </span>
            </span>
          ))}
        </div>
      )}

      {!adding && (
        <button onClick={() => setAdding(true)} title="Add quick command" style={iconBtnStyle(accent, border)}>
          <Plus size={13} />
        </button>
      )}

      {/* Explicit close, in addition to the drag gesture. */}
      <button onClick={() => setVisible(false)} title="Hide" style={iconBtnStyle(`${fg}88`, border)}>
        <X size={13} />
      </button>
    </div>
  );
};

function inputStyle(fg: string, border: string, width: number): React.CSSProperties {
  return {
    width,
    padding: "3px 6px",
    borderRadius: 5,
    border: `1px solid ${border}`,
    background: "transparent",
    color: fg,
    outline: "none",
    fontFamily: "inherit",
    fontSize: 11,
  };
}

function iconBtnStyle(color: string, border: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 6,
    border: `1px solid ${border}`,
    background: "transparent",
    color,
    cursor: "pointer",
    flexShrink: 0,
  };
}

export default QuickCommands;
