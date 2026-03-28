/**
 * @module editor/plugins/builtin/column-select
 *
 * Provides column/block selection mode.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createColumnSelectPlugin(): ExtendedEditorPlugin {
    return {
        id: "column-select",
        name: "Column Select",
        version: "1.0.0",
        description: "Column/block selection mode helper commands",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("column.insert", (...args: unknown[]) => {
                const text = typeof args[0] === "string" ? args[0] : "";
                if (!text) return;

                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;

                const content = api.getContent();
                const selected = content.slice(sel.start, sel.end);
                const lines = selected.split("\n");
                const prefixed = lines.map((l) => text + l).join("\n");
                api.replaceSelection(prefixed);
            });

            api.registerCommand("column.removePrefix", (...args: unknown[]) => {
                const count = typeof args[0] === "number" ? args[0] : 1;
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;

                const content = api.getContent();
                const selected = content.slice(sel.start, sel.end);
                const lines = selected.split("\n");
                const trimmed = lines.map((l) => l.slice(count)).join("\n");
                api.replaceSelection(trimmed);
            });

            api.registerCommand("column.alignEquals", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;

                const content = api.getContent();
                const selected = content.slice(sel.start, sel.end);
                const lines = selected.split("\n");

                // Find max position of '=' sign
                let maxPos = 0;
                for (const line of lines) {
                    const idx = line.indexOf("=");
                    if (idx > maxPos) maxPos = idx;
                }

                const aligned = lines.map((line) => {
                    const idx = line.indexOf("=");
                    if (idx < 0) return line;
                    const padding = " ".repeat(maxPos - idx);
                    return line.slice(0, idx) + padding + line.slice(idx);
                }).join("\n");

                api.replaceSelection(aligned);
            });
        },
    };
}
