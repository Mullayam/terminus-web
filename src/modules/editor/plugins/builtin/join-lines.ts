/**
 * @module editor/plugins/builtin/join-lines
 *
 * Join current line with the next line.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createJoinLinesPlugin(): ExtendedEditorPlugin {
    return {
        id: "join-lines",
        name: "Join Lines",
        version: "1.0.0",
        description: "Join current line with the line below",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("joinLines", () => {
                const content = api.getContent();
                const { line } = api.getCursorPosition();
                const lines = content.split("\n");
                if (line < 1 || line >= lines.length) return;
                lines[line - 1] = lines[line - 1].trimEnd() + " " + lines[line].trimStart();
                lines.splice(line, 1);
                api.setContent(lines.join("\n"));
            });

            api.registerKeybinding({
                id: "join-lines:join",
                label: "Join Lines",
                keys: "Ctrl+J",
                handler: (e) => { e.preventDefault(); api.executeCommand("joinLines"); },
                when: "editor",
                category: "Edit",
            });
        },
    };
}
