/**
 * @module editor/plugins/builtin/json-path
 *
 * Shows the JSON path of the current cursor position
 * in a JSON file (e.g., $.data.users[0].name).
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

function getJsonPath(content: string, offset: number): string | null {
    try {
        JSON.parse(content);
    } catch {
        return null;
    }

    const before = content.slice(0, offset);
    const path: string[] = ["$"];
    let depth = 0;
    let inString = false;
    let currentKey = "";
    let arrayIndices: number[] = [];
    let isKey = false;

    for (let i = 0; i < before.length; i++) {
        const ch = before[i];

        if (ch === '"' && (i === 0 || before[i - 1] !== "\\")) {
            inString = !inString;
            if (!inString && isKey) {
                // Finished reading a key
                path[depth] = currentKey;
                currentKey = "";
            }
            isKey = inString && depth > 0;
            continue;
        }

        if (inString) {
            if (isKey) currentKey += ch;
            continue;
        }

        if (ch === "{") {
            depth++;
            isKey = true;
        } else if (ch === "}") {
            depth = Math.max(0, depth - 1);
        } else if (ch === "[") {
            arrayIndices[depth] = 0;
        } else if (ch === "]") {
            arrayIndices[depth] = 0;
        } else if (ch === ",") {
            if (arrayIndices[depth] !== undefined) {
                arrayIndices[depth]++;
            }
        } else if (ch === ":") {
            isKey = false;
        }
    }

    // Build path string
    const parts = path.filter(Boolean);
    if (parts.length <= 1) return "$";
    return parts.join(".");
}

export function createJsonPathPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "json-path",
        name: "JSON Path",
        version: "1.0.0",
        description: "Shows the JSON path at the current cursor position",
        category: "language",
        defaultEnabled: true,

        onSelectionChange(_sel, api) {
            const { language } = api.getFileInfo();
            if (!language.toLowerCase().includes("json")) return;

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 200);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineAnnotations("json-path");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { offset, line } = api.getCursorPosition();
    const jsonPath = getJsonPath(content, offset);

    if (jsonPath) {
        const annotation: InlineAnnotation = {
            id: "json-path:current",
            line,
            text: `  ${jsonPath}`,
            className: "editor-json-path",
            style: { opacity: 0.4, fontStyle: "italic", fontSize: "10px" },
        };
        api.setInlineAnnotations([annotation]);
    } else {
        api.clearInlineAnnotations("json-path");
    }
}
