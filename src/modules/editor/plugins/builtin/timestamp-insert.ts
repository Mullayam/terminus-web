/**
 * @module editor/plugins/builtin/timestamp-insert
 *
 * Insert timestamps and date strings at cursor position.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createTimestampInsertPlugin(): ExtendedEditorPlugin {
    return {
        id: "timestamp-insert",
        name: "Timestamp Insert",
        version: "1.0.0",
        description: "Insert current date/time at cursor position",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("timestamp.iso", () => {
                api.replaceSelection(new Date().toISOString());
            });

            api.registerCommand("timestamp.locale", () => {
                api.replaceSelection(new Date().toLocaleString());
            });

            api.registerCommand("timestamp.date", () => {
                api.replaceSelection(new Date().toISOString().split("T")[0]);
            });

            api.registerCommand("timestamp.time", () => {
                api.replaceSelection(new Date().toLocaleTimeString());
            });

            api.registerCommand("timestamp.unix", () => {
                api.replaceSelection(String(Math.floor(Date.now() / 1000)));
            });

            api.registerCommand("timestamp.unixMs", () => {
                api.replaceSelection(String(Date.now()));
            });

            api.addContextMenuItem({
                label: "Insert Timestamp (ISO)",
                action: () => api.executeCommand("timestamp.iso"),
                priority: 71,
            });
        },
    };
}
