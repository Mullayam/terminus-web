/**
 * @module editor/plugins/builtin/final-newline
 *
 * Ensures file ends with a single newline on save.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createFinalNewlinePlugin(): ExtendedEditorPlugin {
    return {
        id: "final-newline",
        name: "Insert Final Newline",
        version: "1.0.0",
        description: "Ensures every file ends with exactly one newline on save",
        category: "editor",
        defaultEnabled: true,

        onSave(_content, api) {
            const current = api.getContent();
            const fixed = current.replace(/\n*$/, "\n");
            if (fixed !== current) {
                api.setContent(fixed);
            }
        },
    };
}
