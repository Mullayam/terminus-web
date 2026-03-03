import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Play, Search, Trash2, Terminal } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { SocketEventConstants } from "@/lib/sockets/event-constants";

/**
 * Right-sidebar panel that lists every command the user has run on the
 * current host (persisted in localStorage under `terminus-suggestions:{host}`).
 *
 * • Double-click a row → paste the command into the terminal (without executing)
 * • Click the small "Run" button → paste AND execute (sends command + Enter)
 */
export default function CommandHistory() {
    const { sessions, activeTabId } = useSSHStore();
    const { colors } = useSessionTheme();

    /* ── Derive the host-key exactly like Terminal.tsx does ── */
    const hostKey = useMemo(() => {
        if (!activeTabId) return null;
        const session = sessions[activeTabId];
        const host = session?.host ?? activeTabId;
        return `terminus-suggestions:${host}`;
    }, [activeTabId, sessions]);

    /* ── Load commands from localStorage ── */
    const [commands, setCommands] = useState<string[]>([]);
    const [query, setQuery] = useState("");

    // Re-read whenever the active session changes or on focus
    const loadCommands = useCallback(() => {
        if (!hostKey) {
            setCommands([]);
            return;
        }
        try {
            const raw = localStorage.getItem(hostKey);
            const parsed: string[] = raw ? JSON.parse(raw) : [];
            // Deduplicate & keep order (most recent last → reverse to show most recent first)
            const unique = [...new Set(parsed)].reverse();
            setCommands(unique);
        } catch {
            setCommands([]);
        }
    }, [hostKey]);

    useEffect(() => {
        loadCommands();

        // Poll every 2s so changes from Terminal.tsx are reflected without a global event bus
        const id = setInterval(loadCommands, 2000);
        return () => clearInterval(id);
    }, [loadCommands]);

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

    /* ── Remove a single command from the persisted list ── */
    const removeCommand = useCallback(
        (cmd: string) => {
            if (!hostKey) return;
            setCommands((prev) => {
                const next = prev.filter((c) => c !== cmd);
                // Persist back (reverse to restore original order)
                try {
                    const stored = [...next].reverse();
                    localStorage.setItem(hostKey, JSON.stringify(stored));
                } catch { /* quota */ }
                return next;
            });
        },
        [hostKey],
    );

    /* ── No session ── */
    if (!activeTabId) {
        return (
            <div className="flex items-center justify-center h-full p-6" style={{ color: `${colors.foreground}60` }}>
                <p className="text-sm text-center">No active session</p>
            </div>
        );
    }

    const host = sessions[activeTabId]?.host ?? activeTabId;

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

            {/* Command list */}
            <ScrollArea className="flex-1">
                <div className="p-2 overflow-hidden">
                    {filtered.length === 0 && (
                        <p className="text-xs text-center py-8" style={{ color: `${colors.foreground}40` }}>
                            {commands.length === 0 ? "No commands recorded yet" : "No matches"}
                        </p>
                    )}

                    {filtered.map((cmd, i) => (
                        <div key={`${cmd}-${i}`}>
                            <div
                                className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors overflow-hidden"
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

                                {/* Action buttons — visible on hover */}
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            runCommand(cmd);
                                        }}
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{
                                            backgroundColor: `${colors.green}25`,
                                            color: colors.green,
                                        }}
                                        title="Run command"
                                    >
                                        <Play size={10} fill="currentColor" />
                                        Run
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeCommand(cmd);
                                        }}
                                        className="p-0.5 rounded"
                                        style={{ color: `${colors.red}80` }}
                                        title="Remove from history"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {i < filtered.length - 1 && (
                                <Separator className="my-0.5" style={{ backgroundColor: `${colors.foreground}08` }} />
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
