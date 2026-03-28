/**
 * @module editor/plugins/builtin/format-on-save
 *
 * Runs registered formatters when the file is saved.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createFormatOnSavePlugin(): ExtendedEditorPlugin {
    return {
        id: "format-on-save",
        name: "Format on Save",
        version: "1.0.0",
        description: "Automatically formats document on save using registered formatters",
        category: "editor",
        defaultEnabled: true,

        onSave(_content, api) {
            // Trigger JSON formatting for JSON files
            const { language } = api.getFileInfo();
            const lang = language.toLowerCase();

            if (lang.includes("json")) {
                try {
                    const content = api.getContent();
                    const parsed = JSON.parse(content);
                    const formatted = JSON.stringify(parsed, null, 2);
                    if (formatted !== content) {
                        api.setContent(formatted);
                    }
                } catch {
                    // Not valid JSON, skip
                }
            }
        },
    };
}
