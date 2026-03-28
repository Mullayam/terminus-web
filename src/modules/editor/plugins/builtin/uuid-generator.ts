/**
 * @module editor/plugins/builtin/uuid-generator
 *
 * Generate and insert UUIDs.
 */
import type { ExtendedEditorPlugin } from "../types";

function generateUUID(): string {
    return crypto.randomUUID();
}

function generateShortId(length = 8): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes)
        .map((b) => chars[b % chars.length])
        .join("");
}

export function createUuidGeneratorPlugin(): ExtendedEditorPlugin {
    return {
        id: "uuid-generator",
        name: "UUID Generator",
        version: "1.0.0",
        description: "Generate and insert UUIDs and short IDs",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("uuid.insert", () => {
                api.replaceSelection(generateUUID());
            });

            api.registerCommand("uuid.insertShort", () => {
                api.replaceSelection(generateShortId());
            });

            api.registerCommand("uuid.insertNoDashes", () => {
                api.replaceSelection(generateUUID().replace(/-/g, ""));
            });

            api.addContextMenuItem({
                label: "Insert UUID",
                action: () => api.executeCommand("uuid.insert"),
                priority: 72,
            });
        },
    };
}
