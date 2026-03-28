/**
 * @module editor/plugins/builtin/move-lines
 *
 * Move lines up/down with Alt+Arrow keys.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

function moveDown(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { line } = api.getCursorPosition();
    const lines = content.split("\n");
    if (line < 1 || line >= lines.length) return;
    [lines[line - 1], lines[line]] = [lines[line], lines[line - 1]];
    api.setContent(lines.join("\n"));
}

function moveUp(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { line } = api.getCursorPosition();
    const lines = content.split("\n");
    if (line < 2 || line > lines.length) return;
    [lines[line - 1], lines[line - 2]] = [lines[line - 2], lines[line - 1]];
    api.setContent(lines.join("\n"));
}

export function createMoveLinesPlugin(): ExtendedEditorPlugin {
    return {
        id: "move-lines",
        name: "Move Lines",
        version: "1.0.0",
        description: "Move current line up or down with keyboard shortcuts",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("moveLine.up", () => moveUp(api));
            api.registerCommand("moveLine.down", () => moveDown(api));

            api.registerKeybinding({
                id: "move-lines:up",
                label: "Move Line Up",
                keys: "Alt+ArrowUp",
                handler: (e) => { e.preventDefault(); moveUp(api); },
                when: "editor",
                category: "Edit",
            });

            api.registerKeybinding({
                id: "move-lines:down",
                label: "Move Line Down",
                keys: "Alt+ArrowDown",
                handler: (e) => { e.preventDefault(); moveDown(api); },
                when: "editor",
                category: "Edit",
            });
        },
    };
}
