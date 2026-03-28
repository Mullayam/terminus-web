/**
 * @module editor/plugins/builtin/duplicate-line-detector
 *
 * Detects duplicate lines in the current file.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic } from "../types";

function findDuplicateLines(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");
    const seen = new Map<string, number>();

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.length < 5) continue; // Skip short/empty lines
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("#")) continue;
        if (trimmed === "{" || trimmed === "}" || trimmed === ")" || trimmed === "]") continue;

        if (seen.has(trimmed)) {
            diagnostics.push({
                id: `duplicate-line-detector:${i + 1}`,
                line: i + 1,
                startCol: 0,
                endCol: lines[i].length,
                message: `Duplicate of line ${seen.get(trimmed)!}`,
                severity: "info",
                source: "duplicate-line-detector",
            });
        } else {
            seen.set(trimmed, i + 1);
        }
    }

    return diagnostics;
}

export function createDuplicateLineDetectorPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "duplicate-line-detector",
        name: "Duplicate Line Detector",
        version: "1.0.0",
        description: "Detects duplicate lines in the current file",
        category: "validation",
        defaultEnabled: false,

        onActivate(api) {
            api.registerCommand("duplicateLines.check", () => update(api));
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 1000);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("duplicate-line-detector");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const diags = findDuplicateLines(content);
    api.setDiagnostics(diags);
}
