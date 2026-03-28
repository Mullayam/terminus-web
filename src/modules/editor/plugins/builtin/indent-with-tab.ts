/**
 * @module editor/plugins/builtin/indent-with-tab
 *
 * Indent/outdent selected lines with Tab/Shift+Tab.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

function indentLines(api: ExtendedPluginAPI, direction: "indent" | "outdent") {
    const content = api.getContent();
    const sel = api.getSelection();
    const { line: cursorLine } = api.getCursorPosition();
    const lines = content.split("\n");

    // Determine which lines to modify
    let startLine = cursorLine;
    let endLine = cursorLine;

    if (sel && sel.start !== sel.end) {
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineEnd = count + lines[i].length + 1;
            if (count <= sel.start && sel.start < lineEnd) startLine = i + 1;
            if (count < sel.end && sel.end <= lineEnd) endLine = i + 1;
            count = lineEnd;
        }
    }

    const tabStr = "  "; // 2-space indent

    for (let i = startLine - 1; i <= endLine - 1 && i < lines.length; i++) {
        if (direction === "indent") {
            lines[i] = tabStr + lines[i];
        } else {
            if (lines[i].startsWith(tabStr)) {
                lines[i] = lines[i].slice(tabStr.length);
            } else if (lines[i].startsWith("\t")) {
                lines[i] = lines[i].slice(1);
            }
        }
    }

    api.setContent(lines.join("\n"));
}

export function createIndentWithTabPlugin(): ExtendedEditorPlugin {
    return {
        id: "indent-with-tab",
        name: "Indent with Tab",
        version: "1.0.0",
        description: "Indent/outdent lines with Tab and Shift+Tab",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("indentLines", () => indentLines(api, "indent"));
            api.registerCommand("outdentLines", () => indentLines(api, "outdent"));
        },
    };
}
