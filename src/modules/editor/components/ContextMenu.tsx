/**
 * @module editor/components/ContextMenu
 * Context menu with overflow-safe positioning and scroll support.
 * Uses useLayoutEffect to reposition when the menu would overflow.
 */
import { useLayoutEffect, useEffect, memo } from "react";
import { useEditorStore, useEditorRefs } from "../state/context";
import type { ContextMenuItem } from "../types";

interface ContextMenuProps {
    items: ContextMenuItem[];
}

export const ContextMenu = memo(function ContextMenu({ items }: ContextMenuProps) {
    const ctxMenu = useEditorStore((s) => s.ctxMenu);
    const setCtxMenu = useEditorStore((s) => s.setCtxMenu);
    const { ctxMenuRef, editorWrapperRef, textareaRef } = useEditorRefs();

    // Close on click outside / Escape
    useEffect(() => {
        if (!ctxMenu) return;
        const close = () => setCtxMenu(null);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };
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
        let x = ctxMenu.x;
        let y = ctxMenu.y;
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

    return (
        <div
            ref={ctxMenuRef}
            className="editor-ctx-menu editor-animate-in absolute z-50 w-56 p-1.5 rounded-lg shadow-2xl shadow-black/50"
            style={{
                left: ctxMenu.x,
                top: ctxMenu.y,
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
                                className="w-4 h-4 flex items-center justify-center"
                                style={{ color: "var(--editor-accent)" }}
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
                            style={{ background: "var(--editor-border)" }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
});
