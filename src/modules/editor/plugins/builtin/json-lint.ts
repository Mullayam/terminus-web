/**
 * @module editor/plugins/builtin/json-lint
 *
 * Real-time JSON syntax validation with diagnostics.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic } from "../types";

function validateJson(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    try {
        JSON.parse(content);
    } catch (e) {
        const error = e as SyntaxError;
        const msg = error.message;

        // Extract position from error message
        const posMatch = msg.match(/position (\d+)/);
        const pos = posMatch ? parseInt(posMatch[1]) : 0;
        const before = content.slice(0, pos);
        const lines = before.split("\n");
        const line = lines.length;
        const col = lines[lines.length - 1]?.length ?? 0;

        diagnostics.push({
            id: `json-lint:error:${line}`,
            line,
            startCol: Math.max(0, col - 1),
            endCol: col + 1,
            message: msg,
            severity: "error",
            source: "json-lint",
        });
    }

    return diagnostics;
}

export function createJsonLintPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "json-lint",
        name: "JSON Lint",
        version: "1.0.0",
        description: "Real-time JSON syntax validation",
        category: "validation",
        defaultEnabled: true,

        onActivate(api) {
            const { language } = api.getFileInfo();
            if (language.toLowerCase().includes("json")) {
                update(api);
            }
        },

        onContentChange(_content, api) {
            const { language } = api.getFileInfo();
            if (!language.toLowerCase().includes("json")) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 400);
        },

        onLanguageChange(language, api) {
            if (language.toLowerCase().includes("json")) {
                update(api);
            } else {
                api.clearDiagnostics("json-lint");
            }
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("json-lint");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const diagnostics = validateJson(content);
    api.setDiagnostics(diagnostics);
}
