/**
 * @module editor/plugins/builtin/trim-whitespace
 *
 * Trims trailing whitespace on save.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createTrimWhitespacePlugin(): ExtendedEditorPlugin {
    return {
        id: "trim-whitespace",
        name: "Trim Trailing Whitespace",
        version: "1.0.0",
        description: "Removes trailing whitespace from all lines on save",
        category: "editor",
        defaultEnabled: true,

        onSave(_content, api) {
            const current = api.getContent();
            const trimmed = current
                .split("\n")
                .map((line) => line.replace(/\s+$/, ""))
                .join("\n");
            if (trimmed !== current) {
                api.setContent(trimmed);
            }
        },
    };
}
