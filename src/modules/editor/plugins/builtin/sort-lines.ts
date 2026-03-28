/**
 * @module editor/plugins/builtin/sort-lines
 *
 * Sort selected lines alphabetically (asc/desc) or by length.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createSortLinesPlugin(): ExtendedEditorPlugin {
    return {
        id: "sort-lines",
        name: "Sort Lines",
        version: "1.0.0",
        description: "Sort selected lines alphabetically or by length",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("sortLines.asc", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const sorted = text.split("\n").sort((a, b) => a.localeCompare(b)).join("\n");
                api.replaceSelection(sorted);
            });

            api.registerCommand("sortLines.desc", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const sorted = text.split("\n").sort((a, b) => b.localeCompare(a)).join("\n");
                api.replaceSelection(sorted);
            });

            api.registerCommand("sortLines.byLength", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const sorted = text.split("\n").sort((a, b) => a.length - b.length).join("\n");
                api.replaceSelection(sorted);
            });
        },
    };
}
