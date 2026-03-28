/**
 * @module editor/plugins/builtin/smart-select
 *
 * Expand or shrink selection to semantic boundaries
 * (word → string → brackets → line → block → all).
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

const BRACKET_PAIRS: Record<string, string> = {
    "(": ")", "[": "]", "{": "}", "<": ">",
    ")": "(", "]": "[", "}": "{", ">": "<",
};
const OPEN_BRACKETS = new Set(["(", "[", "{", "<"]);
const CLOSE_BRACKETS = new Set([")", "]", "}", ">"]);

function findEnclosingBrackets(content: string, offset: number): [number, number] | null {
    const stack: string[] = [];
    let start = offset - 1;

    // Scan backwards for unmatched open bracket
    while (start >= 0) {
        const ch = content[start];
        if (CLOSE_BRACKETS.has(ch)) {
            stack.push(ch);
        } else if (OPEN_BRACKETS.has(ch)) {
            if (stack.length > 0 && stack[stack.length - 1] === BRACKET_PAIRS[ch]) {
                stack.pop();
            } else {
                break;
            }
        }
        start--;
    }
    if (start < 0) return null;

    const openBracket = content[start];
    const closeBracket = BRACKET_PAIRS[openBracket];
    let depth = 1;
    let end = offset;

    while (end < content.length && depth > 0) {
        if (content[end] === openBracket) depth++;
        else if (content[end] === closeBracket) depth--;
        if (depth > 0) end++;
    }

    return depth === 0 ? [start + 1, end] : null;
}

function expandSelection(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const sel = api.getSelection();
    if (!sel) return;

    const { start, end } = sel;

    // If no selection, select current word
    if (start === end) {
        const before = content.slice(0, start);
        const after = content.slice(start);
        const wordStart = before.search(/\w+$/);
        const wordEnd = after.search(/\W/);
        const s = wordStart >= 0 ? wordStart : start;
        const e = wordEnd >= 0 ? start + wordEnd : content.length;
        if (s !== e) {
            api.setSelection(s, e);
            return;
        }
    }

    // Try enclosing brackets
    const brackets = findEnclosingBrackets(content, start);
    if (brackets && (brackets[0] < start || brackets[1] > end)) {
        api.setSelection(brackets[0], brackets[1]);
        return;
    }

    // Select entire line
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = content.indexOf("\n", end);
    const le = lineEnd >= 0 ? lineEnd : content.length;
    if (lineStart < start || le > end) {
        api.setSelection(lineStart, le);
        return;
    }

    // Select all
    api.setSelection(0, content.length);
}

export function createSmartSelectPlugin(): ExtendedEditorPlugin {
    return {
        id: "smart-select",
        name: "Smart Select",
        version: "1.0.0",
        description: "Expand selection to semantic boundaries (word, brackets, line, all)",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("smartSelect.expand", () => expandSelection(api));

            api.registerKeybinding({
                id: "smart-select:expand",
                label: "Expand Selection",
                keys: "Ctrl+Shift+Space",
                handler: (e) => { e.preventDefault(); expandSelection(api); },
                when: "editor",
                category: "Selection",
            });
        },
    };
}
