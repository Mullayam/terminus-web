/**
 * @module editor/plugins/builtin/line-numbers
 *
 * Relative line numbers mode.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, GutterDecoration } from "../types";
import { createElement } from "react";

function computeRelativeLineNumbers(content: string, cursorLine: number): GutterDecoration[] {
    const lineCount = content.split("\n").length;
    const decorations: GutterDecoration[] = [];

    for (let i = 1; i <= lineCount; i++) {
        const relative = Math.abs(i - cursorLine);
        decorations.push({
            id: `line-numbers:${i}`,
            line: i,
            icon: createElement("span", {
                style: {
                    fontSize: "11px",
                    color: i === cursorLine
                        ? "var(--editor-foreground, #f8f8f2)"
                        : "var(--editor-muted, #6272a4)",
                    fontWeight: i === cursorLine ? 600 : 400,
                },
            }, i === cursorLine ? String(i) : String(relative)),
        });
    }

    return decorations;
}

export function createRelativeLineNumbersPlugin(): ExtendedEditorPlugin {
    let enabled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "relative-line-numbers",
        name: "Relative Line Numbers",
        version: "1.0.0",
        description: "Shows relative line numbers from cursor position",
        category: "ui",
        defaultEnabled: false,

        onActivate(api) {
            enabled = true;
            api.registerCommand("relativeLineNumbers.toggle", () => {
                enabled = !enabled;
                if (enabled) update(api);
                else api.clearGutterDecorations("line-numbers");
            });
            update(api);
        },

        onSelectionChange(_sel, api) {
            if (!enabled) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 100);
        },

        onContentChange(_content, api) {
            if (!enabled) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 200);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearGutterDecorations("line-numbers");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { line } = api.getCursorPosition();
    const decorations = computeRelativeLineNumbers(content, line);
    api.clearGutterDecorations("line-numbers");
    api.addGutterDecorations(decorations);
}
