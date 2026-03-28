/**
 * @module editor/plugins/builtin/command-palette
 *
 * Provides a command palette integration that indexes
 * all registered plugin commands.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createCommandPalettePlugin(): ExtendedEditorPlugin {
    return {
        id: "command-palette",
        name: "Command Palette",
        version: "1.0.0",
        description: "Lists all available plugin commands",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("commandPalette.listAll", () => {
                const state = api.getState() as { commands?: Map<string, unknown> };
                const commands = state.commands;
                if (commands && commands instanceof Map) {
                    const items = Array.from(commands.keys()).sort();
                    api.showToast("Commands", items.slice(0, 30).join(", ") + (items.length > 30 ? `... (+${items.length - 30} more)` : ""), "default");
                } else {
                    api.showToast("Commands", "Command list not available", "default");
                }
            });

            api.registerKeybinding({
                id: "command-palette:open",
                label: "Open Command Palette",
                keys: "Ctrl+Shift+P",
                handler: (e) => {
                    e.preventDefault();
                    api.executeCommand("commandPalette.listAll");
                },
                when: "editor",
                category: "General",
            });
        },
    };
}
