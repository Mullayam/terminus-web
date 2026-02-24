/**
 * @module editor/terminal/TerminalPanel
 *
 * VS Code-style bottom terminal panel with drag-to-resize.
 * Renders a resize handle at the top edge, a small header bar with
 * title + close button, and the <XtermTerminal> component.
 *
 * The panel reads its state from `useTerminalPanelStore` and does
 * NOT interact with the editor Zustand store at all.
 */
import { useCallback, useRef, memo } from "react";
import { XtermTerminal, type TerminalEvents } from "./XtermTerminal";
import { useTerminalPanelStore } from "./store";
import { X, Minus, Maximize2, Terminal } from "lucide-react";
import type { ITheme } from "@xterm/xterm";

// ── Props ────────────────────────────────────────────────────

export interface TerminalPanelProps {
    /** Socket.IO server URL for the terminal backend */
    socketUrl: string;
    /** Unique session identifier */
    sessionId: string;
    /** Current working directory for the terminal */
    cwd: string;
    /** Optional custom socket event names */
    events?: TerminalEvents;
    /** Font size inside the terminal */
    fontSize?: number;
    /** Terminal theme derived from the active editor theme */
    theme?: ITheme;
}

// ── Component ────────────────────────────────────────────────

export const TerminalPanel = memo(function TerminalPanel(props: TerminalPanelProps) {
    const open = useTerminalPanelStore((s) => s.open);
    const height = useTerminalPanelStore((s) => s.height);
    const setHeight = useTerminalPanelStore((s) => s.setHeight);
    const setOpen = useTerminalPanelStore((s) => s.setOpen);

    // ── Maximized toggle (remembers previous height) ─────────
    const prevHeightRef = useRef(height);
    const maximized = height > window.innerHeight * 0.6;

    const toggleMaximize = useCallback(() => {
        if (maximized) {
            setHeight(prevHeightRef.current > window.innerHeight * 0.6
                ? 220
                : prevHeightRef.current);
        } else {
            prevHeightRef.current = height;
            setHeight(window.innerHeight * 0.65);
        }
    }, [maximized, height, setHeight]);

    // ── Drag-to-resize (pointer events for smooth tracking) ──
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
            const delta = dragStartY.current - e.clientY; // dragging up = positive delta = taller
            setHeight(dragStartHeight.current + delta);
        },
        [setHeight],
    );

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
    }, []);

    if (!open) return null;

    return (
        <div
            className="flex flex-col shrink-0"
            style={{
                height,
                minHeight: 100,
                borderTop: "1px solid var(--editor-border)",
                background: "var(--editor-background)",
                contain: "layout paint style",
            }}
        >
            {/* ── Resize handle ────────────────────────────── */}
            <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{
                    height: 4,
                    cursor: "ns-resize",
                    background: "transparent",
                    flexShrink: 0,
                    touchAction: "none",
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                        "var(--editor-accent)";
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                        "transparent";
                }}
            />

            {/* ── Header bar ──────────────────────────────── */}
            <div
                className="flex items-center justify-between px-3 select-none shrink-0"
                style={{
                    height: 30,
                    minHeight: 30,
                    background: "var(--editor-toolbar-bg)",
                    borderBottom: "1px solid var(--editor-border)",
                }}
            >
                <div className="flex items-center gap-2">
                    <Terminal
                        className="w-3.5 h-3.5"
                        style={{ color: "var(--editor-accent)" }}
                    />
                    <span
                        className="text-[11px] font-medium uppercase tracking-wider"
                        style={{ color: "var(--editor-muted)" }}
                    >
                        Terminal
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <HeaderBtn
                        icon={<Minus className="w-3.5 h-3.5" />}
                        title="Minimize"
                        onClick={() => setOpen(false)}
                    />
                    <HeaderBtn
                        icon={<Maximize2 className="w-3 h-3" />}
                        title={maximized ? "Restore" : "Maximize"}
                        onClick={toggleMaximize}
                    />
                    <HeaderBtn
                        icon={<X className="w-3.5 h-3.5" />}
                        title="Close terminal (Ctrl+`)"
                        onClick={() => setOpen(false)}
                    />
                </div>
            </div>

            {/* ── Terminal body ────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <XtermTerminal
                    socketUrl={props.socketUrl}
                    sessionId={props.sessionId}
                    cwd={props.cwd}
                    events={props.events}
                    visible={open}
                    fontSize={props.fontSize}
                    theme={props.theme}
                />
            </div>
        </div>
    );
});

// ── Tiny header button ───────────────────────────────────────

const HeaderBtn = memo(function HeaderBtn(props: {
    icon: React.ReactNode;
    title: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={props.onClick}
            title={props.title}
            className="flex items-center justify-center rounded transition-colors"
            style={{
                width: 22,
                height: 22,
                border: "none",
                cursor: "pointer",
                background: "transparent",
                color: "var(--editor-muted)",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--editor-popup-hover-bg)";
                e.currentTarget.style.color = "var(--editor-foreground)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--editor-muted)";
            }}
        >
            {props.icon}
        </button>
    );
});

export default TerminalPanel;
