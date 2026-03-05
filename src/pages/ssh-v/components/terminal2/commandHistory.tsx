import { useCallback, useMemo, useRef, useState } from "react";
import { History, Play, Search, Trash2, Terminal, Sparkles, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useCommandStore } from "@/store";
import { useAIChatStore, getDefaultModel } from "@/store/aiChatStore";
import { useTerminalStore } from "@/store/terminalStore";
import { __config } from "@/lib/config";
import { List, type RowComponentProps } from "react-window";
import AutoSizer from "./AutoSizer";

/**
 * Right-sidebar panel that lists shell-history commands for the active host.
 * Data lives in zustand only (resets on page reload / new session).
 *
 * • Double-click a row → paste the command into the terminal (without executing)
 * • Click the small "Run" button → paste AND execute (sends command + Enter)
 */

interface RowData {
    filtered: string[];
    colors: Record<string, string>;
    pasteCommand: (cmd: string) => void;
    runCommand: (cmd: string) => void;
    removeCommand: (cmd: string) => void;
}

function CommandRow({ index, style, filtered, colors, pasteCommand, runCommand, removeCommand }: RowComponentProps<RowData>) {
    const cmd = filtered[index];

    return (
        <div style={style} className="px-2">
            <div
                className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors overflow-hidden h-full"
                style={{ color: `${colors.foreground}cc` }}
                title="Double-click to paste into terminal"
                onDoubleClick={() => pasteCommand(cmd)}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = `${colors.foreground}10`;
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                }}
            >
                <Terminal size={13} className="shrink-0" style={{ color: `${colors.foreground}40` }} />
                <span className="w-0 flex-grow text-xs font-mono truncate select-none" title={cmd}>
                    {cmd}
                </span>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); runCommand(cmd); }}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ backgroundColor: `${colors.green}25`, color: colors.green }}
                        title="Run command"
                    >
                        <Play size={10} fill="currentColor" />
                        Run
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); removeCommand(cmd); }}
                        className="p-0.5 rounded"
                        style={{ color: `${colors.red}80` }}
                        title="Remove from history"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CommandHistory() {
    const { sessions, activeTabId } = useSSHStore();
    const { colors } = useSessionTheme();
    const { shellHistory, removeShellHistoryCommand } = useCommandStore();

    /* ── Derive host key ── */
    const host = useMemo(() => {
        if (!activeTabId) return null;
        const session = sessions[activeTabId];
        return session?.host ?? activeTabId;
    }, [activeTabId, sessions]);

    /* ── Commands from zustand (in-memory, per-host) ── */
    const commands = useMemo(() => {
        if (!host) return [];
        // Reverse so most-recent appears first
        return [...(shellHistory[host] ?? [])].reverse();
    }, [host, shellHistory]);

    const [query, setQuery] = useState("");

    /* ── Filtered list ── */
    const filtered = useMemo(() => {
        if (!query.trim()) return commands;
        const q = query.toLowerCase();
        return commands.filter((c) => c.toLowerCase().includes(q));
    }, [commands, query]);

    /* ── Get the active session's socket ── */
    const socket = useMemo(() => {
        if (!activeTabId) return null;
        return sessions[activeTabId]?.socket ?? null;
    }, [activeTabId, sessions]);

    /* ── Paste into terminal (write text without pressing Enter) ── */
    const pasteCommand = useCallback(
        (cmd: string) => {
            if (!socket) return;
            socket.emit(SocketEventConstants.SSH_EMIT_INPUT, cmd);
        },
        [socket],
    );

    /* ── Run command (paste + Enter) ── */
    const runCommand = useCallback(
        (cmd: string) => {
            if (!socket) return;
            socket.emit(SocketEventConstants.SSH_EMIT_INPUT, cmd + "\r");
        },
        [socket],
    );

    /* ── Remove a single command from the history ── */
    const removeCommand = useCallback(
        (cmd: string) => {
            if (!host) return;
            removeShellHistoryCommand(host, cmd);
        },
        [host, removeShellHistoryCommand],
    );

    /* ── No session ── */
    if (!activeTabId || !host) {
        return (
            <div className="flex items-center justify-center h-full p-6" style={{ color: `${colors.foreground}60` }}>
                <p className="text-sm text-center">No active session</p>
            </div>
        );
    }

    return (
        <div
            className="flex flex-col h-full overflow-hidden"
            style={{ backgroundColor: colors.background }}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: `${colors.foreground}15` }}>
                <History size={16} style={{ color: colors.cyan }} />
                <span className="text-xs font-medium truncate" style={{ color: `${colors.foreground}90` }}>
                    {host}
                </span>
                <span className="ml-auto text-xs tabular-nums" style={{ color: `${colors.foreground}50` }}>
                    {filtered.length}
                </span>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b" style={{ borderColor: `${colors.foreground}15` }}>
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: `${colors.foreground}50` }} />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter commands…"
                        className="pl-8 h-8 text-xs border-gray-700 focus:outline-none focus:ring-0"
                        style={{ backgroundColor: `${colors.foreground}10` }}
                    />
                </div>
            </div>

            {/* Command list — virtualized */}
            <div className="flex-1 min-h-0">
                {filtered.length === 0 ? (
                    <p className="text-xs text-center py-8" style={{ color: `${colors.foreground}40` }}>
                        {commands.length === 0 ? "No commands recorded yet" : "No matches"}
                    </p>
                ) : (
                    <AutoSizer>
                        {({ height, width }) => (
                            <List
                                style={{ height, width }}
                                rowCount={filtered.length}
                                rowHeight={36}
                                overscanCount={10}
                                rowComponent={CommandRow}
                                rowProps={{ filtered, colors, pasteCommand, runCommand, removeCommand }}
                            />
                        )}
                    </AutoSizer>
                )}
            </div>

            {/* Ask AI */}
            <AskAIInput sessionId={activeTabId} colors={colors} />
        </div>
    );
}

/* ── Ask AI inline input ──────────────────────────────────── */

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
}

function AskAIInput({ sessionId, colors }: { sessionId: string; colors: Record<string, string> }) {
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const logs = useTerminalStore((s) => s.logs[sessionId] ?? []);

    const handleSend = useCallback(async () => {
        const trimmed = prompt.trim();
        if (!trimmed || loading) return;

        setLoading(true);
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const state = useAIChatStore.getState();
            const model = state.selectedModel[sessionId] ?? getDefaultModel(state.providers);
            const last50 = logs.slice(-50);
            const termContext = stripAnsi(last50.join('')).trim();

            const payload = {
                modelId: model?.modelId ?? '',
                providerId: model?.providerId ?? '',
                question: `Given this terminal context, suggest a single shell command for: "${trimmed}". Reply ONLY with the raw command, no explanation, no markdown, no code fences.`,
                selection: '',
                context: termContext ? `Recent terminal output:\n${termContext}` : '',
                history: [],
            };

            const res = await fetch(`${__config.API_URL}/api/chat/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const events = buffer.split('\n\n');
                buffer = events.pop() ?? '';

                for (const event of events) {
                    const lines = event.split('\n');
                    let eventType = '';
                    let eventData = '';
                    for (const line of lines) {
                        if (line.startsWith('event:')) eventType = line.slice(6).trim();
                        else if (line.startsWith('data:')) eventData = line.slice(5).trim();
                    }
                    if (!eventData) continue;
                    try {
                        const json = JSON.parse(eventData);
                        if (eventType === 'chunk') fullText += json.text ?? '';
                        else if (eventType === 'done') fullText = json.text ?? fullText;
                    } catch {
                        fullText += eventData;
                    }
                }
            }

            // Clean up — strip code fences, backticks, leading $
            let cmd = fullText.trim();
            cmd = cmd.replace(/^```(?:\w*)\n?/i, '').replace(/\n?```$/, '').trim();
            cmd = cmd.replace(/^`|`$/g, '').trim();
            cmd = cmd.replace(/^\$\s*/, '').trim();

            if (cmd) {
                useAIChatStore.getState().setGhostCommand(sessionId, cmd);
            }
            setPrompt("");
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                console.error('Ask AI error:', err);
            }
        } finally {
            setLoading(false);
            abortRef.current = null;
        }
    }, [prompt, loading, sessionId, logs]);

    return (
        <div className="px-3 py-2 border-t shrink-0" style={{ borderColor: `${colors.foreground}15` }}>
            <div className="relative flex items-center gap-1.5">
                <Sparkles size={14} className="shrink-0" style={{ color: colors.cyan }} />
                <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Ask AI a command…"
                    className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
                    style={{ color: `${colors.foreground}cc` }}
                    disabled={loading}
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !prompt.trim()}
                    className="p-1 rounded transition-colors shrink-0"
                    style={{ color: loading ? `${colors.foreground}40` : colors.cyan }}
                    title="Send"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
            </div>
        </div>
    );
}
