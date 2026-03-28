/**
 * @module editor/plugins/builtin/duplicate-lines
 *
 * Duplicate current line or selection up/down.
 */
import type { ExtendedEditorPlugin } from "../types";

function duplicateDown(api: import("../types").ExtendedPluginAPI) {
    const content = api.getContent();
    const { line } = api.getCursorPosition();
    const lines = content.split("\n");
    if (line < 1 || line > lines.length) return;
    const dup = lines[line - 1];
    lines.splice(line, 0, dup);
    api.setContent(lines.join("\n"));
}

function duplicateUp(api: import("../types").ExtendedPluginAPI) {
    const content = api.getContent();
    const { line } = api.getCursorPosition();
    const lines = content.split("\n");
    if (line < 1 || line > lines.length) return;
    const dup = lines[line - 1];
    lines.splice(line - 1, 0, dup);
    api.setContent(lines.join("\n"));
}

export function createDuplicateLinesPlugin(): ExtendedEditorPlugin {
    return {
        id: "duplicate-lines",
        name: "Duplicate Lines",
        version: "1.0.0",
        description: "Duplicate current line up or down",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("duplicateLine.down", () => duplicateDown(api));
            api.registerCommand("duplicateLine.up", () => duplicateUp(api));

            api.registerKeybinding({
                id: "duplicate-lines:down",
                label: "Duplicate Line Down",
                keys: "Shift+Alt+ArrowDown",
                handler: (e) => { e.preventDefault(); duplicateDown(api); },
                when: "editor",
                category: "Edit",
            });

            api.registerKeybinding({
                id: "duplicate-lines:up",
                label: "Duplicate Line Up",
                keys: "Shift+Alt+ArrowUp",
                handler: (e) => { e.preventDefault(); duplicateUp(api); },
                when: "editor",
                category: "Edit",
            });
        },
    };
}
