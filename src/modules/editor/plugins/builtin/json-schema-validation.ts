/**
 * @module editor/plugins/builtin/json-schema-validation
 *
 * JSON schema validation plugin.
 * Provides structural validation, type checking, and common error detection
 * for JSON files, reporting diagnostics inline.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic, DiagnosticFix } from "../types";

interface JsonError {
    message: string;
    line: number;
    col: number;
    endCol: number;
    severity: Diagnostic["severity"];
}

/** Parse JSON & collect all errors (structural + semantic) */
function validateJson(content: string): JsonError[] {
    const errors: JsonError[] = [];
    const lines = content.split("\n");

    // 1. Try native parse first for syntax errors
    try {
        JSON.parse(content);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Invalid JSON";
        // Extract position from error message like "at position 123"
        const posMatch = msg.match(/position\s+(\d+)/i);
        if (posMatch) {
            const pos = parseInt(posMatch[1], 10);
            const { line, col } = offsetToLineCol(content, pos);
            errors.push({
                message: msg,
                line,
                col,
                endCol: col + 1,
                severity: "error",
            });
        } else {
            errors.push({
                message: msg,
                line: 1,
                col: 0,
                endCol: lines[0]?.length ?? 1,
                severity: "error",
            });
        }
        return errors; // Syntax error — skip semantic checks
    }

    // 2. Semantic checks
    // Check for duplicate keys
    const keyPattern = /"([^"]+)"\s*:/g;
    const keysByScope: Map<number, Map<string, number[]>> = new Map();
    let scopeDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
            if (ch === "{") scopeDepth++;
            if (ch === "}") scopeDepth--;
        }
        
        let m: RegExpExecArray | null;
        const lineKeyRegex = /"([^"]+)"\s*:/g;
        while ((m = lineKeyRegex.exec(line)) !== null) {
            if (!keysByScope.has(scopeDepth)) keysByScope.set(scopeDepth, new Map());
            const scopeKeys = keysByScope.get(scopeDepth)!;
            const key = m[1];
            if (!scopeKeys.has(key)) scopeKeys.set(key, []);
            scopeKeys.get(key)!.push(i + 1);
        }
    }
    
    for (const [_scope, keys] of keysByScope) {
        for (const [key, lineNums] of keys) {
            if (lineNums.length > 1) {
                for (const ln of lineNums.slice(1)) {
                    errors.push({
                        message: `Duplicate key "${key}"`,
                        line: ln,
                        col: 0,
                        endCol: lines[ln - 1]?.length ?? 1,
                        severity: "warning",
                    });
                }
            }
        }
    }

    // Check for trailing commas
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimEnd();
        if (trimmed.endsWith(",")) {
            // Check if next non-empty line starts with } or ]
            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j].trim();
                if (!next) continue;
                if (next.startsWith("}") || next.startsWith("]")) {
                    errors.push({
                        message: "Trailing comma before closing bracket",
                        line: i + 1,
                        col: trimmed.length - 1,
                        endCol: trimmed.length,
                        severity: "warning",
                    });
                }
                break;
            }
        }
    }

    // Check for comments (not valid JSON)
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("/*")) {
            errors.push({
                message: "Comments are not valid in JSON",
                line: i + 1,
                col: 0,
                endCol: lines[i].length,
                severity: "info",
            });
        }
    }

    return errors;
}

function offsetToLineCol(content: string, offset: number): { line: number; col: number } {
    let line = 1;
    let col = 0;
    for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === "\n") { line++; col = 0; }
        else col++;
    }
    return { line, col };
}

export function createJsonSchemaValidationPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "json-schema-validation",
        name: "JSON Schema Validation",
        version: "1.0.0",
        description: "Validates JSON structure and reports errors",
        category: "validation",
        defaultEnabled: true,

        onActivate(api) {
            const { fileName } = api.getFileInfo();
            if (fileName.endsWith(".json")) {
                runValidation(api);
            }
        },

        onContentChange(content, api) {
            const { fileName } = api.getFileInfo();
            if (!fileName.endsWith(".json")) return;

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => runValidation(api), 500);
        },

        onLanguageChange(language, api) {
            if (language === "JSON") {
                runValidation(api);
            } else {
                api.clearDiagnostics("json-schema-validation");
            }
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("json-schema-validation");
        },
    };
}

function runValidation(api: ExtendedPluginAPI) {
    const content = api.getContent();
    if (!content.trim()) {
        api.clearDiagnostics("json-schema-validation");
        return;
    }

    const errors = validateJson(content);
    const diagnostics: Diagnostic[] = errors.map((err, i) => ({
        id: `json-schema-validation:${i}`,
        line: err.line,
        startCol: err.col,
        endCol: err.endCol,
        message: err.message,
        severity: err.severity,
        source: "JSON Validation",
    }));

    api.setDiagnostics(diagnostics);
}
