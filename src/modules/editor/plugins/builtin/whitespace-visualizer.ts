/**
 * @module editor/plugins/builtin/whitespace-visualizer
 *
 * Renders whitespace characters (spaces, tabs, newlines) as visible dots/arrows.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

function computeWhitespaceDecorations(content: string): InlineDecoration[] {
    const decorations: InlineDecoration[] = [];
    const lines = content.split("\n");
    let id = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Trailing whitespace
        const trailingMatch = line.match(/(\s+)$/);
        if (trailingMatch) {
            const startCol = line.length - trailingMatch[1].length;
            decorations.push({
                id: `whitespace-visualizer:trailing:${id++}`,
                line: lineNum,
                startCol,
                endCol: line.length,
                className: "editor-trailing-whitespace",
                style: { backgroundColor: "rgba(255, 85, 85, 0.15)" },
                hoverMessage: `${trailingMatch[1].length} trailing whitespace character${trailingMatch[1].length !== 1 ? "s" : ""}`,
            });
        }

        // Tab characters
        for (let j = 0; j < line.length; j++) {
            if (line[j] === "\t") {
                decorations.push({
                    id: `whitespace-visualizer:tab:${id++}`,
                    line: lineNum,
                    startCol: j,
                    endCol: j + 1,
                    className: "editor-tab-char",
                    style: { opacity: 0.3 },
                    hoverMessage: "Tab character",
                });
            }
        }
    }

    return decorations;
}

export function createWhitespaceVisualizerPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "whitespace-visualizer",
        name: "Whitespace Visualizer",
        version: "1.0.0",
        description: "Renders trailing whitespace and tab characters as visible decorations",
        category: "ui",
        defaultEnabled: false,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 400);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("whitespace-visualizer");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const decs = computeWhitespaceDecorations(content);
    api.clearInlineDecorations("whitespace-visualizer");
    api.addInlineDecorations(decs);
}
