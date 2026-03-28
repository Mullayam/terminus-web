/**
 * @module editor/plugins/builtin/json-formatter
 *
 * Format / minify JSON content.
 */
import type { ExtendedEditorPlugin } from "../types";

const JSON_LANGUAGES = new Set(["json", "jsonc", "json5"]);

function normalizeLanguage(lang: string): string {
    return lang.toLowerCase().replace(/\s+/g, "");
}

export function createJsonFormatterPlugin(): ExtendedEditorPlugin {
    return {
        id: "json-formatter",
        name: "JSON Formatter",
        version: "1.0.0",
        description: "Format (prettify) or minify JSON content",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("json.format", () => {
                const { language } = api.getFileInfo();
                if (!JSON_LANGUAGES.has(normalizeLanguage(language))) return;
                try {
                    const content = api.getContent();
                    const parsed = JSON.parse(content);
                    api.setContent(JSON.stringify(parsed, null, 2));
                } catch {
                    api.showToast("JSON", "Invalid JSON — cannot format", "destructive");
                }
            });

            api.registerCommand("json.minify", () => {
                const { language } = api.getFileInfo();
                if (!JSON_LANGUAGES.has(normalizeLanguage(language))) return;
                try {
                    const content = api.getContent();
                    const parsed = JSON.parse(content);
                    api.setContent(JSON.stringify(parsed));
                } catch {
                    api.showToast("JSON", "Invalid JSON — cannot minify", "destructive");
                }
            });

            api.addContextMenuItem({
                label: "Format JSON",
                action: () => api.executeCommand("json.format"),
                priority: 50,
            });

            api.addContextMenuItem({
                label: "Minify JSON",
                action: () => api.executeCommand("json.minify"),
                priority: 51,
            });
        },
    };
}
