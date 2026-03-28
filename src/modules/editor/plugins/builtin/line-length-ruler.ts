/**
 * @module editor/plugins/builtin/line-length-ruler
 *
 * Warns when lines exceed a configurable max length.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic } from "../types";

const DEFAULT_MAX_LENGTH = 120;

function checkLineLengths(content: string, maxLength: number): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > maxLength) {
            diagnostics.push({
                id: `line-length-ruler:${i + 1}`,
                line: i + 1,
                startCol: maxLength,
                endCol: lines[i].length,
                message: `Line exceeds ${maxLength} characters (${lines[i].length})`,
                severity: "warning",
                source: "line-length-ruler",
            });
        }
    }

    return diagnostics;
}

export function createLineLengthRulerPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "line-length-ruler",
        name: "Line Length Ruler",
        version: "1.0.0",
        description: "Warns when lines exceed the maximum length (120 characters)",
        category: "validation",
        defaultEnabled: false,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("line-length-ruler");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const diags = checkLineLengths(content, DEFAULT_MAX_LENGTH);
    api.setDiagnostics(diags);
}
