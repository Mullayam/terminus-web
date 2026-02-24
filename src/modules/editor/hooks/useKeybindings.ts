/**
 * @module editor/hooks/useKeybindings
 * Global keyboard shortcut handler for the editor.
 * Attaches to the editor root element and dispatches actions.
 */
import { useEffect, useCallback } from "react";
import { useEditorStore, useEditorStoreApi, useEditorRefs } from "../state/context";
import { useEditor } from "./useEditor";

interface KeybindingCfg {
    onSave: () => void;
    onFormat?: () => void;
}

export function useKeybindings(cfg: KeybindingCfg) {
    const storeApi = useEditorStoreApi();
    const { textareaRef } = useEditorRefs();
    const editor = useEditor();

    const handler = useCallback(
        (e: KeyboardEvent) => {
            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;
            const alt = e.altKey;
            const key = e.key.toLowerCase();

            /* helper: prevent default + stop propagation */
            const eat = () => { e.preventDefault(); e.stopPropagation(); };
            const s = storeApi.getState();

            /* ── File ──────────────────────────────── */
            if (ctrl && !shift && key === "s") { eat(); cfg.onSave(); return; }

            /* ── Navigation ────────────────────────── */
            if (ctrl && !shift && key === "f") { eat(); s.openFind(); return; }
            if (ctrl && key === "h") { eat(); s.openFind(); return; }
            if (ctrl && !shift && key === "g") { eat(); s.openGoToLine(); return; }

            /* ── Undo / Redo ───────────────────────── */
            if (ctrl && !shift && key === "z") { eat(); s.undo(); return; }
            if (ctrl && (key === "y" || (shift && key === "z"))) { eat(); s.redo(); return; }

            /* ── Line ops ──────────────────────────── */
            if (ctrl && !shift && key === "d") { eat(); editor.duplicateLine(); return; }
            if (ctrl && shift && key === "k") { eat(); editor.deleteLine(); return; }
            if (ctrl && key === "/") { eat(); editor.toggleComment(); return; }
            if (alt && !ctrl && key === "arrowup") { eat(); editor.moveLineUp(); return; }
            if (alt && !ctrl && key === "arrowdown") { eat(); editor.moveLineDown(); return; }

            /* ── Tab indent ────────────────────────── */
            if (key === "tab" && !ctrl && !alt) {
                const ta = textareaRef.current;
                if (ta && document.activeElement === ta) {
                    eat();
                    if (shift) editor.outdent(); else editor.indent();
                    return;
                }
            }

            /* ── Transform ─────────────────────────── */
            if (ctrl && shift && key === "u") { eat(); editor.toUpper(); return; }
            if (ctrl && shift && key === "l") { eat(); editor.toLower(); return; }
            if (ctrl && shift && key === "t") { eat(); editor.trimWhitespace(); return; }
            if (ctrl && shift && key === "p") { eat(); editor.sortLines(); return; }
            if (ctrl && shift && key === "f") { eat(); cfg.onFormat?.(); return; }

            /* ── Wrap ──────────────────────────────── */
            if (ctrl && !shift && key === "[") { eat(); editor.wrapBrackets(); return; }
            if (ctrl && shift && key === "[") { eat(); editor.wrapBraces(); return; }

            /* ── View ──────────────────────────────── */
            if (ctrl && key === "=") { eat(); s.zoomIn(); return; }
            if (ctrl && key === "-") { eat(); s.zoomOut(); return; }
            if (ctrl && key === "0") { eat(); s.resetZoom(); return; }
            if (ctrl && key === "m") { eat(); s.toggleMinimap(); return; }
            if (alt && key === "z") { eat(); s.toggleWordWrap(); return; }

            /* ── Help ──────────────────────────────── */
            if (ctrl && key === "k") { eat(); s.openShortcuts(); return; }
        },
        [storeApi, editor, cfg, textareaRef],
    );

    useEffect(() => {
        window.addEventListener("keydown", handler, true);
        return () => window.removeEventListener("keydown", handler, true);
    }, [handler]);
}
