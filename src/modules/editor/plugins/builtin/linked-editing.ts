/**
 * @module editor/plugins/builtin/linked-editing
 *
 * When editing a variable name, highlights all references
 * and provides a "rename all" command.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

function findWordAtPosition(content: string, lines: string[], line: number, col: number): string | null {
    const lineText = lines[line - 1] || "";
    if (col < 0 || col >= lineText.length) return null;

    let start = col;
    let end = col;
    while (start > 0 && /\w/.test(lineText[start - 1])) start--;
    while (end < lineText.length && /\w/.test(lineText[end])) end++;

    const word = lineText.slice(start, end);
    return word.length >= 2 ? word : null;
}

export function createLinkedEditingPlugin(): ExtendedEditorPlugin {
    return {
        id: "linked-editing",
        name: "Linked Editing",
        version: "1.0.0",
        description: "Highlights and renames all occurrences of the word at cursor",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("linked.renameAll", (...args: unknown[]) => {
                const oldName = typeof args[0] === "string" ? args[0] : "";
                const newName = typeof args[1] === "string" ? args[1] : "";
                if (!oldName || !newName) return;

                const content = api.getContent();
                const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const regex = new RegExp(`\\b${escaped}\\b`, "g");
                const replaced = content.replace(regex, newName);
                api.setContent(replaced);
            });
        },

        onSelectionChange(sel, api) {
            if (!sel || sel.start === sel.end) {
                updateHighlights(api);
                return;
            }
            updateHighlights(api);
        },

        onDeactivate(api) {
            api.clearInlineDecorations("linked-editing");
        },
    };
}

function updateHighlights(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const lines = content.split("\n");
    const { line, col } = api.getCursorPosition();

    const word = findWordAtPosition(content, lines, line, col);
    if (!word) {
        api.clearInlineDecorations("linked-editing");
        return;
    }

    const decorations: InlineDecoration[] = [];
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");

    for (let i = 0; i < lines.length; i++) {
        let match;
        while ((match = regex.exec(lines[i])) !== null) {
            decorations.push({
                id: `linked-editing:${i + 1}:${match.index}`,
                line: i + 1,
                startCol: match.index,
                endCol: match.index + word.length,
                className: "editor-linked-highlight",
                style: { backgroundColor: "rgba(255, 255, 255, 0.08)", outline: "1px solid rgba(255, 255, 255, 0.15)" },
            });
        }
    }

    api.clearInlineDecorations("linked-editing");
    if (decorations.length > 1) {
        api.addInlineDecorations(decorations);
    }
}
