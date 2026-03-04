/**
 * @module editor/terminal/EditorTerminalWithGhost
 *
 * Enhanced Xterm terminal for the editor terminal panel that adds:
 *   - Ghost-text inline suggestions (Tab/ArrowRight to accept)
 *   - Suggestion popup (Ctrl+Space)
 *
 * Uses installed context-engine command data from IndexedDB for suggestions,
 * combined with command history from localStorage.
 *
 * Re-uses the same Socket.IO connection pattern as XtermTerminal.
 */
import { useEffect, useRef, useCallback, useState, useMemo, memo } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { io, type Socket } from "socket.io-client";
import "@xterm/xterm/css/xterm.css";
import type { TerminalEvents } from "./XtermTerminal";
import { getAllCommandData } from "@/lib/context-engine/contextEngineStorage";

/* ── Types & Defaults ──────────────────────────────────────── */

export interface EditorTerminalWithGhostProps {
    socketUrl: string;
    sessionId: string;
    cwd: string;
    events?: TerminalEvents;
    visible?: boolean;
    fontSize?: number;
    fontFamily?: string;
    theme?: ITheme;
}

const DEFAULT_EVENTS = {
    input: "@@SSH_EMIT_INPUT",
    data: "@@SSH_EMIT_DATA",
    resize: "@@SSH_EMIT_RESIZE",
    ready: "@@SSH_READY",
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

const HISTORY_KEY = "terminus-editor-terminal-history";

/* ── Ghost Text helpers ────────────────────────────────────── */

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

/* ── Component ─────────────────────────────────────────────── */

export const EditorTerminalWithGhost = memo(function EditorTerminalWithGhost(props: EditorTerminalWithGhostProps) {
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
    const ghostRef = useRef<HTMLSpanElement>(null);

    /* ── Command state ────────────────────────────────────── */
    const [commandBuffer, setCommandBuffer] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestionBox, setShowSuggestionBox] = useState(false);
    const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
    const commandBufferRef = useRef("");

    const events = { ...DEFAULT_EVENTS, ...userEvents };
    const eventsRef = useRef(events);
    eventsRef.current = events;

    /* ── Load suggestions from context engine + history ────── */
    useEffect(() => {
        const load = async () => {
            const allSugs: string[] = [];

            // Load from localStorage history
            try {
                const saved = localStorage.getItem(HISTORY_KEY);
                if (saved) allSugs.push(...JSON.parse(saved));
            } catch { /* ignore */ }

            // Load from context engine commands DB
            try {
                const cmdData = await getAllCommandData();
                for (const item of cmdData) {
                    const data = item.data as any[];
                    if (Array.isArray(data)) {
                        for (const entry of data) {
                            if (typeof entry === "string") {
                                allSugs.push(entry);
                            } else if (entry?.command) {
                                allSugs.push(entry.command);
                            } else if (entry?.name) {
                                allSugs.push(entry.name);
                            }
                        }
                    }
                }
            } catch { /* ignore */ }

            setSuggestions(Array.from(new Set(allSugs)));
        };
        load();
    }, []);

    /* ── Ghost completion ─────────────────────────────────── */
    const ghostCompletion = useMemo(
        () => getGhostCompletion(commandBuffer, suggestions),
        [commandBuffer, suggestions],
    );
    const ghostCompletionRef = useRef(ghostCompletion);
    ghostCompletionRef.current = ghostCompletion;

    /* ── Filtered suggestions for popup ───────────────────── */
    const filteredSuggestions = useMemo(() => {
        if (!commandBuffer) return suggestions.slice(0, 20);
        return suggestions.filter((s) => s.toLowerCase().includes(commandBuffer.toLowerCase())).slice(0, 15);
    }, [commandBuffer, suggestions]);

    /* ── Bootstrap terminal + socket ──────────────────────── */
    useEffect(() => {
        if (!containerRef.current) return;

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

        const fitAddon = new FitAddon();
        fitAddonRef.current = fitAddon;
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.open(containerRef.current);

        requestAnimationFrame(() => {
            fitAddon.fit();
            socketRef.current?.emit(eventsRef.current.resize, { cols: term.cols, rows: term.rows });
        });

        let sshReady = false;
        const connectionLogs: string[] = [];
        const writeLog = (msg: string, color: string = "36") => {
            const line = `\x1b[${color}m${msg}\x1b[0m\r\n`;
            connectionLogs.push(line);
            term.write(line);
        };
        const timestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });

        writeLog(`[${timestamp()}] Connecting to terminal via SFTP...`, "33");
        writeLog(`[${timestamp()}] Session: ${sessionId}`, "90");
        writeLog(`[${timestamp()}] Working directory: ${cwd}`, "90");
        writeLog(`[${timestamp()}] Waiting for SSH connection...`, "33");

        const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        let spinnerIdx = 0;
        const spinnerInterval = setInterval(() => {
            if (sshReady) return;
            const frame = spinnerFrames[spinnerIdx % spinnerFrames.length];
            term.write(`\r\x1b[33m ${frame} Establishing connection...\x1b[0m`);
            spinnerIdx++;
        }, 80);

        const socket = io(socketUrl, {
            query: { sessionId, cwd },
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            if (!sshReady) {
                writeLog(`\r\x1b[K[${timestamp()}] Socket connected, waiting for SSH ready...`, "33");
            }
            socket.emit(eventsRef.current.resize, { cols: term.cols, rows: term.rows });
        });

        const pendingData: string[] = [];

        socket.on(eventsRef.current.ready, (isReady: boolean) => {
            if (isReady && !sshReady) {
                sshReady = true;
                clearInterval(spinnerInterval);
                term.write(`\r\x1b[K`);
                writeLog(`[${timestamp()}] ✓ SSH connection established`, "32");
                writeLog(`[${timestamp()}] Terminal ready.\r\n`, "32");
                for (const data of pendingData) term.write(data);
                pendingData.length = 0;
                socket.on(eventsRef.current.data, (payload: string) => term.write(payload));
            }
        });

        socket.on(eventsRef.current.data, (payload: string) => {
            if (!sshReady) pendingData.push(payload);
        });

        // Track command buffer from user input
        term.onData((input) => {
            socket.emit(eventsRef.current.input, input);

            // Track keypress for command buffer
            if (input === "\r" || input === "\n") {
                // Enter: save command to history & suggestions
                const cmd = commandBufferRef.current.trim();
                if (cmd) {
                    setSuggestions((prev) => {
                        const updated = Array.from(new Set([cmd, ...prev]));
                        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 500))); } catch { /* */ }
                        return updated;
                    });
                }
                commandBufferRef.current = "";
                setCommandBuffer("");
                setShowSuggestionBox(false);
            } else if (input === "\x7f" || input === "\b") {
                // Backspace
                commandBufferRef.current = commandBufferRef.current.slice(0, -1);
                setCommandBuffer(commandBufferRef.current);
            } else if (input === "\x03") {
                // Ctrl+C
                commandBufferRef.current = "";
                setCommandBuffer("");
                setShowSuggestionBox(false);
            } else if (input.length === 1 && input.charCodeAt(0) >= 32) {
                // Printable char
                commandBufferRef.current += input;
                setCommandBuffer(commandBufferRef.current);
            }
        });

        term.onResize((size) => socket.emit(eventsRef.current.resize, size));

        // Fallback timeout
        const readyTimeout = setTimeout(() => {
            if (!sshReady) {
                sshReady = true;
                clearInterval(spinnerInterval);
                term.write(`\r\x1b[K`);
                writeLog(`[${timestamp()}] Connection timeout — falling back to direct mode`, "33");
                writeLog("", "0");
                for (const data of pendingData) term.write(data);
                pendingData.length = 0;
                socket.on(eventsRef.current.data, (payload: string) => term.write(payload));
            }
        }, 15000);

        let prevCols = term.cols;
        const resizeObserver = new ResizeObserver(() => {
            fitAddon.fit();
            if (term.cols === prevCols) return;
            prevCols = term.cols;
        });
        resizeObserver.observe(containerRef.current);

        // Right-click paste
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
                } catch { /* */ }
            }
        };
        containerRef.current.addEventListener("contextmenu", handleContextMenu);

        const containerEl = containerRef.current;
        return () => {
            clearInterval(spinnerInterval);
            clearTimeout(readyTimeout);
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

    /* ── Ghost-text positioning ───────────────────────────── */
    useEffect(() => {
        const term = termRef.current;
        const ghost = ghostRef.current;
        if (!term || !ghost || !ghostCompletion) return;

        const sync = () => {
            const pos = getCursorPixelPos(term);
            if (pos) ghost.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
        };

        const raf = requestAnimationFrame(sync);
        const disposable = term.onCursorMove(sync);
        return () => {
            cancelAnimationFrame(raf);
            disposable.dispose();
        };
    }, [ghostCompletion]);

    /* ── Suggestion box positioning ───────────────────────── */
    useEffect(() => {
        const term = termRef.current;
        if (!term || !showSuggestionBox) return;
        const pos = getCursorPixelPos(term);
        if (pos) setSuggestionPos({ top: pos.y + 20, left: pos.x });
    }, [showSuggestionBox, commandBuffer]);

    /* ── Key handler: Tab/ArrowRight accept ghost, Ctrl+Space popup ── */
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handler = (e: KeyboardEvent) => {
            // Ctrl+Space → toggle suggestion box
            if (e.code === "Space" && e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                setShowSuggestionBox((s) => !s);
                return;
            }

            // Escape → close suggestion box
            if (e.key === "Escape") {
                setShowSuggestionBox(false);
                return;
            }

            // Tab/ArrowRight → accept ghost
            const cur = ghostCompletionRef.current;
            if (!cur) return;
            if (e.key === "Tab" || (e.key === "ArrowRight" && commandBufferRef.current.length > 0)) {
                e.preventDefault();
                e.stopPropagation();
                const remaining = cur.ghost;
                if (remaining && socketRef.current) {
                    socketRef.current.emit(eventsRef.current.input, remaining);
                    commandBufferRef.current = cur.full;
                    setCommandBuffer(cur.full);
                }
            }
        };

        container.addEventListener("keydown", handler, true);
        return () => container.removeEventListener("keydown", handler, true);
    }, []);

    /* ── Visibility / resize ──────────────────────────────── */
    useEffect(() => {
        if (visible) requestAnimationFrame(() => fitAddonRef.current?.fit());
    }, [visible]);

    useEffect(() => {
        if (termRef.current && themeProp) termRef.current.options.theme = themeProp;
    }, [themeProp]);

    useEffect(() => {
        if (termRef.current) {
            termRef.current.options.fontSize = fontSize;
            requestAnimationFrame(() => fitAddonRef.current?.fit());
        }
    }, [fontSize]);

    useEffect(() => {
        if (visible) {
            const id = setTimeout(() => termRef.current?.focus(), 50);
            return () => clearTimeout(id);
        }
    }, [visible]);

    /* ── Handle suggestion click ──────────────────────────── */
    const handleSuggestionClick = useCallback((cmd: string) => {
        if (!socketRef.current) return;
        // Clear current buffer and type the command
        const bufLen = commandBufferRef.current.length;
        // Send backspaces to clear current input
        for (let i = 0; i < bufLen; i++) {
            socketRef.current.emit(eventsRef.current.input, "\x7f");
        }
        // Then type the command
        socketRef.current.emit(eventsRef.current.input, cmd);
        commandBufferRef.current = cmd;
        setCommandBuffer(cmd);
        setShowSuggestionBox(false);
        termRef.current?.focus();
    }, []);

    const term = termRef.current;
    const theme = themeProp ?? DEFAULT_THEME;

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
            {/* Ghost text overlay */}
            {ghostCompletion && (
                <span
                    ref={ghostRef}
                    aria-hidden
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        willChange: "transform",
                        pointerEvents: "none",
                        whiteSpace: "pre",
                        fontFamily: term?.options.fontFamily ?? fontFamily,
                        fontSize: term?.options.fontSize ?? fontSize,
                        lineHeight: "normal",
                        color: "rgba(255,255,255,0.25)",
                        zIndex: 10,
                        userSelect: "none",
                    }}
                >
                    {ghostCompletion.ghost}
                </span>
            )}

            {/* Suggestion popup */}
            {showSuggestionBox && filteredSuggestions.length > 0 && (
                <div
                    className="absolute z-50 rounded-md shadow-lg overflow-hidden"
                    style={{
                        top: suggestionPos.top,
                        left: suggestionPos.left,
                        width: 260,
                        maxHeight: 200,
                        background: theme.background ?? "#1e1e2e",
                        border: `1px solid ${theme.brightBlack ?? "#585b70"}`,
                        color: theme.foreground ?? "#cdd6f4",
                    }}
                >
                    <div
                        className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider"
                        style={{ borderBottom: `1px solid ${theme.brightBlack ?? "#585b70"}`, color: theme.brightBlack ?? "#585b70" }}
                    >
                        Suggestions ({filteredSuggestions.length})
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 168 }}>
                        {filteredSuggestions.map((cmd, i) => (
                            <div
                                key={i}
                                className="px-2 py-1 text-xs font-mono cursor-pointer truncate transition-colors"
                                style={{ color: theme.green ?? "#a6e3a1" }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = `${theme.selectionBackground ?? "#585b7066"}`;
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = "transparent";
                                }}
                                onClick={() => handleSuggestionClick(cmd)}
                            >
                                {cmd}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

export default EditorTerminalWithGhost;
