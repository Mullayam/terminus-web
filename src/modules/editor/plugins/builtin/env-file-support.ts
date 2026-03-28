/**
 * @module editor/plugins/builtin/env-file-support
 *
 * Provides .env file support: syntax highlighting hints,
 * value masking, and validation.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration, Diagnostic } from "../types";

export function createEnvFileSupportPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "env-file-support",
        name: "Env File Support",
        version: "1.0.0",
        description: "Support for .env files: validation, value masking",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 300);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("env-file-support");
            api.clearDiagnostics("env-file-support");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const { fileName } = api.getFileInfo();
    const isEnv = fileName.startsWith(".env") ||
        fileName === ".env" ||
        fileName.endsWith(".env") ||
        fileName.includes(".env.");

    if (!isEnv) {
        api.clearInlineDecorations("env-file-support");
        api.clearDiagnostics("env-file-support");
        return;
    }

    const content = api.getContent();
    const lines = content.split("\n");
    const decorations: InlineDecoration[] = [];
    const diagnostics: Diagnostic[] = [];
    const keys = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;

        const eqIdx = line.indexOf("=");
        if (eqIdx < 0) {
            diagnostics.push({
                id: `env-file-support:err:${i + 1}`,
                line: i + 1,
                startCol: 0,
                endCol: line.length,
                message: "Missing '=' separator",
                severity: "warning",
                source: "env-file-support",
            });
            continue;
        }

        const key = line.slice(0, eqIdx).trim();
        const value = line.slice(eqIdx + 1);

        // Check for duplicate keys
        if (keys.has(key)) {
            diagnostics.push({
                id: `env-file-support:dup:${i + 1}`,
                line: i + 1,
                startCol: 0,
                endCol: key.length,
                message: `Duplicate key: ${key}`,
                severity: "warning",
                source: "env-file-support",
            });
        }
        keys.add(key);

        // Highlight key
        decorations.push({
            id: `env-file-support:key:${i + 1}`,
            line: i + 1,
            startCol: 0,
            endCol: eqIdx,
            style: { fontWeight: "600" },
        });

        // Mask sensitive values
        const sensitivePatterns = ["password", "secret", "token", "key", "api_key", "apikey"];
        const isSensitive = sensitivePatterns.some((p) => key.toLowerCase().includes(p));
        if (isSensitive && value.length > 0) {
            decorations.push({
                id: `env-file-support:mask:${i + 1}`,
                line: i + 1,
                startCol: eqIdx + 1,
                endCol: line.length,
                style: { filter: "blur(4px)" },
                hoverMessage: "Sensitive value (hover to reveal)",
            });
        }
    }

    api.clearInlineDecorations("env-file-support");
    api.addInlineDecorations(decorations);
    api.setDiagnostics(diagnostics);
}
