/**
 * @module editor/plugins/builtin/highlight-current-line
 *
 * Highlight the line where the cursor is currently placed.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

export function createHighlightCurrentLinePlugin(): ExtendedEditorPlugin {
    return {
        id: "highlight-current-line",
        name: "Highlight Current Line",
        version: "1.0.0",
        description: "Highlights the current cursor line with a subtle background",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onSelectionChange(_sel, api) {
            update(api);
        },

        onDeactivate(api) {
            api.clearInlineDecorations("highlight-current-line");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const { line } = api.getCursorPosition();
    const lineContent = api.getLineContent(line);

    const decoration: InlineDecoration = {
        id: "highlight-current-line:active",
        line,
        startCol: 0,
        endCol: lineContent.length,
        className: "editor-active-line",
        style: { backgroundColor: "rgba(255, 255, 255, 0.04)" },
    };

    api.clearInlineDecorations("highlight-current-line");
    api.addInlineDecorations([decoration]);
}
