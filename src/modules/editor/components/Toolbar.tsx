/**
 * @module editor/components/Toolbar
 * Top toolbar with file info, actions, and view toggles.
 */
import { memo, useCallback } from "react";
import {
    Search, Replace, ArrowDown01, RotateCcw, WrapText, Palette,
    Map, ZoomIn, ZoomOut, BookLock, Info, Save, Undo2, Redo2,
    AlignLeft, Keyboard,
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { useEditorStore, useEditorRefs } from "../state/context";

/** Tiny toolbar button */
const TB = memo(function TB(props: {
    icon: React.ReactNode; title: string; onClick: () => void;
    active?: boolean; disabled?: boolean;
}) {
    return (
        <button
            onClick={props.onClick}
            disabled={props.disabled}
            title={props.title}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
                width: 28, height: 28, border: "none", cursor: props.disabled ? "default" : "pointer",
                background: props.active ? "var(--editor-popup-hover-bg)" : "transparent",
                color: props.active ? "var(--editor-accent)" : "var(--editor-muted)",
                opacity: props.disabled ? 0.4 : 1,
            }}
            onMouseEnter={(e) => { if (!props.disabled) e.currentTarget.style.background = "var(--editor-popup-hover-bg)"; }}
            onMouseLeave={(e) => { if (!props.active) e.currentTarget.style.background = "transparent"; }}
        >
            {props.icon}
        </button>
    );
});

export const Toolbar = memo(function Toolbar(props: {
    fileName: string;
    onSave: () => void;
    onReload?: () => void;
    onFormat?: () => void;
}) {
    const isSaving = useEditorStore((s) => s.saving);
    const isDirty = useEditorStore((s) => s.modified);
    const readOnly = useEditorStore((s) => s.readOnly);
    const wordWrap = useEditorStore((s) => s.wordWrap);
    const showMinimap = useEditorStore((s) => s.showMinimap);
    const showFind = useEditorStore((s) => s.showFind);
    const showGoToLine = useEditorStore((s) => s.showGoToLine);
    const showThemeSelector = useEditorStore((s) => s.showThemeSelector);
    const showShortcuts = useEditorStore((s) => s.showShortcuts);
    const toggleThemeSelectorFn = useEditorStore((s) =>
        s.showThemeSelector ? s.closeThemeSelector : s.openThemeSelector
    );
    const canUndo = useEditorStore((s) => s.undoStack.length > 0);
    const canRedo = useEditorStore((s) => s.redoStack.length > 0);

    const openFind = useEditorStore((s) => s.openFind);
    const openGoToLine = useEditorStore((s) => s.openGoToLine);
    const toggleWordWrap = useEditorStore((s) => s.toggleWordWrap);
    const toggleMinimap = useEditorStore((s) => s.toggleMinimap);
    const toggleReadOnly = useEditorStore((s) => s.toggleReadOnly);

    const openShortcuts = useEditorStore((s) => s.openShortcuts);
    const zoomIn = useEditorStore((s) => s.zoomIn);
    const zoomOut = useEditorStore((s) => s.zoomOut);
    const undo = useEditorStore((s) => s.undo);
    const redo = useEditorStore((s) => s.redo);
    const { textareaRef } = useEditorRefs();

    const handleUndo = useCallback(() => { undo(); textareaRef.current?.focus(); }, [undo, textareaRef]);
    const handleRedo = useCallback(() => { redo(); textareaRef.current?.focus(); }, [redo, textareaRef]);

    const sz = "w-3.5 h-3.5";

    return (
        <div
            className="flex items-center gap-1 px-3 py-1.5 select-none"
            style={{
                background: "var(--editor-toolbar-bg)",
                borderBottom: "1px solid var(--editor-border)",
            }}
        >
            {/* File info */}
            <FileIcon fileName={props.fileName} />
            <span
                className="text-[12px] font-medium truncate max-w-[200px]"
                style={{ color: "var(--editor-foreground)" }}
                title={props.fileName}
            >
                {props.fileName}
            </span>
            {isDirty && (
                <span
                    className="ml-1 w-2 h-2 rounded-full shrink-0"
                    style={{ background: "var(--editor-accent)" }}
                    title="Unsaved changes"
                />
            )}

            {/* Separator */}
            <div className="mx-2 h-4 w-px" style={{ background: "var(--editor-border)" }} />

            {/* Undo / Redo */}
            <TB icon={<Undo2 className={sz} />} title="Undo (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo} />
            <TB icon={<Redo2 className={sz} />} title="Redo (Ctrl+Y)" onClick={handleRedo} disabled={!canRedo} />

            <div className="mx-1 h-4 w-px" style={{ background: "var(--editor-border)" }} />

            {/* Actions */}
            <TB icon={<Search className={sz} />} title="Find (Ctrl+F)" onClick={openFind} active={showFind} />
            <TB icon={<Replace className={sz} />} title="Find & Replace (Ctrl+H)" onClick={openFind} />
            <TB icon={<ArrowDown01 className={sz} />} title="Go to Line (Ctrl+G)" onClick={openGoToLine} active={showGoToLine} />
            {props.onFormat && (
                <TB icon={<AlignLeft className={sz} />} title="Format (Ctrl+Shift+F)" onClick={props.onFormat} />
            )}
            {props.onReload && (
                <TB icon={<RotateCcw className={sz} />} title="Reload file" onClick={props.onReload} />
            )}

            <div className="mx-1 h-4 w-px" style={{ background: "var(--editor-border)" }} />

            {/* View toggles */}
            <TB icon={<WrapText className={sz} />} title="Word wrap (Alt+Z)" onClick={toggleWordWrap} active={wordWrap} />
            <TB icon={<Palette className={sz} />} title="Theme" onClick={toggleThemeSelectorFn} active={showThemeSelector} />
            <TB icon={<Map className={sz} />} title="Minimap (Ctrl+M)" onClick={toggleMinimap} active={showMinimap} />
            <TB icon={<ZoomIn className={sz} />} title="Zoom in (Ctrl+=)" onClick={zoomIn} />
            <TB icon={<ZoomOut className={sz} />} title="Zoom out (Ctrl+-)" onClick={zoomOut} />
            <TB icon={<BookLock className={sz} />} title="Read only" onClick={toggleReadOnly} active={readOnly} />
            <TB icon={<Keyboard className={sz} />} title="Shortcuts" onClick={openShortcuts} active={showShortcuts} />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Save */}
            <button
                onClick={props.onSave}
                disabled={isSaving || !isDirty}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1 rounded-md transition-colors"
                style={{
                    background: isDirty ? "var(--editor-accent)" : "var(--editor-popup-hover-bg)",
                    color: isDirty ? "#fff" : "var(--editor-muted)",
                    border: "none",
                    cursor: isSaving || !isDirty ? "default" : "pointer",
                    opacity: isSaving ? 0.6 : 1,
                }}
            >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "Saving…" : "Save"}
            </button>
        </div>
    );
});
