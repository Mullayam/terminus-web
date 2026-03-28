/**
 * @module editor/plugins/builtin/trailing-comma
 *
 * Detects missing or extra trailing commas in arrays/objects.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic } from "../types";

const JS_LANGUAGES = new Set(["javascript", "typescript", "jsx", "tsx", "json"]);

function checkTrailingCommas(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1]?.trim() ?? "";

        // Detect missing trailing comma before closing bracket
        if (nextLine.match(/^[}\]]\s*[,;]?$/) && line.length > 0 && !line.endsWith(",") && !line.endsWith("{") && !line.endsWith("[") && !line.endsWith("(") && !line.startsWith("//") && !line.startsWith("*")) {
            if (line.match(/["'\d\w}\]]\s*$/)) {
                diagnostics.push({
                    id: `trailing-comma:missing:${i + 1}`,
                    line: i + 1,
                    startCol: lines[i].length - 1,
                    endCol: lines[i].length,
                    message: "Consider adding a trailing comma",
                    severity: "hint",
                    source: "trailing-comma",
                });
            }
        }
    }

    return diagnostics;
}

export function createTrailingCommaPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "trailing-comma",
        name: "Trailing Comma Hints",
        version: "1.0.0",
        description: "Suggests adding trailing commas before closing brackets",
        category: "validation",
        defaultEnabled: false,

        onContentChange(_content, api) {
            const { language } = api.getFileInfo();
            if (!JS_LANGUAGES.has(language.toLowerCase())) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 600);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("trailing-comma");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const diags = checkTrailingCommas(content);
    api.setDiagnostics(diags);
}
