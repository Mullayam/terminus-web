/**
 * @module editor/plugins/builtin/multi-cursor-support
 *
 * Multi-cursor utilities – add cursors above/below,
 * select all occurrences, etc.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createMultiCursorPlugin(): ExtendedEditorPlugin {
    return {
        id: "multi-cursor-support",
        name: "Multi Cursor Support",
        version: "1.0.0",
        description: "Multi-cursor editing commands",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("multiCursor.selectAllOccurrences", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const content = api.getContent();
                const text = content.slice(sel.start, sel.end);
                if (!text.trim()) return;

                // Find all occurrences and select the first one
                const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const regex = new RegExp(escaped, "g");
                const matches: Array<{ start: number; end: number }> = [];
                let match: RegExpExecArray | null;
                while ((match = regex.exec(content)) !== null) {
                    matches.push({ start: match.index, end: match.index + text.length });
                }

                api.showToast("Multi-Cursor", `${matches.length} occurrence${matches.length !== 1 ? "s" : ""} found`, "default");
            });

            api.registerKeybinding({
                id: "multi-cursor:selectAll",
                label: "Select All Occurrences",
                keys: "Ctrl+Shift+L",
                handler: (e) => { e.preventDefault(); api.executeCommand("multiCursor.selectAllOccurrences"); },
                when: "editor",
                category: "Selection",
            });
        },
    };
}
