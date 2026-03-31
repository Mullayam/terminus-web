/**
 * @module editor/plugins/builtin/unused-variable-detector
 *
 * Detects variables/constants that are declared but never used.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic } from "../types";

import { JS_FAMILY as JS_LANGUAGES } from "@/modules/monaco-editor/lib/language/language-groups";

function detectUnusedVariables(content: string, language: string): Diagnostic[] {
    if (!JS_LANGUAGES.has(language)) return [];

    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");
    const declarations: Array<{ name: string; line: number; col: number }> = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments, imports, exports
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ") || trimmed.startsWith("export ")) continue;

        // Match const/let/var declarations
        const m = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=/);
        if (m) {
            const col = line.indexOf(m[1]);
            declarations.push({ name: m[1], line: i + 1, col });
        }
    }

    for (const decl of declarations) {
        const escaped = decl.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "g");
        const matches = content.match(regex);
        const count = matches?.length ?? 0;

        if (count <= 1) {
            diagnostics.push({
                id: `unused-variable-detector:${decl.line}`,
                line: decl.line,
                startCol: decl.col,
                endCol: decl.col + decl.name.length,
                message: `'${decl.name}' is declared but never used`,
                severity: "warning",
                source: "unused-variable-detector",
            });
        }
    }

    return diagnostics;
}

export function createUnusedVariableDetectorPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "unused-variable-detector",
        name: "Unused Variable Detector",
        version: "1.0.0",
        description: "Detects variables that are declared but never used",
        category: "validation",
        defaultEnabled: false,

        onContentChange(_content, api) {
            const { language } = api.getFileInfo();
            if (!JS_LANGUAGES.has(language.toLowerCase())) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 800);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("unused-variable-detector");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { language } = api.getFileInfo();
    const diags = detectUnusedVariables(content, language.toLowerCase());
    api.setDiagnostics(diags);
}
