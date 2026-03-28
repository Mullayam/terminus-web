/**
 * @module editor/plugins/builtin/go-to-line
 *
 * Quick Go-to-Line command.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createGoToLinePlugin(): ExtendedEditorPlugin {
    return {
        id: "go-to-line",
        name: "Go to Line",
        version: "1.0.0",
        description: "Jump to a specific line number",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("goToLine", (...args: unknown[]) => {
                const lineNum = typeof args[0] === "number" ? args[0] : undefined;
                if (lineNum && lineNum > 0) {
                    const content = api.getContent();
                    const lines = content.split("\n");
                    const targetLine = Math.min(lineNum, lines.length);
                    let offset = 0;
                    for (let i = 0; i < targetLine - 1; i++) {
                        offset += lines[i].length + 1;
                    }
                    api.setSelection(offset, offset);
                }
            });

            api.registerKeybinding({
                id: "go-to-line:open",
                label: "Go to Line",
                keys: "Ctrl+G",
                handler: (e) => { e.preventDefault(); api.executeCommand("goToLine"); },
                when: "editor",
                category: "Navigation",
            });
        },
    };
}
