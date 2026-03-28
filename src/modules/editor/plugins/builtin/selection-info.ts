/**
 * @module editor/plugins/builtin/selection-info
 *
 * Shows selection info (selected chars, lines, words) in annotations.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

export function createSelectionInfoPlugin(): ExtendedEditorPlugin {
    return {
        id: "selection-info",
        name: "Selection Info",
        version: "1.0.0",
        description: "Shows character, word, and line count of the current selection",
        category: "ui",
        defaultEnabled: true,

        onSelectionChange(sel, api) {
            if (!sel || sel.start === sel.end) {
                api.clearInlineAnnotations("selection-info");
                return;
            }

            const content = api.getContent();
            const text = content.slice(sel.start, sel.end);
            const chars = text.length;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            const lines = text.split("\n").length;

            const { line } = api.getCursorPosition();
            const annotation: InlineAnnotation = {
                id: "selection-info:stats",
                line,
                text: `  (${chars} char${chars !== 1 ? "s" : ""}, ${words} word${words !== 1 ? "s" : ""}, ${lines} line${lines !== 1 ? "s" : ""})`,
                className: "editor-selection-info",
                style: { opacity: 0.5, fontStyle: "italic", fontSize: "10px" },
            };

            api.setInlineAnnotations([annotation]);
        },

        onDeactivate(api) {
            api.clearInlineAnnotations("selection-info");
        },
    };
}
