/**
 * @module editor/FileEditor
 *
 * Main composition component for the modular file editor.
 * Wires together:
 *   EditorProvider → ErrorBoundary → Toolbar → FindBar → GoToLine →
 *   EditorBody (Gutter + Overlay + Textarea + Minimap) → StatusBar →
 *   ThemeSelector (side panel) → ShortcutsModal (overlay)
 *
 * Usage:
 *   <FileEditor
 *     sessionId="abc123"
 *     remotePath="/etc/nginx/nginx.conf"
 *     provider={new ApiContentProvider()}
 *   />
 */
import { useCallback, useEffect, useMemo, type CSSProperties } from "react";
import type { ContentProvider, ContextMenuItem } from "./types";
import { EditorProvider, useEditorStore, useEditorStoreApi, useEditorRefs } from "./state/context";
import { EditorErrorBoundary } from "./components/ErrorBoundary";
import { Toolbar } from "./components/Toolbar";
import { FindReplaceBar } from "./components/FindReplaceBar";
import { GoToLineBar } from "./components/GoToLineBar";
import { EditorGutter } from "./components/EditorGutter";
import { SyntaxOverlay } from "./components/SyntaxOverlay";
import { ContextMenu } from "./components/ContextMenu";
import { Minimap } from "./components/Minimap";
import { StatusBar } from "./components/StatusBar";
import { ThemeSelector } from "./components/ThemeSelector";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { useTheme } from "./hooks/useTheme";
import { useEditor } from "./hooks/useEditor";
import { useKeybindings } from "./hooks/useKeybindings";
import { useContentProvider } from "./hooks/useContentProvider";
import { FormatterRegistry } from "./formatters";
import { clipboardWrite, clipboardRead } from "./core/utils";
import { cursorToLineCol } from "./core/text-ops";
import "./styles/editor.css";
import "./styles/tokens.css";

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
    themeId?: string;
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
    const ctxMenu = useEditorStore((s) => s.ctxMenu);
    const setCtxMenu = useEditorStore((s) => s.setCtxMenu);
    const pushChange = useEditorStore((s) => s.pushChange);
    const setError = useEditorStore((s) => s.setError);

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

    const ctxMenuItems: ContextMenuItem[] = useMemo(
        () => [
            { label: "Cut", shortcut: "Ctrl+X", action: () => { const ta = refs.textareaRef.current; if (ta) { clipboardWrite(ta.value.slice(ta.selectionStart, ta.selectionEnd)); const before = ta.value.slice(0, ta.selectionStart); const after = ta.value.slice(ta.selectionEnd); pushChange(before + after); } }, disabled: readOnly },
            { label: "Copy", shortcut: "Ctrl+C", action: () => { const ta = refs.textareaRef.current; if (ta) clipboardWrite(ta.value.slice(ta.selectionStart, ta.selectionEnd)); } },
            { label: "Paste", shortcut: "Ctrl+V", action: async () => { const ta = refs.textareaRef.current; if (ta && !readOnly) { const text = await clipboardRead(); const before = ta.value.slice(0, ta.selectionStart); const after = ta.value.slice(ta.selectionEnd); pushChange(before + text + after); } }, disabled: readOnly },
            { label: "---", separator: true, action: () => {} },
            { label: "Select All", shortcut: "Ctrl+A", action: () => { refs.textareaRef.current?.select(); } },
            { label: "---", separator: true, action: () => {} },
            { label: "Find", shortcut: "Ctrl+F", action: () => storeApi.getState().openFind() },
            { label: "Go to Line", shortcut: "Ctrl+G", action: () => storeApi.getState().openGoToLine() },
            { label: "Format Document", shortcut: "Ctrl+Shift+F", action: onFormat },
        ],
        [readOnly, refs, pushChange, storeApi, onFormat],
    );

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
                background: "var(--editor-background)",
                color: "var(--editor-foreground)",
                fontFamily: "var(--editor-font-family)",
                overflow: "hidden",
                ...props.style,
            }}
        >
            {/* Toolbar */}
            <Toolbar
                fileName={fileName}
                onSave={save}
                onReload={reload}
                onFormat={onFormat}
            />

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
            <div className="flex flex-1 overflow-hidden">
                {/* Gutter + Code area */}
                <div className="flex flex-1 overflow-hidden relative">
                    <EditorGutter />
                    <div className="relative flex-1 overflow-hidden">
                        <SyntaxOverlay />
                        <textarea
                            ref={refs.textareaRef}
                            value={content}
                            onInput={onTextareaInput}
                            onScroll={onScroll}
                            onContextMenu={onContextMenu}
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
                                tabSize: 2,
                                overflow: "auto",
                                zIndex: 2,
                            }}
                        />
                    </div>
                </div>

                {/* Minimap */}
                <Minimap />

                {/* Theme Selector panel */}
                <ThemeSelector />
            </div>

            {/* Status Bar */}
            <StatusBar language={language} />

            {/* Context Menu */}
            {ctxMenu && (
                <ContextMenu items={ctxMenuItems} />
            )}

            {/* Shortcuts Modal */}
            <ShortcutsModal />
        </div>
    );
}

export default FileEditor;
