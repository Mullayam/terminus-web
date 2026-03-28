/**
 * @module editor/plugins/builtin/console-log-detector
 *
 * Detects leftover console.log/warn/error statements
 * and marks them as warnings.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic } from "../types";

const CONSOLE_REGEX = /\bconsole\.(log|warn|error|info|debug|trace|dir|table|time|timeEnd|group|groupEnd|assert)\b/g;

function findConsoleStatements(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

        let match: RegExpExecArray | null;
        CONSOLE_REGEX.lastIndex = 0;
        while ((match = CONSOLE_REGEX.exec(line)) !== null) {
            diagnostics.push({
                id: `console-log-detector:${i + 1}:${match.index}`,
                line: i + 1,
                startCol: match.index,
                endCol: match.index + match[0].length,
                message: `Leftover console.${match[1]} statement`,
                severity: "warning",
                source: "console-log-detector",
                fixes: [
                    {
                        label: "Remove this line",
                        apply: () => {/* Handled by fix system */},
                    },
                ],
            });
        }
    }

    return diagnostics;
}

export function createConsoleLogDetectorPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "console-log-detector",
        name: "Console.log Detector",
        version: "1.0.0",
        description: "Flags leftover console.log statements as warnings",
        category: "validation",
        defaultEnabled: true,

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("console-log-detector");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const diags = findConsoleStatements(content);
    api.setDiagnostics(diags);
}
