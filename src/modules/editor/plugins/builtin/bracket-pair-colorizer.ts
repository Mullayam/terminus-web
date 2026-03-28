/**
 * @module editor/plugins/builtin/bracket-pair-colorizer
 *
 * Color-codes matching bracket pairs at different nesting levels.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

const BRACKET_COLORS = [
    "#FFD700", // Gold
    "#DA70D6", // Orchid
    "#87CEEB", // Sky Blue
    "#50fa7b", // Green
    "#ff79c6", // Pink
    "#ffb86c", // Orange
];

const OPEN_BRACKETS = new Set(["(", "[", "{"]);
const CLOSE_BRACKETS = new Set([")", "]", "}"]);

function getLineCol(content: string, offset: number): { line: number; col: number } {
    const before = content.slice(0, offset);
    const lines = before.split("\n");
    return { line: lines.length, col: lines[lines.length - 1].length };
}

function computeBracketDecorations(content: string): InlineDecoration[] {
    const decorations: InlineDecoration[] = [];
    let depth = 0;
    let id = 0;

    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (OPEN_BRACKETS.has(ch)) {
            const color = BRACKET_COLORS[depth % BRACKET_COLORS.length];
            const pos = getLineCol(content, i);
            decorations.push({
                id: `bracket-pair-colorizer:${id++}`,
                line: pos.line,
                startCol: pos.col,
                endCol: pos.col + 1,
                style: { color },
            });
            depth++;
        } else if (CLOSE_BRACKETS.has(ch)) {
            depth = Math.max(0, depth - 1);
            const color = BRACKET_COLORS[depth % BRACKET_COLORS.length];
            const pos = getLineCol(content, i);
            decorations.push({
                id: `bracket-pair-colorizer:${id++}`,
                line: pos.line,
                startCol: pos.col,
                endCol: pos.col + 1,
                style: { color },
            });
        }
    }

    return decorations;
}

export function createBracketPairColorizerPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "bracket-pair-colorizer",
        name: "Bracket Pair Colorizer",
        version: "1.0.0",
        description: "Colors matching bracket pairs at different nesting levels",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 300);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("bracket-pair-colorizer");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const decorations = computeBracketDecorations(content);
    api.clearInlineDecorations("bracket-pair-colorizer");
    api.addInlineDecorations(decorations);
}
