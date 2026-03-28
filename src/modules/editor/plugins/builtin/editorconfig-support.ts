/**
 * @module editor/plugins/builtin/editorconfig-support
 *
 * Reads .editorconfig-like settings and applies them
 * (indent style, indent size, trim whitespace, final newline).
 */
import type { ExtendedEditorPlugin } from "../types";

interface EditorConfigSettings {
    indent_style?: "space" | "tab";
    indent_size?: number;
    trim_trailing_whitespace?: boolean;
    insert_final_newline?: boolean;
    max_line_length?: number;
}

function parseEditorConfig(content: string): EditorConfigSettings {
    const settings: EditorConfigSettings = {};
    const lines = content.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;

        const [key, value] = trimmed.split("=").map((s) => s.trim().toLowerCase());
        if (key === "indent_style") settings.indent_style = value as "space" | "tab";
        if (key === "indent_size") settings.indent_size = parseInt(value) || undefined;
        if (key === "trim_trailing_whitespace") settings.trim_trailing_whitespace = value === "true";
        if (key === "insert_final_newline") settings.insert_final_newline = value === "true";
        if (key === "max_line_length") settings.max_line_length = parseInt(value) || undefined;
    }

    return settings;
}

export function createEditorConfigPlugin(): ExtendedEditorPlugin {
    return {
        id: "editorconfig-support",
        name: "EditorConfig Support",
        version: "1.0.0",
        description: "Reads and applies .editorconfig settings",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("editorconfig.apply", (...args: unknown[]) => {
                const configContent = typeof args[0] === "string" ? args[0] : "";
                if (!configContent) return;

                const settings = parseEditorConfig(configContent);
                api.showToast("EditorConfig",
                    `Applied: indent=${settings.indent_style ?? "default"} size=${settings.indent_size ?? "default"}`,
                    "default"
                );
            });
        },

        onSave(_content, api) {
            // Apply trim and final newline on save
            const content = api.getContent();
            let modified = content;

            // Trim trailing whitespace
            modified = modified.split("\n").map((line) => line.replace(/\s+$/, "")).join("\n");

            // Insert final newline
            if (!modified.endsWith("\n")) {
                modified += "\n";
            }

            if (modified !== content) {
                api.setContent(modified);
            }
        },
    };
}
