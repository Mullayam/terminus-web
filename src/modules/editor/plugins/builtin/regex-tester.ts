/**
 * @module editor/plugins/builtin/regex-tester
 *
 * Inline regex testing — highlights matches in the document
 * when cursor is on a regex literal.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

function extractRegexAtCursor(content: string, offset: number): RegExp | null {
    // Find the regex literal surrounding the cursor
    const before = content.slice(0, offset);
    const after = content.slice(offset);

    // Match /pattern/flags
    const startMatch = before.match(/\/([^/\n]*)$/);
    const endMatch = after.match(/^([^/\n]*)\/([gimsuvy]*)/);

    if (!startMatch || !endMatch) return null;

    const pattern = startMatch[1] + endMatch[1];
    const flags = endMatch[2] || "g";

    try {
        return new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
    } catch {
        return null;
    }
}

function findRegexMatches(content: string, regex: RegExp): Array<{ line: number; col: number; endCol: number; text: string }> {
    const results: Array<{ line: number; col: number; endCol: number; text: string }> = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;
        while ((match = regex.exec(lines[i])) !== null) {
            results.push({
                line: i + 1,
                col: match.index,
                endCol: match.index + match[0].length,
                text: match[0],
            });
            if (!regex.global) break;
        }
    }

    return results;
}

export function createRegexTesterPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "regex-tester",
        name: "Regex Tester",
        version: "1.0.0",
        description: "Highlights regex matches when cursor is on a regex literal",
        category: "language",
        defaultEnabled: true,

        onSelectionChange(_sel, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 300);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("regex-tester");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { offset } = api.getCursorPosition();
    const regex = extractRegexAtCursor(content, offset);

    if (!regex) {
        api.clearInlineDecorations("regex-tester");
        return;
    }

    const matches = findRegexMatches(content, regex);
    const decorations: InlineDecoration[] = matches.slice(0, 200).map((m, i) => ({
        id: `regex-tester:${i}`,
        line: m.line,
        startCol: m.col,
        endCol: m.endCol,
        className: "editor-regex-match",
        style: { backgroundColor: "rgba(139, 233, 253, 0.2)", borderRadius: "2px" },
        hoverMessage: `Match: "${m.text}"`,
    }));

    api.clearInlineDecorations("regex-tester");
    api.addInlineDecorations(decorations);

    api.showToast("Regex", `${matches.length} match${matches.length !== 1 ? "es" : ""} found`, "default");
}
