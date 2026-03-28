/**
 * @module editor/plugins/builtin/matching-brackets
 *
 * Highlight matching brackets when cursor is on one.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

const OPEN = new Set(["(", "[", "{"]);
const CLOSE = new Set([")", "]", "}"]);
const MATCH: Record<string, string> = {
    "(": ")", "[": "]", "{": "}",
    ")": "(", "]": "[", "}": "{",
};

function findMatchingBracket(content: string, offset: number): number | null {
    const ch = content[offset];
    if (!ch || (!OPEN.has(ch) && !CLOSE.has(ch))) return null;

    const isOpen = OPEN.has(ch);
    const target = MATCH[ch];
    let depth = 0;
    const step = isOpen ? 1 : -1;

    for (let i = offset; i >= 0 && i < content.length; i += step) {
        if (content[i] === ch) depth++;
        else if (content[i] === target) depth--;
        if (depth === 0) return i;
    }
    return null;
}

function getLineCol(content: string, offset: number): { line: number; col: number } {
    const before = content.slice(0, offset);
    const lines = before.split("\n");
    return { line: lines.length, col: lines[lines.length - 1].length };
}

export function createMatchingBracketsPlugin(): ExtendedEditorPlugin {
    return {
        id: "matching-brackets",
        name: "Matching Brackets",
        version: "1.0.0",
        description: "Highlights matching brackets when cursor is adjacent to one",
        category: "editor",
        defaultEnabled: true,

        onSelectionChange(_sel, api) {
            updateBracketHighlight(api);
        },

        onDeactivate(api) {
            api.clearInlineDecorations("matching-brackets");
        },
    };
}

function updateBracketHighlight(api: ExtendedPluginAPI) {
    api.clearInlineDecorations("matching-brackets");
    const content = api.getContent();
    const { offset } = api.getCursorPosition();

    // Check character at cursor and before cursor
    for (const off of [offset, offset - 1]) {
        if (off < 0 || off >= content.length) continue;
        const match = findMatchingBracket(content, off);
        if (match !== null) {
            const start = getLineCol(content, off);
            const end = getLineCol(content, match);
            const decorations: InlineDecoration[] = [
                {
                    id: "matching-brackets:open",
                    line: start.line,
                    startCol: start.col,
                    endCol: start.col + 1,
                    className: "editor-bracket-match",
                    style: { backgroundColor: "rgba(255, 255, 255, 0.12)", borderRadius: "2px" },
                },
                {
                    id: "matching-brackets:close",
                    line: end.line,
                    startCol: end.col,
                    endCol: end.col + 1,
                    className: "editor-bracket-match",
                    style: { backgroundColor: "rgba(255, 255, 255, 0.12)", borderRadius: "2px" },
                },
            ];
            api.addInlineDecorations(decorations);
            return;
        }
    }
}
