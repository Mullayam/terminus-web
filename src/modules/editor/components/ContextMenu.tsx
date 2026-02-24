/**
 * @module editor/components/ContextMenu
 * 
 * VS Code-style context menu with 22+ items, Lucide icons, keyboard shortcuts,
 * overflow-safe positioning, and selection-dependent disabled states.
 */
import { useLayoutEffect, useEffect, memo, useMemo } from "react";
import {
    Undo2, Redo2, Scissors, Copy, ClipboardPaste, TextSelect,
    Indent, Outdent, RemoveFormatting, ArrowUp, ArrowDown,
    MessageSquareCode, ArrowUpDown, CaseUpper, CaseLower,
    Braces, Search, Replace, Hash, Save, Terminal,
    CopyPlus, Columns2,
} from "lucide-react";
import { useEditorStore, useEditorStoreApi, useEditorRefs } from "../state/context";
import { useEditor } from "../hooks/useEditor";
import { clipboardWrite, clipboardRead } from "../core/utils";
import type { ContextMenuItem } from "../types";

interface ContextMenuProps {
    onSave: () => void;
    onFormat?: () => void;
}

export const ContextMenu = memo(function ContextMenu({ onSave, onFormat }: ContextMenuProps) {
    const ctxMenu = useEditorStore((s) => s.ctxMenu);
    const setCtxMenu = useEditorStore((s) => s.setCtxMenu);
    const readOnly = useEditorStore((s) => s.readOnly);
    const modified = useEditorStore((s) => s.modified);
    const undoStack = useEditorStore((s) => s.undoStack);
    const redoStack = useEditorStore((s) => s.redoStack);
    const content = useEditorStore((s) => s.content);
    const language = useEditorStore((s) => s.language);
    const storeApi = useEditorStoreApi();
    const { ctxMenuRef, editorWrapperRef, textareaRef } = useEditorRefs();
    const editor = useEditor();

    // Check if there's a text selection
    const hasSelection = useMemo(() => {
        const ta = textareaRef.current;
        return ta ? ta.selectionStart !== ta.selectionEnd : false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctxMenu, textareaRef]);

    // Close on click outside / Escape / Scroll
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
    }, [ctxMenu, setCtxMenu]);

    // Reposition if menu overflows wrapper boundaries
    useLayoutEffect(() => {
        if (!ctxMenu || !ctxMenuRef.current || !editorWrapperRef.current) return;
        const menuEl = ctxMenuRef.current;
        const wrapperRect = editorWrapperRef.current.getBoundingClientRect();
        const menuRect = menuEl.getBoundingClientRect();
        let x = ctxMenu.x - wrapperRect.left;
        let y = ctxMenu.y - wrapperRect.top;
        if (y + menuRect.height > wrapperRect.height) {
            y = Math.max(4, wrapperRect.height - menuRect.height - 4);
        }
        if (x + menuRect.width > wrapperRect.width) {
            x = Math.max(4, wrapperRect.width - menuRect.width - 4);
        }
        menuEl.style.left = `${x}px`;
        menuEl.style.top = `${y}px`;
    }, [ctxMenu, ctxMenuRef, editorWrapperRef]);

    if (!ctxMenu) return null;

    const ctxAction = (fn: () => void) => {
        fn();
        setCtxMenu(null);
        textareaRef.current?.focus();
    };

    const iconSize = "w-3.5 h-3.5";
    const s = storeApi.getState();

    const items: ContextMenuItem[] = [
        // Undo / Redo
        {
            label: "Undo",
            icon: <Undo2 className={iconSize} />,
            shortcut: "Ctrl+Z",
            action: () => s.undo(),
            disabled: undoStack.length === 0 || readOnly,
        },
        {
            label: "Redo",
            icon: <Redo2 className={iconSize} />,
            shortcut: "Ctrl+Shift+Z",
            action: () => s.redo(),
            disabled: redoStack.length === 0 || readOnly,
            separator: true,
        },
        // Clipboard
        {
            label: "Cut",
            icon: <Scissors className={iconSize} />,
            shortcut: "Ctrl+X",
            action: () => {
                const ta = textareaRef.current;
                if (ta && ta.selectionStart !== ta.selectionEnd) {
                    clipboardWrite(ta.value.slice(ta.selectionStart, ta.selectionEnd));
                    const before = ta.value.slice(0, ta.selectionStart);
                    const after = ta.value.slice(ta.selectionEnd);
                    s.pushChange(before + after);
                }
            },
            disabled: readOnly || !hasSelection,
        },
        {
            label: "Copy",
            icon: <Copy className={iconSize} />,
            shortcut: "Ctrl+C",
            action: () => {
                const ta = textareaRef.current;
                if (ta) clipboardWrite(ta.value.slice(ta.selectionStart, ta.selectionEnd));
            },
            disabled: !hasSelection,
        },
        {
            label: "Paste",
            icon: <ClipboardPaste className={iconSize} />,
            shortcut: "Ctrl+V",
            action: async () => {
                const ta = textareaRef.current;
                if (ta && !readOnly) {
                    const text = await clipboardRead();
                    const before = ta.value.slice(0, ta.selectionStart);
                    const after = ta.value.slice(ta.selectionEnd);
                    s.pushChange(before + text + after);
                }
            },
            disabled: readOnly,
        },
        {
            label: "Select All",
            icon: <TextSelect className={iconSize} />,
            shortcut: "Ctrl+A",
            action: () => textareaRef.current?.select(),
            separator: true,
        },
        // Indentation
        {
            label: "Indent",
            icon: <Indent className={iconSize} />,
            shortcut: "Tab",
            action: () => editor.indent(),
            disabled: readOnly,
        },
        {
            label: "Outdent",
            icon: <Outdent className={iconSize} />,
            shortcut: "Shift+Tab",
            action: () => editor.outdent(),
            disabled: readOnly,
            separator: true,
        },
        // Line operations
        {
            label: "Delete Line",
            icon: <RemoveFormatting className={iconSize} />,
            shortcut: "Ctrl+Shift+K",
            action: () => editor.deleteLine(),
            disabled: readOnly,
        },
        {
            label: "Duplicate Line",
            icon: <CopyPlus className={iconSize} />,
            shortcut: "Ctrl+D",
            action: () => editor.duplicateLine(),
            disabled: readOnly,
        },
        {
            label: "Move Line Up",
            icon: <ArrowUp className={iconSize} />,
            shortcut: "Alt+\u2191",
            action: () => editor.moveLineUp(),
            disabled: readOnly,
        },
        {
            label: "Move Line Down",
            icon: <ArrowDown className={iconSize} />,
            shortcut: "Alt+\u2193",
            action: () => editor.moveLineDown(),
            disabled: readOnly,
            separator: true,
        },
        // Transforms
        {
            label: "Toggle Comment",
            icon: <MessageSquareCode className={iconSize} />,
            shortcut: "Ctrl+/",
            action: () => editor.toggleComment(),
            disabled: readOnly,
        },
        {
            label: "Sort Lines",
            icon: <ArrowUpDown className={iconSize} />,
            action: () => editor.sortLines(),
            disabled: readOnly,
        },
        {
            label: "Uppercase",
            icon: <CaseUpper className={iconSize} />,
            action: () => editor.toUpper(),
            disabled: readOnly || !hasSelection,
        },
        {
            label: "Lowercase",
            icon: <CaseLower className={iconSize} />,
            action: () => editor.toLower(),
            disabled: readOnly || !hasSelection,
            separator: true,
        },
        // Formatting
        {
            label: "Trim Whitespace",
            icon: <RemoveFormatting className={iconSize} />,
            action: () => editor.trimWhitespace(),
            disabled: readOnly,
        },
        {
            label: "Format Document",
            icon: <Braces className={iconSize} />,
            shortcut: "Ctrl+Shift+F",
            action: () => onFormat?.(),
            disabled: readOnly || !onFormat,
        },
        // Search
        {
            label: "Find",
            icon: <Search className={iconSize} />,
            shortcut: "Ctrl+F",
            action: () => s.openFind(),
        },
        {
            label: "Find & Replace",
            icon: <Replace className={iconSize} />,
            shortcut: "Ctrl+H",
            action: () => s.openFindReplace(),
        },
        {
            label: "Go to Line",
            icon: <Hash className={iconSize} />,
            shortcut: "Ctrl+G",
            action: () => s.openGoToLine(),
        },
        {
            label: "Command Palette",
            icon: <Terminal className={iconSize} />,
            shortcut: "Ctrl+Shift+P",
            action: () => s.openCommandPalette(),
        },
        {
            label: "Split Editor",
            icon: <Columns2 className={iconSize} />,
            shortcut: "Ctrl+\\",
            action: () => s.toggleSplitView(),
            separator: true,
        },
        // Save
        {
            label: "Save",
            icon: <Save className={iconSize} />,
            shortcut: "Ctrl+S",
            action: onSave,
            disabled: !modified || readOnly,
        },
    ];

    return (
        <div
            ref={ctxMenuRef}
            className="editor-ctx-menu editor-animate-in absolute z-50 p-1.5 rounded-lg shadow-2xl shadow-black/50"
            style={{
                left: ctxMenu.x,
                top: ctxMenu.y,
                minWidth: 220,
                background: "var(--editor-popup-bg)",
                border: "1px solid var(--editor-border)",
                maxHeight: "min(70vh, 500px)",
                overflowY: "auto",
                backdropFilter: "blur(12px)",
            }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {items.map((item, i) => (
                <div key={i}>
                    <button
                        disabled={item.disabled}
                        onClick={() => ctxAction(item.action)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors"
                        style={{
                            color: item.disabled
                                ? "var(--editor-muted)"
                                : "var(--editor-foreground)",
                            cursor: item.disabled ? "default" : "pointer",
                            background: "transparent",
                            border: "none",
                        }}
                        onMouseEnter={(e) => {
                            if (!item.disabled)
                                e.currentTarget.style.background = "var(--editor-popup-hover-bg)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                        }}
                    >
                        {item.icon && (
                            <span
                                className="w-4 h-4 flex items-center justify-center shrink-0"
                                style={{ color: item.disabled ? "var(--editor-muted)" : "var(--editor-accent)" }}
                            >
                                {item.icon}
                            </span>
                        )}
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.shortcut && (
                            <span
                                className="text-[11px] ml-auto pl-3 tracking-wide"
                                style={{ color: "var(--editor-muted)" }}
                            >
                                {item.shortcut}
                            </span>
                        )}
                    </button>
                    {item.separator && (
                        <div
                            className="my-1 h-px"
                            style={{ background: "var(--editor-border)", opacity: 0.5 }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
});
