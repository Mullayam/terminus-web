/**
 * @module editor/components/CommandPalette
 * 
 * VS Code-style Command Palette (Ctrl+Shift+P) with fuzzy search,
 * keyboard navigation, and categorized commands.
 */
import { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
    Search, Save, Undo2, Redo2, WrapText, Map, ZoomIn, ZoomOut,
    BookLock, Palette, Keyboard, AlignLeft, RotateCcw, Hash,
    Replace, Indent, Outdent, CaseUpper, CaseLower, ArrowUpDown,
    MessageSquareCode, RemoveFormatting, CopyPlus, ArrowUp, ArrowDown,
    Eye, EyeOff, Terminal, SplitSquareHorizontal,
} from "lucide-react";
import { useEditorStore, useEditorStoreApi } from "../state/context";
import { useEditor } from "../hooks/useEditor";

interface Command {
    id: string;
    label: string;
    category: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
    when?: () => boolean;
}

interface CommandPaletteProps {
    onSave: () => void;
    onReload?: () => void;
    onFormat?: () => void;
}

export const CommandPalette = memo(function CommandPalette({
    onSave,
    onReload,
    onFormat,
}: CommandPaletteProps) {
    const showCommandPalette = useEditorStore((s) => s.showCommandPalette);
    const closeCommandPalette = useEditorStore((s) => s.closeCommandPalette);
    const storeApi = useEditorStoreApi();
    const editor = useEditor();

    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const iconSize = "w-3.5 h-3.5";

    const commands = useMemo((): Command[] => {
        const s = storeApi.getState();
        return [
            // File
            { id: "save", label: "Save File", category: "File", icon: <Save className={iconSize} />, shortcut: "Ctrl+S", action: onSave },
            ...(onReload ? [{ id: "reload", label: "Reload File", category: "File", icon: <RotateCcw className={iconSize} />, action: onReload }] : []),
            ...(onFormat ? [{ id: "format", label: "Format Document", category: "File", icon: <AlignLeft className={iconSize} />, shortcut: "Ctrl+Shift+F", action: onFormat }] : []),

            // Edit
            { id: "undo", label: "Undo", category: "Edit", icon: <Undo2 className={iconSize} />, shortcut: "Ctrl+Z", action: () => s.undo() },
            { id: "redo", label: "Redo", category: "Edit", icon: <Redo2 className={iconSize} />, shortcut: "Ctrl+Y", action: () => s.redo() },
            { id: "indent", label: "Indent Lines", category: "Edit", icon: <Indent className={iconSize} />, shortcut: "Tab", action: editor.indent },
            { id: "outdent", label: "Outdent Lines", category: "Edit", icon: <Outdent className={iconSize} />, shortcut: "Shift+Tab", action: editor.outdent },
            { id: "delete-line", label: "Delete Line", category: "Edit", icon: <RemoveFormatting className={iconSize} />, shortcut: "Ctrl+Shift+K", action: editor.deleteLine },
            { id: "duplicate-line", label: "Duplicate Line", category: "Edit", icon: <CopyPlus className={iconSize} />, shortcut: "Ctrl+D", action: editor.duplicateLine },
            { id: "move-up", label: "Move Line Up", category: "Edit", icon: <ArrowUp className={iconSize} />, shortcut: "Alt+\u2191", action: editor.moveLineUp },
            { id: "move-down", label: "Move Line Down", category: "Edit", icon: <ArrowDown className={iconSize} />, shortcut: "Alt+\u2193", action: editor.moveLineDown },
            { id: "toggle-comment", label: "Toggle Comment", category: "Edit", icon: <MessageSquareCode className={iconSize} />, shortcut: "Ctrl+/", action: editor.toggleComment },

            // Transform
            { id: "sort-lines", label: "Sort Lines", category: "Transform", icon: <ArrowUpDown className={iconSize} />, action: editor.sortLines },
            { id: "uppercase", label: "Transform to Uppercase", category: "Transform", icon: <CaseUpper className={iconSize} />, shortcut: "Ctrl+Shift+U", action: editor.toUpper },
            { id: "lowercase", label: "Transform to Lowercase", category: "Transform", icon: <CaseLower className={iconSize} />, shortcut: "Ctrl+Shift+L", action: editor.toLower },
            { id: "trim-ws", label: "Trim Trailing Whitespace", category: "Transform", icon: <RemoveFormatting className={iconSize} />, action: editor.trimWhitespace },

            // Search
            { id: "find", label: "Find", category: "Search", icon: <Search className={iconSize} />, shortcut: "Ctrl+F", action: () => s.openFind() },
            { id: "find-replace", label: "Find and Replace", category: "Search", icon: <Replace className={iconSize} />, shortcut: "Ctrl+H", action: () => s.openFindReplace() },
            { id: "go-to-line", label: "Go to Line...", category: "Search", icon: <Hash className={iconSize} />, shortcut: "Ctrl+G", action: () => s.openGoToLine() },

            // View
            { id: "toggle-wrap", label: "Toggle Word Wrap", category: "View", icon: <WrapText className={iconSize} />, shortcut: "Alt+Z", action: () => s.toggleWordWrap() },
            { id: "toggle-minimap", label: "Toggle Minimap", category: "View", icon: <Map className={iconSize} />, shortcut: "Ctrl+M", action: () => s.toggleMinimap() },
            { id: "zoom-in", label: "Zoom In", category: "View", icon: <ZoomIn className={iconSize} />, shortcut: "Ctrl+=", action: () => s.zoomIn() },
            { id: "zoom-out", label: "Zoom Out", category: "View", icon: <ZoomOut className={iconSize} />, shortcut: "Ctrl+-", action: () => s.zoomOut() },
            { id: "reset-zoom", label: "Reset Zoom", category: "View", icon: <ZoomIn className={iconSize} />, shortcut: "Ctrl+0", action: () => s.resetZoom() },
            { id: "toggle-readonly", label: "Toggle Read Only", category: "View", icon: <BookLock className={iconSize} />, action: () => s.toggleReadOnly() },
            { id: "toggle-ws", label: "Toggle Whitespace Visibility", category: "View", icon: <Eye className={iconSize} />, action: () => s.toggleWhitespace() },
            { id: "theme", label: "Open Theme Selector", category: "View", icon: <Palette className={iconSize} />, action: () => s.openThemeSelector() },
            { id: "shortcuts", label: "Show Keyboard Shortcuts", category: "View", icon: <Keyboard className={iconSize} />, shortcut: "Ctrl+K", action: () => s.openShortcuts() },

            // Settings
            { id: "toggle-autosave", label: "Toggle Auto Save", category: "Settings", icon: <Save className={iconSize} />, action: () => s.setAutoSave(!s.autoSave) },
            { id: "toggle-autoclose", label: "Toggle Auto Close Brackets", category: "Settings", icon: <SplitSquareHorizontal className={iconSize} />, action: () => s.setAutoCloseBrackets(!s.autoCloseBrackets) },
            { id: "tab-2", label: "Set Tab Size: 2", category: "Settings", icon: <Indent className={iconSize} />, action: () => s.setTabSize(2) },
            { id: "tab-4", label: "Set Tab Size: 4", category: "Settings", icon: <Indent className={iconSize} />, action: () => s.setTabSize(4) },
            { id: "line-lf", label: "Set Line Ending: LF", category: "Settings", icon: <Terminal className={iconSize} />, action: () => s.setLineEnding('lf') },
            { id: "line-crlf", label: "Set Line Ending: CRLF", category: "Settings", icon: <Terminal className={iconSize} />, action: () => s.setLineEnding('crlf') },
        ];
    }, [storeApi, onSave, onReload, onFormat, editor, iconSize]);

    // Filter commands by query
    const filteredCommands = useMemo(() => {
        if (!query.trim()) return commands;
        const lower = query.toLowerCase();
        return commands.filter(
            (cmd) =>
                cmd.label.toLowerCase().includes(lower) ||
                cmd.category.toLowerCase().includes(lower) ||
                cmd.id.toLowerCase().includes(lower)
        );
    }, [commands, query]);

    // Reset selection when filter changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredCommands.length]);

    // Focus input on open
    useEffect(() => {
        if (showCommandPalette) {
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [showCommandPalette]);

    // Scroll selected item into view
    useEffect(() => {
        if (!listRef.current) return;
        const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
        selected?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    const executeCommand = useCallback(
        (cmd: Command) => {
            closeCommandPalette();
            // Delay action execution to allow palette to close
            requestAnimationFrame(() => cmd.action());
        },
        [closeCommandPalette],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
                closeCommandPalette();
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === "Enter" && filteredCommands.length > 0) {
                e.preventDefault();
                executeCommand(filteredCommands[selectedIndex]);
                return;
            }
        },
        [closeCommandPalette, filteredCommands, selectedIndex, executeCommand],
    );

    if (!showCommandPalette) return null;

    // Group filtered commands by category
    let lastCategory = "";

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={(e) => { if (e.target === e.currentTarget) closeCommandPalette(); }}
        >
            <div
                className="w-[520px] max-h-[400px] rounded-lg shadow-2xl overflow-hidden editor-animate-in flex flex-col"
                style={{
                    background: "var(--editor-popup-bg)",
                    border: "1px solid var(--editor-border)",
                }}
                onKeyDown={handleKeyDown}
            >
                {/* Search input */}
                <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ borderBottom: "1px solid var(--editor-border)" }}
                >
                    <Search className="w-4 h-4 shrink-0" style={{ color: "var(--editor-muted)" }} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type a command..."
                        className="flex-1 outline-none text-[13px]"
                        style={{
                            background: "transparent",
                            color: "var(--editor-foreground)",
                            border: "none",
                            fontFamily: "var(--editor-font-family)",
                        }}
                    />
                    <span
                        className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: "var(--editor-popup-hover-bg)", color: "var(--editor-muted)" }}
                    >
                        {filteredCommands.length} commands
                    </span>
                </div>

                {/* Command list */}
                <div ref={listRef} className="overflow-y-auto flex-1 p-1">
                    {filteredCommands.length === 0 && (
                        <div className="text-center py-4 text-[13px]" style={{ color: "var(--editor-muted)" }}>
                            No matching commands
                        </div>
                    )}
                    {filteredCommands.map((cmd, i) => {
                        const showCategory = cmd.category !== lastCategory;
                        lastCategory = cmd.category;
                        return (
                            <div key={cmd.id}>
                                {showCategory && (
                                    <div
                                        className="text-[10px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1"
                                        style={{ color: "var(--editor-muted)" }}
                                    >
                                        {cmd.category}
                                    </div>
                                )}
                                <button
                                    onClick={() => executeCommand(cmd)}
                                    onMouseEnter={() => setSelectedIndex(i)}
                                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors"
                                    style={{
                                        background: i === selectedIndex ? "var(--editor-popup-hover-bg)" : "transparent",
                                        color: "var(--editor-foreground)",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    <span
                                        className="w-4 h-4 flex items-center justify-center shrink-0"
                                        style={{ color: "var(--editor-accent)" }}
                                    >
                                        {cmd.icon}
                                    </span>
                                    <span className="flex-1 text-left">{cmd.label}</span>
                                    {cmd.shortcut && (
                                        <span
                                            className="text-[11px] tracking-wide"
                                            style={{ color: "var(--editor-muted)" }}
                                        >
                                            {cmd.shortcut}
                                        </span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
