/**
 * @module editor/plugins/builtin/select-occurrences
 *
 * Highlight all occurrences of the current word / selection
 * and provide multi-select via Ctrl+D.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

function getWord(content: string, offset: number): string {
    const before = content.slice(0, offset).match(/\w+$/)?.[0] ?? "";
    const after = content.slice(offset).match(/^\w+/)?.[0] ?? "";
    return before + after;
}

function findOccurrences(content: string, word: string): Array<{ start: number; end: number; line: number; col: number }> {
    if (!word || word.length < 2) return [];
    const results: Array<{ start: number; end: number; line: number; col: number }> = [];
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
        const before = content.slice(0, match.index);
        const lines = before.split("\n");
        results.push({
            start: match.index,
            end: match.index + word.length,
            line: lines.length,
            col: (lines[lines.length - 1]?.length ?? 0),
        });
    }
    return results;
}

function updateHighlights(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const sel = api.getSelection();
    let word = "";

    if (sel && sel.start !== sel.end) {
        word = content.slice(sel.start, sel.end).trim();
    } else {
        const { offset } = api.getCursorPosition();
        word = getWord(content, offset);
    }

    if (!word || word.length < 2 || word.includes("\n")) {
        api.clearInlineDecorations("select-occurrences");
        return;
    }

    const occurrences = findOccurrences(content, word);
    const decorations: InlineDecoration[] = occurrences.map((occ, i) => ({
        id: `select-occurrences:${i}`,
        line: occ.line,
        startCol: occ.col,
        endCol: occ.col + word.length,
        className: "editor-occurrence-highlight",
        style: { backgroundColor: "rgba(255, 255, 255, 0.1)", borderRadius: "2px" },
        hoverMessage: `${occurrences.length} occurrence${occurrences.length !== 1 ? "s" : ""}`,
    }));

    api.addInlineDecorations(decorations);
}

export function createSelectOccurrencesPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "select-occurrences",
        name: "Select Occurrences",
        version: "1.0.0",
        description: "Highlight all occurrences of the current word or selection",
        category: "editor",
        defaultEnabled: true,

        onSelectionChange(_sel, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => updateHighlights(api), 200);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("select-occurrences");
        },
    };
}
