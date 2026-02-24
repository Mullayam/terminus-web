/**
 * @module editor/terminal/XtermTerminal
 *
 * Isolated Xterm.js terminal component with its own dedicated Socket.IO
 * connection. This component is completely independent from the rest of
 * the editor — it does not share sockets, stores, or state with any
 * other module.
 *
 * ## Connection handshake
 * On mount the component opens a Socket.IO connection to `socketUrl`,
 * passing `sessionId` and the current working directory (`cwd`) as
 * query parameters. After that, communication is purely event-driven:
 *
 * | Direction | Event              | Payload                       |
 * |-----------|--------------------|-------------------------------|
 * | out       | `@@SSH_EMIT_INPUT` | raw string typed by the user  |
 * | out       | `@@SSH_EMIT_RESIZE`| `{ cols, rows }`              |
 * | in        | `@@SSH_EMIT_DATA`  | raw string from the backend   |
 *
 * The event names can be customised via the `events` prop.
 */
import { useEffect, useRef, useCallback, memo } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { io, type Socket } from "socket.io-client";
import "@xterm/xterm/css/xterm.css";

// ── Types ────────────────────────────────────────────────────

/** Event name mapping – consumers can override defaults */
export interface TerminalEvents {
    /** User input → backend (default `@@SSH_EMIT_INPUT`) */
    input?: string;
    /** Backend output → terminal (default `@@SSH_EMIT_DATA`) */
    data?: string;
    /** Terminal resize → backend (default `@@SSH_EMIT_RESIZE`) */
    resize?: string;
}

export interface XtermTerminalProps {
    /** Socket.IO server URL (e.g. `http://localhost:4000`) */
    socketUrl: string;
    /** Unique session identifier sent during handshake */
    sessionId: string;
    /** Current working directory sent during handshake */
    cwd: string;
    /** Optional custom event names */
    events?: TerminalEvents;
    /** Whether the terminal is currently visible (triggers fit on true) */
    visible?: boolean;
    /** Font size (default 14) */
    fontSize?: number;
    /** Font family (default monospace) */
    fontFamily?: string;
    /** Xterm theme – when supplied, overrides the built-in default */
    theme?: ITheme;
}

// ── Defaults ─────────────────────────────────────────────────

const DEFAULT_EVENTS: Required<TerminalEvents> = {
    input: "@@SSH_EMIT_INPUT",
    data: "@@SSH_EMIT_DATA",
    resize: "@@SSH_EMIT_RESIZE",
};

const DEFAULT_THEME = {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    cursorAccent: "#1e1e2e",
    selectionBackground: "#585b7066",
    black: "#45475a",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#f5c2e7",
    cyan: "#94e2d5",
    white: "#bac2de",
    brightBlack: "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#f5c2e7",
    brightCyan: "#94e2d5",
    brightWhite: "#a6adc8",
};

// ── Component ────────────────────────────────────────────────

export const XtermTerminal = memo(function XtermTerminal(props: XtermTerminalProps) {
    const {
        socketUrl,
        sessionId,
        cwd,
        events: userEvents,
        visible = true,
        fontSize = 14,
        fontFamily = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        theme: themeProp,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const socketRef = useRef<Socket | null>(null);

    const events: Required<TerminalEvents> = {
        ...DEFAULT_EVENTS,
        ...userEvents,
    };

    // Keep events in a ref so the socket listener doesn't go stale
    const eventsRef = useRef(events);
    eventsRef.current = events;

    // ── Bootstrap terminal + socket on mount ─────────────────
    useEffect(() => {
        if (!containerRef.current) return;

        // 1. Create terminal
        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: "block",
            fontFamily,
            fontSize,
            theme: themeProp ?? DEFAULT_THEME,
            allowProposedApi: true,
            scrollback: 5000,
            convertEol: true,
        });
        termRef.current = term;

        // 2. Load addons
        const fitAddon = new FitAddon();
        fitAddonRef.current = fitAddon;
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        // 3. Open in DOM
        term.open(containerRef.current);
        requestAnimationFrame(() => {
            fitAddon.fit();
         
            socketRef.current?.emit(eventsRef.current.resize, {
                cols: term.cols,
                rows: term.rows,
            });
        });

        // 4. Create dedicated socket connection
        const socket = io(socketUrl, {
            query: { sessionId, cwd },
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });
        socketRef.current = socket;

        // 5. Send initial resize after connect
        socket.on("connect", () => {
            socket.emit(eventsRef.current.resize, {
                cols: term.cols,
                rows: term.rows,
            });
        });

        // 6. Wire events: backend → terminal
        socket.on(eventsRef.current.data, (payload: string) => {
            term.write(payload);
        });

        // 7. Wire events: terminal → backend
        term.onData((input) => {
            socket.emit(eventsRef.current.input, input);
        });

        term.onResize((size) => {
            socket.emit(eventsRef.current.resize, size);
        });

        // 8. ResizeObserver → refit (handles panel drag-resize AND window resize)
        //    We track the previous cols so that a pure height-change (rows
        //    only) does NOT emit a resize event that resets the backend PTY
        //    column count.  The `term.onResize` handler already sends size
        //    changes to the backend, so we only need to call `fit()`.
        let prevCols = term.cols;
        const resizeObserver = new ResizeObserver(() => {
            fitAddon.fit();
            // If cols haven't changed, suppress the backend resize so the
            // remote PTY keeps its column width stable.
            if (term.cols === prevCols) return;
            prevCols = term.cols;
        });
        resizeObserver.observe(containerRef.current);

        // 9. Right-click paste support
        const handleContextMenu = async (e: MouseEvent) => {
            e.preventDefault();
            const selection = term.getSelection()?.trim();
            if (selection) {
                await navigator.clipboard.writeText(selection);
                term.clearSelection();
            } else {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) term.paste(text);
                } catch {
                    /* clipboard permission denied – ignore */
                }
            }
        };
        containerRef.current.addEventListener("contextmenu", handleContextMenu);

        // ── Cleanup ──────────────────────────────────────────
        const containerEl = containerRef.current;
        return () => {
            resizeObserver.disconnect();
            containerEl?.removeEventListener("contextmenu", handleContextMenu);
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
            term.dispose();
            termRef.current = null;
            fitAddonRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socketUrl, sessionId, cwd]);

    // ── Re-fit when panel becomes visible or fontSize changes ─
    useEffect(() => {
        if (visible) {
            requestAnimationFrame(() => fitAddonRef.current?.fit());
        }
    }, [visible]);

    // ── Reactively apply theme changes ────────────────────────
    useEffect(() => {
        if (termRef.current && themeProp) {
            termRef.current.options.theme = themeProp;
        }
    }, [themeProp]);

    // ── Reactively apply fontSize changes ────────────────────
    useEffect(() => {
        if (termRef.current) {
            termRef.current.options.fontSize = fontSize;
            requestAnimationFrame(() => fitAddonRef.current?.fit());
        }
    }, [fontSize]);

    // ── Public imperative: focus terminal ─────────────────────
    const focus = useCallback(() => termRef.current?.focus(), []);

    // Auto-focus when visible
    useEffect(() => {
        if (visible) {
            // Small delay so the DOM has painted
            const id = setTimeout(focus, 50);
            return () => clearTimeout(id);
        }
    }, [visible, focus]);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
            }}
        />
    );
});

export default XtermTerminal;
