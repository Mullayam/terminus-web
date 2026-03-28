/**
 * @module editor/plugins/builtin/auto-save
 *
 * Auto-save the file at configurable intervals.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

const DEFAULT_DELAY = 5000; // 5 seconds

export function createAutoSavePlugin(): ExtendedEditorPlugin {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let enabled = true;

    function scheduleAutoSave(api: ExtendedPluginAPI) {
        if (timer) clearTimeout(timer);
        if (!enabled) return;

        timer = setTimeout(() => {
            api.executeCommand("save");
        }, DEFAULT_DELAY);
    }

    return {
        id: "auto-save",
        name: "Auto Save",
        version: "1.0.0",
        description: "Automatically saves the file after a delay",
        category: "editor",
        defaultEnabled: false,

        onActivate(api) {
            api.registerCommand("autoSave.toggle", () => {
                enabled = !enabled;
                api.showToast("Auto Save", enabled ? "Enabled" : "Disabled", "default");
            });
        },

        onContentChange(_content, api) {
            scheduleAutoSave(api);
        },

        onDeactivate() {
            if (timer) clearTimeout(timer);
        },
    };
}
