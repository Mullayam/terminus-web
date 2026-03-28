/**
 * @module editor/plugins/builtin/yaml-path
 *
 * Shows the YAML path at the current cursor position.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

function getYamlPath(content: string, cursorLine: number): string {
    const lines = content.split("\n");
    const path: string[] = [];

    for (let i = cursorLine - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line.trim()) continue;

        const indent = line.length - line.trimStart().length;
        const keyMatch = line.match(/^\s*([\w.-]+)\s*:/);

        if (keyMatch) {
            // Only add if this key is at a lower indent level
            if (path.length === 0 || indent < getIndentOfLastKey(lines, path, i)) {
                path.unshift(keyMatch[1]);
            }
        }
    }

    return path.length > 0 ? path.join(".") : "(root)";
}

function getIndentOfLastKey(lines: string[], path: string[], beforeLine: number): number {
    // Find the indent level of a key in the path
    for (let i = beforeLine + 1; i < lines.length; i++) {
        const m = lines[i].match(/^\s*([\w.-]+)\s*:/);
        if (m && path.includes(m[1])) {
            return lines[i].length - lines[i].trimStart().length;
        }
    }
    return Infinity;
}

export function createYamlPathPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "yaml-path",
        name: "YAML Path",
        version: "1.0.0",
        description: "Shows the YAML path at the current cursor position",
        category: "language",
        defaultEnabled: true,

        onSelectionChange(_sel, api) {
            const { language } = api.getFileInfo();
            if (!language.toLowerCase().includes("yaml") && !language.toLowerCase().includes("yml")) return;

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 200);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineAnnotations("yaml-path");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { line } = api.getCursorPosition();
    const yamlPath = getYamlPath(content, line);

    const annotation: InlineAnnotation = {
        id: "yaml-path:current",
        line,
        text: `  ${yamlPath}`,
        className: "editor-yaml-path",
        style: { opacity: 0.4, fontStyle: "italic", fontSize: "10px" },
    };
    api.setInlineAnnotations([annotation]);
}
