import { useEffect, useRef, useState } from "react";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import {
    Loader2, Save, WrapText, Undo2, Redo2,
    Scissors, Copy, ClipboardPaste, TextSelect,
    Indent, Outdent, RemoveFormatting, Braces,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Socket } from "socket.io-client";

interface FileEditorProps {
    filePath: string;
    fileName: string;
    socket: Socket | null | undefined;
    /** When true the editor uses full available height instead of a capped dialog size */
    fullScreen?: boolean;
    onClose?: () => void;
}

/** Detect language from file extension for status bar display */
function detectLang(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
        js: "JavaScript", jsx: "JavaScript (JSX)", ts: "TypeScript", tsx: "TypeScript (TSX)",
        py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin",
        c: "C", cpp: "C++", h: "C Header", cs: "C#", swift: "Swift",
        html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS", less: "LESS",
        json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", xml: "XML",
        md: "Markdown", sh: "Shell", bash: "Bash", zsh: "Zsh",
        sql: "SQL", graphql: "GraphQL", dockerfile: "Dockerfile",
        env: "Environment", conf: "Config", ini: "INI", cfg: "Config",
        txt: "Plain Text", log: "Log",
    };
    if (name.toLowerCase() === "dockerfile") return "Dockerfile";
    return map[ext] ?? "Plain Text";
}

export function FileEditor({ filePath, fileName, socket, fullScreen = false, onClose }: FileEditorProps) {
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [wordWrap, setWordWrap] = useState(true);
    const [cursorLine, setCursorLine] = useState(1);
    const [cursorCol, setCursorCol] = useState(1);
    const [modified, setModified] = useState(false);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const ctxMenuRef = useRef<HTMLDivElement>(null);
    const editorWrapperRef = useRef<HTMLDivElement>(null);
    const originalContent = useRef<string>("");
    const { toast } = useToast();

    // ── Undo / Redo stacks ──────────────────────────────────
    const undoStack = useRef<string[]>([]);
    const redoStack = useRef<string[]>([]);

    const lines = content.split("\n");
    const lineCount = lines.length;
    const lang = detectLang(fileName);

    // Sync gutter scroll with textarea scroll
    const handleScroll = () => {
        if (textareaRef.current && gutterRef.current) {
            gutterRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    // Update cursor position
    const updateCursor = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const textBefore = ta.value.substring(0, pos);
        const line = textBefore.split("\n").length;
        const col = pos - textBefore.lastIndexOf("\n");
        setCursorLine(line);
        setCursorCol(col);
    };

    // Request file content on mount
    useEffect(() => {
        if (!socket) {
            setError("Socket not connected");
            setLoading(false);
            return;
        }

        const handleResponse = (data: string) => {
            setContent(data);
            originalContent.current = data;
            setLoading(false);
            setTimeout(() => textareaRef.current?.focus(), 100);
        };

        const handleError = (data: { message?: string }) => {
            setError(data?.message ?? "Failed to load file");
            setLoading(false);
        };

        socket.on(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, handleResponse);
        socket.on(SocketEventConstants.SFTP_EMIT_ERROR, handleError);
        socket.emit(SocketEventConstants.SFTP_EDIT_FILE_REQUEST, { path: filePath });

        return () => {
            socket.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, handleResponse);
            socket.off(SocketEventConstants.SFTP_EMIT_ERROR, handleError);
        };
    }, [socket, filePath]);

    const handleContentChange = (value: string) => {
        // Push current content onto undo stack before changing
        undoStack.current.push(content);
        if (undoStack.current.length > 200) undoStack.current.shift();
        redoStack.current = [];
        setContent(value);
        setModified(value !== originalContent.current);
    };

    const doUndo = () => {
        if (undoStack.current.length === 0) return;
        const prev = undoStack.current.pop()!;
        redoStack.current.push(content);
        setContent(prev);
        setModified(prev !== originalContent.current);
    };

    const doRedo = () => {
        if (redoStack.current.length === 0) return;
        const next = redoStack.current.pop()!;
        undoStack.current.push(content);
        setContent(next);
        setModified(next !== originalContent.current);
    };

    const handleSave = () => {
        if (!socket) return;
        setSaving(true);

        const onDone = () => {
            setSaving(false);
            setModified(false);
            originalContent.current = content;
            toast({
                title: "Saved",
                description: `${fileName} saved successfully`,
                duration: 2000,
            });
            socket.off(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone);
        };

        socket.on(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone);
        socket.emit(SocketEventConstants.SFTP_EDIT_FILE_DONE, {
            path: filePath,
            content,
        });
    };

    // ── Context menu helpers ──────────────────────────────────
    const hasSelection = () => {
        const ta = textareaRef.current;
        return ta ? ta.selectionStart !== ta.selectionEnd : false;
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const wrapper = editorWrapperRef.current;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    // Close context menu on outside click or escape
    useEffect(() => {
        if (!ctxMenu) return;
        const close = () => setCtxMenu(null);
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
        window.addEventListener("pointerdown", close);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("pointerdown", close);
            window.removeEventListener("keydown", onKey);
        };
    }, [ctxMenu]);

    const ctxAction = (fn: () => void) => {
        fn();
        setCtxMenu(null);
        textareaRef.current?.focus();
    };

    const doCut = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const sel = content.substring(ta.selectionStart, ta.selectionEnd);
        navigator.clipboard.writeText(sel);
        const newContent = content.substring(0, ta.selectionStart) + content.substring(ta.selectionEnd);
        const pos = ta.selectionStart;
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos; });
    };

    const doCopy = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        navigator.clipboard.writeText(content.substring(ta.selectionStart, ta.selectionEnd));
    };

    const doPaste = async () => {
        const ta = textareaRef.current;
        if (!ta) return;
        try {
            const text = await navigator.clipboard.readText();
            const start = ta.selectionStart;
            const newContent = content.substring(0, start) + text + content.substring(ta.selectionEnd);
            handleContentChange(newContent);
            requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + text.length; });
        } catch { /* clipboard permission denied */ }
    };

    const doSelectAll = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.selectionStart = 0;
        ta.selectionEnd = content.length;
    };

    const doIndentSelection = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = content.substring(0, start);
        const sel = content.substring(start, end);
        const after = content.substring(end);
        const lineStart = before.lastIndexOf("\n") + 1;
        const block = content.substring(lineStart, end);
        const indented = block.split("\n").map((l) => "  " + l).join("\n");
        const newContent = content.substring(0, lineStart) + indented + after;
        handleContentChange(newContent);
        const addedChars = indented.length - block.length;
        requestAnimationFrame(() => { ta.selectionStart = start + 2; ta.selectionEnd = end + addedChars; });
    };

    const doOutdentSelection = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = content.substring(0, start);
        const after = content.substring(end);
        const lineStart = before.lastIndexOf("\n") + 1;
        const block = content.substring(lineStart, end);
        const outdented = block.split("\n").map((l) => l.startsWith("  ") ? l.slice(2) : l.startsWith(" ") ? l.slice(1) : l).join("\n");
        const removedChars = block.length - outdented.length;
        const newContent = content.substring(0, lineStart) + outdented + after;
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = Math.max(lineStart, start - 2); ta.selectionEnd = end - removedChars; });
    };

    const doTrimWhitespace = () => {
        const trimmed = content.split("\n").map((l) => l.trimEnd()).join("\n");
        handleContentChange(trimmed);
    };

    const doFormatJSON = () => {
        try {
            const parsed = JSON.parse(content);
            const formatted = JSON.stringify(parsed, null, 2);
            handleContentChange(formatted);
            toast({ title: "Formatted", description: "JSON formatted successfully", duration: 1500 });
        } catch {
            toast({ title: "Format Error", description: "Content is not valid JSON", variant: "destructive", duration: 2000 });
        }
    };

    const doDeleteLine = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const before = content.substring(0, pos);
        const lineStart = before.lastIndexOf("\n") + 1;
        const lineEnd = content.indexOf("\n", pos);
        const newContent = content.substring(0, lineStart) + (lineEnd >= 0 ? content.substring(lineEnd + 1) : "");
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = lineStart; });
    };

    const doDuplicateLine = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const before = content.substring(0, pos);
        const lineStart = before.lastIndexOf("\n") + 1;
        const lineEnd = content.indexOf("\n", pos);
        const line = content.substring(lineStart, lineEnd >= 0 ? lineEnd : content.length);
        const newContent = content.substring(0, lineEnd >= 0 ? lineEnd : content.length) + "\n" + line + (lineEnd >= 0 ? content.substring(lineEnd) : "");
        handleContentChange(newContent);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + line.length + 1; });
    };

    // Context menu items definition
    const ctxItems: { label: string; icon: React.ReactNode; action: () => void; disabled?: boolean; shortcut?: string; separator?: boolean }[] = [
        { label: "Undo", icon: <Undo2 className="w-3.5 h-3.5" />, action: doUndo, disabled: undoStack.current.length === 0, shortcut: "Ctrl+Z" },
        { label: "Redo", icon: <Redo2 className="w-3.5 h-3.5" />, action: doRedo, disabled: redoStack.current.length === 0, shortcut: "Ctrl+Shift+Z", separator: true },
        { label: "Cut", icon: <Scissors className="w-3.5 h-3.5" />, action: doCut, disabled: !hasSelection(), shortcut: "Ctrl+X" },
        { label: "Copy", icon: <Copy className="w-3.5 h-3.5" />, action: doCopy, disabled: !hasSelection(), shortcut: "Ctrl+C" },
        { label: "Paste", icon: <ClipboardPaste className="w-3.5 h-3.5" />, action: doPaste, shortcut: "Ctrl+V" },
        { label: "Select All", icon: <TextSelect className="w-3.5 h-3.5" />, action: doSelectAll, shortcut: "Ctrl+A", separator: true },
        { label: "Indent", icon: <Indent className="w-3.5 h-3.5" />, action: doIndentSelection, shortcut: "Tab" },
        { label: "Outdent", icon: <Outdent className="w-3.5 h-3.5" />, action: doOutdentSelection, shortcut: "Shift+Tab", separator: true },
        { label: "Delete Line", icon: <RemoveFormatting className="w-3.5 h-3.5" />, action: doDeleteLine, shortcut: "Ctrl+Shift+K" },
        { label: "Duplicate Line", icon: <Copy className="w-3.5 h-3.5" />, action: doDuplicateLine, separator: true },
        { label: "Trim Whitespace", icon: <RemoveFormatting className="w-3.5 h-3.5" />, action: doTrimWhitespace },
        { label: "Format JSON", icon: <Braces className="w-3.5 h-3.5" />, action: doFormatJSON, disabled: lang !== "JSON" },
        { label: "Save", icon: <Save className="w-3.5 h-3.5" />, action: handleSave, disabled: !modified, shortcut: "Ctrl+S" },
    ];

    // Handle keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl+S → save
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            handleSave();
            return;
        }

        // Ctrl+Z → undo
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
            e.preventDefault();
            doUndo();
            return;
        }

        // Ctrl+Shift+Z or Ctrl+Y → redo
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === "Z" || e.key === "y")) {
            e.preventDefault();
            doRedo();
            return;
        }

        // Ctrl+Shift+K → delete line
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "K") {
            e.preventDefault();
            doDeleteLine();
            return;
        }

        // Ctrl+D → duplicate line
        if ((e.ctrlKey || e.metaKey) && e.key === "d") {
            e.preventDefault();
            doDuplicateLine();
            return;
        }

        // Tab → insert spaces
        if (e.key === "Tab") {
            e.preventDefault();
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;

            if (e.shiftKey) {
                // Outdent: remove up to 2 leading spaces from the current line
                const before = content.substring(0, start);
                const lineStart = before.lastIndexOf("\n") + 1;
                const linePrefix = content.substring(lineStart, start);
                const spacesToRemove = linePrefix.startsWith("  ") ? 2 : linePrefix.startsWith(" ") ? 1 : 0;
                if (spacesToRemove > 0) {
                    const newContent = content.substring(0, lineStart) + content.substring(lineStart + spacesToRemove);
                    handleContentChange(newContent);
                    requestAnimationFrame(() => {
                        ta.selectionStart = ta.selectionEnd = start - spacesToRemove;
                    });
                }
            } else {
                // Indent: insert 2 spaces
                const newContent = content.substring(0, start) + "  " + content.substring(end);
                handleContentChange(newContent);
                requestAnimationFrame(() => {
                    ta.selectionStart = ta.selectionEnd = start + 2;
                });
            }
            return;
        }

        // Enter → auto-indent
        if (e.key === "Enter") {
            e.preventDefault();
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const before = content.substring(0, start);
            const currentLine = before.substring(before.lastIndexOf("\n") + 1);
            const indent = currentLine.match(/^(\s*)/)?.[1] ?? "";
            const insert = "\n" + indent;
            const newContent = content.substring(0, start) + insert + content.substring(ta.selectionEnd);
            handleContentChange(newContent);
            requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + insert.length;
            });
            return;
        }

        // Auto-close brackets
        const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
        if (pairs[e.key]) {
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            if (start !== end) {
                // Wrap selection
                e.preventDefault();
                const selected = content.substring(start, end);
                const newContent = content.substring(0, start) + e.key + selected + pairs[e.key] + content.substring(end);
                handleContentChange(newContent);
                requestAnimationFrame(() => {
                    ta.selectionStart = start + 1;
                    ta.selectionEnd = end + 1;
                });
            }
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Loading {fileName}…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
                <span className="text-sm text-red-400">{error}</span>
            </div>
        );
    }

    const gutterWidth = Math.max(String(lineCount).length * 10 + 20, 40);

    return (
        <div className="flex flex-col w-full rounded-lg overflow-hidden border border-white/[0.06] bg-[#0d0e14]">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#13141b] border-b border-white/[0.06]">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-gray-200 truncate">
                        {fileName}
                    </span>
                    {modified && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
                    )}
                    <span className="text-[11px] text-gray-600 font-mono truncate hidden sm:inline">
                        {filePath}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setWordWrap((w) => !w)}
                        title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
                        className={`p-1.5 rounded-md transition-colors ${wordWrap ? "bg-white/[0.08] text-gray-300" : "text-gray-600 hover:text-gray-400"}`}
                    >
                        <WrapText className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !modified}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors ml-1"
                    >
                        {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5" />
                        )}
                        {saving ? "Saving…" : "Save"}
                    </button>
                </div>
            </div>

            {/* Editor body */}
            <div
                ref={editorWrapperRef}
                className="relative flex flex-1 overflow-hidden"
                style={{ height: fullScreen ? "calc(100vh - 80px)" : "min(350px, 55vh)" }}
                onContextMenu={handleContextMenu}
            >
                {/* Custom context menu */}
                {ctxMenu && (
                    <div
                        ref={ctxMenuRef}
                        className="absolute z-50 w-52 p-1.5 bg-[#1a1b26]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-100"
                        style={{ left: ctxMenu.x, top: ctxMenu.y }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {ctxItems.map((item, i) => (
                            <div key={i}>
                                <button
                                    disabled={item.disabled}
                                    onClick={() => ctxAction(item.action)}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:text-gray-600 disabled:pointer-events-none"
                                >
                                    <span className="w-4 h-4 flex items-center justify-center text-gray-500">
                                        {item.icon}
                                    </span>
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {item.shortcut && (
                                        <span className="text-[11px] text-gray-600 ml-auto pl-3 tracking-wide">
                                            {item.shortcut}
                                        </span>
                                    )}
                                </button>
                                {item.separator && <div className="my-1 h-px bg-white/[0.06]" />}
                            </div>
                        ))}
                    </div>
                )}
                {/* Line number gutter */}
                <div
                    ref={gutterRef}
                    className="shrink-0 overflow-hidden select-none pointer-events-none bg-[#0a0b10] border-r border-white/[0.04]"
                    style={{ width: gutterWidth }}
                    aria-hidden
                >
                    <div className="py-[10px]">
                        {Array.from({ length: lineCount }, (_, i) => (
                            <div
                                key={i}
                                className={`px-2 text-right font-mono leading-[20px] text-[12px] ${i + 1 === cursorLine ? "text-gray-400" : "text-gray-700"
                                    }`}
                                style={{ height: 20 }}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    onScroll={handleScroll}
                    onKeyDown={handleKeyDown}
                    onKeyUp={updateCursor}
                    onClick={updateCursor}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="flex-1 resize-none bg-transparent text-gray-200 text-[13px] font-mono p-[10px] outline-none leading-[20px] caret-emerald-400 placeholder:text-gray-700"
                    style={{
                        whiteSpace: wordWrap ? "pre-wrap" : "pre",
                        overflowWrap: wordWrap ? "break-word" : "normal",
                        overflowX: wordWrap ? "hidden" : "auto",
                        tabSize: 2,
                    }}
                    placeholder="File is empty"
                />
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-3 py-1 bg-[#13141b] border-t border-white/[0.06] text-[11px] text-gray-600 select-none">
                <div className="flex items-center gap-3">
                    <span>{lang}</span>
                    <span>UTF-8</span>
                    <span>{wordWrap ? "Wrap" : "No Wrap"}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span>Ln {cursorLine}, Col {cursorCol}</span>
                    <span>{lineCount} lines</span>
                    <span>{content.length.toLocaleString()} chars</span>
                    <span className="hidden sm:inline">Ctrl+S save · Ctrl+Shift+K del line · Ctrl+D dup line</span>
                </div>
            </div>
        </div>
    );
}
