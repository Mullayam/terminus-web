/**
 * @module editor/plugins/builtin/yaml-schema-validation
 *
 * YAML schema validation plugin.
 * Provides structural validation, indentation checking, and common
 * error detection for YAML files.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic } from "../types";

interface YamlError {
    message: string;
    line: number;
    col: number;
    endCol: number;
    severity: Diagnostic["severity"];
}

function validateYaml(content: string): YamlError[] {
    const errors: YamlError[] = [];
    const lines = content.split("\n");
    let expectedIndent = 0;
    let inMultiline = false;
    let multilineIndent = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#")) continue;

        // Check for tabs (YAML should use spaces)
        if (line.includes("\t")) {
            const tabIdx = line.indexOf("\t");
            errors.push({
                message: "Tabs are not allowed in YAML; use spaces for indentation",
                line: lineNum,
                col: tabIdx,
                endCol: tabIdx + 1,
                severity: "error",
            });
        }

        // Get current indentation
        const indentMatch = line.match(/^( *)/);
        const indent = indentMatch ? indentMatch[1].length : 0;

        // Check for odd indentation (YAML conventionally uses 2-space indent)
        if (indent % 2 !== 0 && indent > 0 && !inMultiline) {
            errors.push({
                message: "Inconsistent indentation: expected multiple of 2 spaces",
                line: lineNum,
                col: 0,
                endCol: indent,
                severity: "warning",
            });
        }

        // Handle multiline strings (| or >)
        if (inMultiline) {
            if (indent <= multilineIndent && trimmed) {
                inMultiline = false;
            } else {
                continue;
            }
        }

        // Detect multiline indicators
        if (trimmed.endsWith("|") || trimmed.endsWith(">") || trimmed.endsWith("|-") || trimmed.endsWith(">-")) {
            inMultiline = true;
            multilineIndent = indent;
            continue;
        }

        // Check for duplicate keys at root level (simple check)
        if (indent === 0 && trimmed.includes(":")) {
            const key = trimmed.split(":")[0].trim();
            // Look for duplicates in other root-level lines
            for (let j = 0; j < i; j++) {
                const otherLine = lines[j].trim();
                if (otherLine.startsWith(key + ":") || otherLine.startsWith(key + " :")) {
                    const otherIndentMatch = lines[j].match(/^( *)/);
                    const otherIndent = otherIndentMatch ? otherIndentMatch[1].length : 0;
                    if (otherIndent === 0) {
                        errors.push({
                            message: `Duplicate key "${key}" at root level`,
                            line: lineNum,
                            col: 0,
                            endCol: key.length,
                            severity: "warning",
                        });
                        break;
                    }
                }
            }
        }

        // Check for missing space after colon in key-value pairs
        if (trimmed.match(/^[\w.-]+:[^\s]/) && !trimmed.startsWith("http") && !trimmed.startsWith("https")) {
            const colonIdx = trimmed.indexOf(":");
            errors.push({
                message: "Missing space after colon in key-value pair",
                line: lineNum,
                col: indent + colonIdx,
                endCol: indent + colonIdx + 2,
                severity: "warning",
            });
        }

        // Check for trailing whitespace
        if (line.endsWith(" ") || line.endsWith("\t")) {
            errors.push({
                message: "Trailing whitespace",
                line: lineNum,
                col: line.trimEnd().length,
                endCol: line.length,
                severity: "hint",
            });
        }

        // Check for unquoted special values that might be ambiguous
        if (trimmed.match(/:\s+(yes|no|on|off|y|n)$/i)) {
            const match = trimmed.match(/:\s+(yes|no|on|off|y|n)$/i)!;
            errors.push({
                message: `Ambiguous boolean value "${match[1]}" — consider using true/false or quoting the value`,
                line: lineNum,
                col: line.length - match[1].length,
                endCol: line.length,
                severity: "info",
            });
        }
    }

    return errors;
}

export function createYamlSchemaValidationPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "yaml-schema-validation",
        name: "YAML Schema Validation",
        version: "1.0.0",
        description: "Validates YAML structure and reports errors",
        category: "validation",
        defaultEnabled: true,

        onActivate(api) {
            const { fileName } = api.getFileInfo();
            const ext = fileName.split(".").pop()?.toLowerCase();
            if (ext === "yaml" || ext === "yml") {
                runValidation(api);
            }
        },

        onContentChange(content, api) {
            const { fileName } = api.getFileInfo();
            const ext = fileName.split(".").pop()?.toLowerCase();
            if (ext !== "yaml" && ext !== "yml") return;

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => runValidation(api), 500);
        },

        onLanguageChange(language, api) {
            if (language === "YAML") {
                runValidation(api);
            } else {
                api.clearDiagnostics("yaml-schema-validation");
            }
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("yaml-schema-validation");
        },
    };
}

function runValidation(api: ExtendedPluginAPI) {
    const content = api.getContent();
    if (!content.trim()) {
        api.clearDiagnostics("yaml-schema-validation");
        return;
    }

    const errors = validateYaml(content);
    const diagnostics: Diagnostic[] = errors.map((err, i) => ({
        id: `yaml-schema-validation:${i}`,
        line: err.line,
        startCol: err.col,
        endCol: err.endCol,
        message: err.message,
        severity: err.severity,
        source: "YAML Validation",
    }));

    api.setDiagnostics(diagnostics);
}
