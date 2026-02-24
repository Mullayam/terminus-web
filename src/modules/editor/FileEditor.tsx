/**
 * @module editor/FileEditor
 *
 * Main composition component for the modular file editor.
 * Wires together:
 *   EditorProvider → ErrorBoundary → Toolbar → FindBar → GoToLine →
 *   EditorBody (Gutter + Overlay + Textarea + Minimap) → StatusBar →
 *   ThemeSelector (side panel) → CommandPalette → ShortcutsModal
 *
 * Features:
 *   - Auto-save with debounce
 *   - Ctrl+Mouse wheel zoom
 *   - Auto-close brackets / Auto-indent
 *   - Whitespace visibility overlay
 *   - VS Code-style context menu (22+ items)
 *   - Command palette (Ctrl+Shift+P)
 *
 * Usage:
 *   <FileEditor
 *     sessionId="abc123"
 *     remotePath="/etc/nginx/nginx.conf"
 *     provider={new ApiContentProvider()}
 *   />
 */
import { useCallback, useEffect, useRef, useMemo, useState, type CSSProperties } from "react";
import type { ContentProvider } from "./types";
import { EditorProvider, useEditorStore, useEditorStoreApi, useEditorRefs } from "./state/context";
import { EditorErrorBoundary } from "./components/ErrorBoundary";
import { Toolbar } from "./components/Toolbar";
import { FindReplaceBar } from "./components/FindReplaceBar";
import { GoToLineBar } from "./components/GoToLineBar";
import { VirtualizedGutter } from "./components/VirtualizedGutter";
import { VirtualizedSyntaxOverlay } from "./components/VirtualizedSyntaxOverlay";
import { ContextMenu } from "./components/ContextMenu";
import { CommandPalette } from "./components/CommandPalette";
import { Minimap } from "./components/Minimap";
import { StatusBar } from "./components/StatusBar";
import { ThemeSelector } from "./components/ThemeSelector";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { useTheme } from "./hooks/useTheme";
import { useEditor } from "./hooks/useEditor";
import { useKeybindings } from "./hooks/useKeybindings";
import { useContentProvider } from "./hooks/useContentProvider";
import { FormatterRegistry } from "./formatters";
import { debounce } from "./core/utils";
import "./styles/editor.css";
import "./styles/tokens.css";
import type { BuiltInThemeId } from "./themes/defaults";

// ── Plugin system ────────────────────────────────────────────
import type { ExtendedEditorPlugin } from "./plugins/types";
import { usePluginHost } from "./plugins/usePluginHost";
import { CompletionWidget } from "./plugins/components/CompletionWidget";
import { CodeLensOverlay } from "./plugins/components/CodeLensOverlay";
import { InlineAnnotationsOverlay } from "./plugins/components/InlineAnnotationsOverlay";
import { DiagnosticsOverlay } from "./plugins/components/DiagnosticsOverlay";
import { PluginStatusBar } from "./plugins/components/PluginStatusBar";
import { PluginPanelRenderer } from "./plugins/components/PluginPanelRenderer";
import { GhostTextOverlay } from "./plugins/components/GhostTextOverlay";
import { FoldingOverlay } from "./plugins/components/FoldingOverlay";
import { SplitPane } from "./plugins/components/SplitPane";
import { PluginManagerPopover } from "./plugins/components/PluginManagerPopover";

// ── Terminal panel ───────────────────────────────────────────
import { TerminalPanel } from "./terminal/TerminalPanel";
import { useTerminalPanelStore } from "./terminal/store";
import { editorThemeToXterm } from "./terminal/themeAdapter";
import { ThemeManager } from "./themes/manager";

// ═══════════════════════════════════════════════════════════════
//  Public props
// ═══════════════════════════════════════════════════════════════

export interface FileEditorProps {
    /** SSH/SFTP session identifier */
    sessionId: string;
    /** Remote file path */
    remotePath: string;
    /** Content provider implementation (API, Socket, or custom) */
    provider: ContentProvider;
    /** Initial theme ID (defaults to "dracula") */
    themeId?: BuiltInThemeId | (string & {});
    /** Start in read-only mode */
    readOnly?: boolean;
    /** Show minimap on mount */
    showMinimap?: boolean;
    /** Enable word wrap on mount */
    wordWrap?: boolean;
    /** Initial font size */
    fontSize?: number;
    /** CSS class to apply to the editor root */
    className?: string;
    /** Inline styles on the editor root */
    style?: CSSProperties;
    /** Optional plugins to register with the editor */
    plugins?: ExtendedEditorPlugin[];

    // ── Terminal panel (optional) ────────────────────────────
    /** Socket.IO URL for the embedded terminal. If omitted the terminal button/panel are hidden. */
    terminalSocketUrl?: string;
    /** Working directory sent to the terminal backend (defaults to dirname of remotePath) */
    terminalCwd?: string;
    /** Custom event names for the terminal socket */
    terminalEvents?: import("./terminal/XtermTerminal").TerminalEvents;
    /** Font size for the terminal (default 14) */
    terminalFontSize?: number;
}

// ═══════════════════════════════════════════════════════════════
//  Outer wrapper – provides the EditorProvider
// ═══════════════════════════════════════════════════════════════

export function FileEditor(props: FileEditorProps) {
    return (
        <EditorProvider
            initialState={{
                activeThemeId: props.themeId ?? "dracula",
                readOnly: props.readOnly ?? false,
                showMinimap: props.showMinimap ?? false,
                wordWrap: props.wordWrap ?? true,
                fontSize: props.fontSize ?? 13,
            }}
        >
            <EditorErrorBoundary>
                <EditorInner {...props} />
            </EditorErrorBoundary>
        </EditorProvider>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Inner component – has access to EditorProvider context
// ═══════════════════════════════════════════════════════════════

function EditorInner(props: FileEditorProps) {
    const storeApi = useEditorStoreApi();
    const refs = useEditorRefs();
    const editor = useEditor();

    // ── Content provider ─────────────────────────────────────
    const { save, reload } = useContentProvider({
        provider: props.provider,
        sessionId: props.sessionId,
        remotePath: props.remotePath,
    });

    // ── Theme application ────────────────────────────────────
    useTheme();

    // ── Plugin system ────────────────────────────────────────
    const { host: pluginHost, snapshot: pluginSnapshot } = usePluginHost(
        props.plugins ?? [],
    );
 
    // ── Format callback ──────────────────────────────────────
    const fileName = useEditorStore((s) => s.fileName);
    const language = useEditorStore((s) => s.language);
    const loading = useEditorStore((s) => s.loading);
    const error = useEditorStore((s) => s.error);
    const content = useEditorStore((s) => s.content);
    const readOnly = useEditorStore((s) => s.readOnly);
    const wordWrap = useEditorStore((s) => s.wordWrap);
    const fontSize = useEditorStore((s) => s.fontSize);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const tabSize = useEditorStore((s) => s.tabSize);
    const ctxMenu = useEditorStore((s) => s.ctxMenu);
    const setCtxMenu = useEditorStore((s) => s.setCtxMenu);
    const pushChange = useEditorStore((s) => s.pushChange);
    const setError = useEditorStore((s) => s.setError);
    const showWhitespace = useEditorStore((s) => s.showWhitespace);
    const autoSave = useEditorStore((s) => s.autoSave);
    const autoSaveDelay = useEditorStore((s) => s.autoSaveDelay);
    const modified = useEditorStore((s) => s.modified);
    const cursorLine = useEditorStore((s) => s.cursorLine);
    const splitView = useEditorStore((s) => s.splitView);

    // ── Terminal panel ───────────────────────────────────────
    const terminalToggle = useTerminalPanelStore((s) => s.toggle);
    const terminalOpen = useTerminalPanelStore((s) => s.open);
    const hasTerminal = !!props.terminalSocketUrl;
    const terminalCwd = props?.terminalCwd ?? (props?.remotePath?.replace(/\/[^/]*$/, "") || "/");

    // Derive xterm-compatible theme from the active editor theme
    const activeThemeId = useEditorStore((s) => s.activeThemeId);
    const terminalTheme = useMemo(() => {
        const mgr = ThemeManager.getInstance();
        const editorTheme = mgr.get(activeThemeId) ?? mgr.getActive();
        return editorThemeToXterm(editorTheme);
    }, [activeThemeId]);

    // ── Drag & Drop state ────────────────────────────────────
    const [isDragging, setIsDragging] = useState(false);
    const dragCountRef = useRef(0);

    // ── Plugin manager sheet state ─────────────────────────
    const [showPluginManager, setShowPluginManager] = useState(false);
    const togglePluginManager = useCallback(() => setShowPluginManager((v) => !v), []);
    const closePluginManager = useCallback(() => setShowPluginManager(false), []);

    const onFormat = useCallback(() => {
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
        const result = FormatterRegistry.format(ext, content);
        if (result) {
            if (result.error) {
                setError(result.error);
            } else {
                editor.setContent(result.formatted);
            }
        }
    }, [fileName, content, editor, setError]);

    // ── Keybindings ──────────────────────────────────────────
    useKeybindings({ onSave: save, onFormat });

    // ── Combined textarea keydown: plugin keybindings → editor keys ─
    const handleTextareaKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Let plugin keybindings run first (ghost-text accept/dismiss, etc.)
            if (pluginHost.handleKeyEvent(e.nativeEvent)) return;
            // Then fall through to editor handlers (snippets, auto-close, indent)
            editor.handleTextareaKeyDown(e);
        },
        [pluginHost, editor],
    );

    // ── Dispatch save events to plugin host ───────────────────
    const origSave = save;
    const saveWithPluginNotify = useCallback(async () => {
        const result = await origSave();
        pluginHost.dispatchSave();
        return result;
    }, [origSave, pluginHost]);

    // ── Auto-save with debounce ──────────────────────────────
    const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null);

    useEffect(() => {
        if (!autoSave) {
            debouncedSaveRef.current?.cancel?.();
            return;
        }
        debouncedSaveRef.current = debounce(() => {
            const s = storeApi.getState();
            if (s.modified && !s.saving && !s.readOnly) {
                save();
            }
        }, autoSaveDelay);

        return () => {
            debouncedSaveRef.current?.cancel?.();
        };
    }, [autoSave, autoSaveDelay, save, storeApi]);

    // Trigger debounced save when content changes
    useEffect(() => {
        if (autoSave && modified && !readOnly) {
            debouncedSaveRef.current?.();
        }
    }, [content, autoSave, modified, readOnly]);

    // ── Ctrl+Mouse Wheel Zoom ────────────────────────────────
    useEffect(() => {
        const wrapperEl = refs.editorWrapperRef.current;
        if (!wrapperEl) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const s = storeApi.getState();
                if (e.deltaY < 0) s.zoomIn();
                else s.zoomOut();
            }
        };
        wrapperEl.addEventListener("wheel", handleWheel, { passive: false });
        return () => wrapperEl.removeEventListener("wheel", handleWheel);
    }, [refs.editorWrapperRef, storeApi]);

    // ── Drag & Drop file support ─────────────────────────────
    const onDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCountRef.current++;
        if (e.dataTransfer.types.includes("Files")) {
            setIsDragging(true);
        }
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCountRef.current--;
        if (dragCountRef.current <= 0) {
            dragCountRef.current = 0;
            setIsDragging(false);
        }
    }, []);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = readOnly ? "none" : "copy";
    }, [readOnly]);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCountRef.current = 0;
        if (readOnly) return;
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        // Only accept text files (< 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError("File too large (max 5MB)");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            editor.setContent(text);
        };
        reader.onerror = () => setError("Failed to read dropped file");
        reader.readAsText(file);
    }, [readOnly, editor, setError]);

    // ── Active line highlight position ───────────────────────
    const activeLineTop = useMemo(() => {
        return (cursorLine - 1) * lineHeight + 10; // 10px = padding
    }, [cursorLine, lineHeight]);

    // ── Textarea input handler ───────────────────────────────
    const onTextareaInput = useCallback(
        (e: React.FormEvent<HTMLTextAreaElement>) => {
            pushChange((e.target as HTMLTextAreaElement).value);
        },
        [pushChange],
    );

    // ── Scroll sync ──────────────────────────────────────────
    const onScroll = useCallback(() => {
        const ta = refs.textareaRef.current;
        const hi = refs.highlightRef.current;
        const gt = refs.gutterRef.current;
        if (!ta) return;
        if (hi) { hi.scrollTop = ta.scrollTop; hi.scrollLeft = ta.scrollLeft; }
        if (gt) { gt.scrollTop = ta.scrollTop; }
    }, [refs]);

    // ── Context menu ─────────────────────────────────────────
    const onContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY });
        },
        [setCtxMenu],
    );

    // ── Whitespace rendering ─────────────────────────────────
    const whitespaceHtml = useMemo(() => {
        if (!showWhitespace) return null;
        return content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/ /g, '<span class="ws-space">·</span>')
            .replace(/\t/g, '<span class="ws-tab">→</span>');
    }, [showWhitespace, content]);

    // ── Loading / Error states ───────────────────────────────
    if (loading) {
        return (
            <div
                className="editor-root flex items-center justify-center"
                style={{ height: "100%", background: "var(--editor-background)", color: "var(--editor-foreground)" }}
            >
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--editor-accent)", borderTopColor: "transparent" }} />
                    <span className="text-sm" style={{ color: "var(--editor-muted)" }}>Loading file…</span>
                </div>
            </div>
        );
    }

    if (error && !content) {
        return (
            <div
                className="editor-root flex items-center justify-center"
                style={{ height: "100%", background: "var(--editor-background)", color: "var(--editor-error)" }}
            >
                <div className="flex flex-col items-center gap-3 max-w-md text-center">
                    <span className="text-lg font-semibold">Error</span>
                    <span className="text-sm" style={{ color: "var(--editor-muted)" }}>{error}</span>
                    <button
                        onClick={reload}
                        className="px-4 py-1.5 rounded text-sm"
                        style={{ background: "var(--editor-accent)", color: "#fff", border: "none", cursor: "pointer" }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // ── Main render ──────────────────────────────────────────
    return (
        <div
            ref={refs.editorWrapperRef}
            className={`editor-root flex flex-col ${props.className ?? ""}`}
            style={{
                height: "100%",
                width: "100%",
                minHeight: 0,
                minWidth: 0,
                maxHeight: "100%",
                maxWidth: "100%",
                background: "var(--editor-background)",
                color: "var(--editor-foreground)",
                fontFamily: "var(--editor-font-family)",
                overflow: "hidden",
                contain: "layout paint style",
                ...props.style,
            }}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            {/* Drag & Drop overlay */}
            {isDragging && (
                <div className="editor-drop-overlay">
                    <div className="flex flex-col items-center gap-2" style={{ color: "var(--editor-accent)" }}>
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm font-medium">Drop file to open</span>
                    </div>
                </div>
            )}
            {/* Toolbar + Plugin Manager Button */}
            <div className="flex items-center shrink-0">
                <div className="flex-1 min-w-0">
                    <Toolbar
                        fileName={fileName}
                        onSave={saveWithPluginNotify}
                        onReload={reload}
                        onFormat={onFormat}
                    />
                </div>
                {/* Plugin manager toggle */}
                <button
                    onClick={togglePluginManager}
                    title="Manage Plugins"
                    className={`relative flex items-center justify-center w-7 h-7 rounded-md border-none cursor-pointer mr-2 transition-colors duration-150 ${
                        showPluginManager
                            ? "bg-[var(--editor-popup-hover-bg)] text-[var(--editor-accent)]"
                            : "bg-transparent text-[var(--editor-muted)] hover:bg-[var(--editor-popup-hover-bg)]"
                    }`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                    </svg>
                    <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--editor-accent,#bd93f9)] text-white text-[8px] font-bold flex items-center justify-center leading-none">
                        {pluginSnapshot.enabledPlugins.size}
                    </span>
                </button>
            </div>

            {/* Find / Replace */}
            <FindReplaceBar />

            {/* Go to Line */}
            <GoToLineBar />

            {/* Error toast (non-blocking) */}
            {error && content && (
                <div
                    className="px-3 py-1.5 text-[12px] flex items-center justify-between"
                    style={{ background: "var(--editor-error)", color: "#fff" }}
                >
                    <span>{error}</span>
                    <button
                        onClick={() => setError(null)}
                        style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 12 }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Editor body */}
            <div className="flex flex-1 min-h-0 overflow-hidden relative">
                <SplitPane
                    direction="horizontal"
                    splitActive={splitView}
                    primary={
                        /* Gutter + Code area (primary pane) */
                        <div className="flex flex-1 min-w-0 overflow-hidden relative" style={{ width: "100%", height: "100%" }}>
                            <VirtualizedGutter />
                            <div className="relative flex-1 min-w-0 overflow-hidden">
                                <VirtualizedSyntaxOverlay />

                                {/* Plugin overlays */}
                                <CodeLensOverlay codeLenses={pluginSnapshot.codeLenses} />
                                <InlineAnnotationsOverlay annotations={pluginSnapshot.inlineAnnotations} />
                                <DiagnosticsOverlay diagnostics={pluginSnapshot.diagnostics} />
                                <FoldingOverlay foldingRanges={pluginSnapshot.foldingRanges} />
                                <GhostTextOverlay />
                                {/* Whitespace visibility overlay */}
                                {showWhitespace && whitespaceHtml && (
                                    <pre
                                        className="editor-whitespace-overlay absolute inset-0 pointer-events-none overflow-hidden"
                                        style={{
                                            padding: 10,
                                            fontSize,
                                            fontFamily: "var(--editor-font-family)",
                                            fontWeight: "var(--editor-font-weight)" as unknown as number,
                                            lineHeight: `${lineHeight}px`,
                                            whiteSpace: wordWrap ? "pre-wrap" : "pre",
                                            overflowWrap: wordWrap ? "break-word" : "normal",
                                            tabSize,
                                            color: "transparent",
                                            zIndex: 1,
                                            margin: 0,
                                        }}
                                        dangerouslySetInnerHTML={{ __html: whitespaceHtml }}
                                    />
                                )}
                                <textarea
                                    ref={refs.textareaRef}
                                    value={content}
                                    onInput={onTextareaInput}
                                    onScroll={onScroll}
                                    onContextMenu={onContextMenu}
                                    onKeyDown={handleTextareaKeyDown}
                                    onClick={editor.syncCursor}
                                    onKeyUp={editor.syncCursor}
                                    readOnly={readOnly}
                                    spellCheck={false}
                                    autoCapitalize="off"
                                    autoCorrect="off"
                                    className="editor-textarea absolute inset-0 w-full h-full resize-none outline-none"
                                    style={{
                                        padding: 10,
                                        fontSize,
                                        fontFamily: "var(--editor-font-family)",
                                        fontWeight: "var(--editor-font-weight)" as unknown as number,
                                        lineHeight: `${lineHeight}px`,
                                        color: "transparent",
                                        caretColor: "var(--editor-cursor)",
                                        background: "transparent",
                                        whiteSpace: wordWrap ? "pre-wrap" : "pre",
                                        overflowWrap: wordWrap ? "break-word" : "normal",
                                        tabSize,
                                        overflow: "auto",
                                        zIndex: 2,
                                    }}
                                />
                            </div>
                        </div>
                    }
                    secondary={
                        /* Split view secondary pane – read-only preview */
                        <div
                            className="flex flex-1 min-w-0 overflow-hidden relative"
                            style={{
                                width: "100%",
                                height: "100%",
                                borderLeft: "1px solid var(--editor-border, #44475a)",
                            }}
                        >
                            <div className="relative flex-1 min-w-0 overflow-auto" style={{ padding: 10 }}>
                                {/* Split pane header */}
                                <div
                                    className="sticky top-0 z-10 flex items-center justify-between px-2 py-1 mb-1 rounded"
                                    style={{
                                        background: "var(--editor-popup-bg, #282a36)",
                                        borderBottom: "1px solid var(--editor-border, #44475a)",
                                        fontSize: 11,
                                        color: "var(--editor-muted, #6272a4)",
                                    }}
                                >
                                    <span>{fileName} (read-only preview)</span>
                                    <button
                                        onClick={() => storeApi.getState().setSplitView(false)}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            color: "var(--editor-muted)",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            padding: "0 4px",
                                        }}
                                        title="Close split view"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <pre
                                    style={{
                                        margin: 0,
                                        fontSize,
                                        fontFamily: "var(--editor-font-family)",
                                        fontWeight: "var(--editor-font-weight)" as unknown as number,
                                        lineHeight: `${lineHeight}px`,
                                        whiteSpace: wordWrap ? "pre-wrap" : "pre",
                                        overflowWrap: wordWrap ? "break-word" : "normal",
                                        tabSize,
                                        color: "var(--editor-foreground)",
                                    }}
                                >
                                    {content}
                                </pre>
                            </div>
                        </div>
                    }
                />

                {/* Minimap */}
                <Minimap />

                {/* Theme Selector panel */}
                <ThemeSelector />

                {/* Plugin side panels */}
                <PluginPanelRenderer host={pluginHost} snapshot={pluginSnapshot} position="right" />

                {/* Plugin Manager (overlays inside editor body) */}
                <PluginManagerPopover
                    host={pluginHost}
                    snapshot={pluginSnapshot}
                    open={showPluginManager}
                    onClose={closePluginManager}
                />
            </div>

            {/* Plugin bottom panels */}
            <PluginPanelRenderer host={pluginHost} snapshot={pluginSnapshot} position="bottom" />

            {/* Embedded Terminal Panel */}
            {hasTerminal && (
                <TerminalPanel
                    socketUrl={props.terminalSocketUrl!}
                    sessionId={props.sessionId}
                    cwd={terminalCwd}
                    events={props.terminalEvents}
                    fontSize={props.terminalFontSize}
                    theme={terminalTheme}
                />
            )}

            {/* Status Bar */}
            <div className="flex items-center">
                <div className="flex-1">
                    <StatusBar language={language} />
                </div>
                {/* Terminal toggle in status bar */}
                {hasTerminal && (
                    <button
                        onClick={terminalToggle}
                        title="Toggle Terminal (Ctrl+`)"
                        className="flex items-center gap-1 px-2 transition-colors"
                        style={{
                            height: 24,
                            border: "none",
                            cursor: "pointer",
                            background: terminalOpen ? "var(--editor-popup-hover-bg)" : "transparent",
                            color: terminalOpen ? "var(--editor-accent)" : "var(--editor-muted)",
                            fontSize: 11,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--editor-popup-hover-bg)";
                        }}
                        onMouseLeave={(e) => {
                            if (!terminalOpen) e.currentTarget.style.background = "transparent";
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="4 17 10 11 4 5" />
                            <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        Terminal
                    </button>
                )}
                <PluginStatusBar snapshot={pluginSnapshot} onTogglePluginManager={togglePluginManager} />
            </div>

            {/* Completion Widget (floating) */}
            <CompletionWidget host={pluginHost} snapshot={pluginSnapshot} />

            {/* Context Menu (VS Code-style with 22+ items) */}
            <ContextMenu onSave={save} onFormat={onFormat} />

            {/* Command Palette */}
            <CommandPalette onSave={save} onReload={reload} onFormat={onFormat} />

            {/* Shortcuts Modal */}
            <ShortcutsModal />
        </div>
    );
}

export default FileEditor;
