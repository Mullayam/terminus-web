/**
 * @module editor/plugins/builtin/delete-line
 *
 * Delete the current line with Ctrl+Shift+K.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createDeleteLinePlugin(): ExtendedEditorPlugin {
    return {
        id: "delete-line",
        name: "Delete Line",
        version: "1.0.0",
        description: "Delete entire current line",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("deleteLine", () => {
                const content = api.getContent();
                const { line } = api.getCursorPosition();
                const lines = content.split("\n");
                if (line < 1 || line > lines.length) return;
                lines.splice(line - 1, 1);
                api.setContent(lines.join("\n"));
            });

            api.registerKeybinding({
                id: "delete-line:delete",
                label: "Delete Line",
                keys: "Ctrl+Shift+K",
                handler: (e) => { e.preventDefault(); api.executeCommand("deleteLine"); },
                when: "editor",
                category: "Edit",
            });
        },
    };
}
