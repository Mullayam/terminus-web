/**
 * @module editor/components/ShortcutsModal
 * Modal dialog showing all available keyboard shortcuts.
 */
import { memo, useEffect, useRef } from "react";
import { X, Keyboard } from "lucide-react";
import { useEditorStore } from "../state/context";

interface ShortcutGroup {
    title: string;
    items: { keys: string; desc: string }[];
}

const GROUPS: ShortcutGroup[] = [
    {
        title: "File",
        items: [
            { keys: "Ctrl + S", desc: "Save file" },
            { keys: "Ctrl + Shift + S", desc: "Save & close" },
        ],
    },
    {
        title: "Navigation",
        items: [
            { keys: "Ctrl + G", desc: "Go to line" },
            { keys: "Ctrl + F", desc: "Find" },
            { keys: "Ctrl + H", desc: "Find & Replace" },
            { keys: "Ctrl + Home", desc: "Go to start" },
            { keys: "Ctrl + End", desc: "Go to end" },
        ],
    },
    {
        title: "Editing",
        items: [
            { keys: "Ctrl + Z", desc: "Undo" },
            { keys: "Ctrl + Y", desc: "Redo" },
            { keys: "Ctrl + D", desc: "Duplicate line" },
            { keys: "Ctrl + Shift + K", desc: "Delete line" },
            { keys: "Ctrl + /", desc: "Toggle comment" },
            { keys: "Tab / Shift+Tab", desc: "Indent / Outdent" },
            { keys: "Alt + ↑", desc: "Move line up" },
            { keys: "Alt + ↓", desc: "Move line down" },
            { keys: "Ctrl + [", desc: "Wrap with [ ]" },
            { keys: "Ctrl + Shift + [", desc: "Wrap with { }" },
        ],
    },
    {
        title: "Transform",
        items: [
            { keys: "Ctrl + Shift + U", desc: "UPPERCASE selection" },
            { keys: "Ctrl + Shift + L", desc: "lowercase selection" },
            { keys: "Ctrl + Shift + T", desc: "Trim trailing whitespace" },
            { keys: "Ctrl + Shift + P", desc: "Sort lines ascending" },
            { keys: "Ctrl + Shift + F", desc: "Format document" },
        ],
    },
    {
        title: "View",
        items: [
            { keys: "Ctrl + =", desc: "Zoom in" },
            { keys: "Ctrl + -", desc: "Zoom out" },
            { keys: "Ctrl + 0", desc: "Reset zoom" },
            { keys: "Ctrl + M", desc: "Toggle minimap" },
            { keys: "Alt + Z", desc: "Toggle word wrap" },
        ],
    },
];

export const ShortcutsModal = memo(function ShortcutsModal() {
    const showShortcuts = useEditorStore((s) => s.showShortcuts);
    const closeShortcuts = useEditorStore((s) => s.closeShortcuts);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showShortcuts) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeShortcuts();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [showShortcuts, closeShortcuts]);

    if (!showShortcuts) return null;

    return (
        <div
            ref={overlayRef}
            onClick={(e) => { if (e.target === overlayRef.current) closeShortcuts(); }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
        >
            <div
                className="rounded-lg shadow-2xl flex flex-col"
                style={{
                    background: "var(--editor-popup-bg)",
                    border: "1px solid var(--editor-border)",
                    color: "var(--editor-foreground)",
                    width: "min(640px, 90vw)",
                    maxHeight: "80vh",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom: "1px solid var(--editor-border)" }}
                >
                    <div className="flex items-center gap-2">
                        <Keyboard className="w-4 h-4" style={{ color: "var(--editor-accent)" }} />
                        <span className="font-semibold text-sm">Keyboard Shortcuts</span>
                    </div>
                    <button
                        onClick={closeShortcuts}
                        style={{
                            padding: 4, borderRadius: 4, color: "var(--editor-muted)",
                            cursor: "pointer", background: "transparent", border: "none",
                        }}
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-5" style={{ flex: 1 }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {GROUPS.map((g) => (
                            <div key={g.title}>
                                <h3
                                    className="text-xs font-bold uppercase tracking-wider mb-2"
                                    style={{ color: "var(--editor-accent)" }}
                                >
                                    {g.title}
                                </h3>
                                <div className="space-y-1">
                                    {g.items.map((it) => (
                                        <div
                                            key={it.keys}
                                            className="flex items-center justify-between text-[12px] px-2 py-1 rounded"
                                            style={{ background: "var(--editor-background)" }}
                                        >
                                            <span style={{ color: "var(--editor-muted)" }}>{it.desc}</span>
                                            <kbd
                                                className="text-[11px] px-1.5 py-0.5 rounded"
                                                style={{
                                                    background: "var(--editor-toolbar-bg)",
                                                    border: "1px solid var(--editor-border)",
                                                    fontFamily: "var(--editor-font-family)",
                                                    color: "var(--editor-foreground)",
                                                }}
                                            >
                                                {it.keys}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tips */}
                    <div
                        className="mt-4 text-[11px] text-center"
                        style={{ color: "var(--editor-muted)" }}
                    >
                        Press <strong>Escape</strong> to close · Right-click for context menu
                    </div>
                </div>
            </div>
        </div>
    );
});
