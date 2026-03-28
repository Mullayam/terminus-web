/**
 * @module editor/plugins/builtin/bracket-validator
 *
 * Validates matching brackets/parens/braces and reports unmatched ones.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic } from "../types";

const OPEN = { "(": ")", "[": "]", "{": "}" };
const CLOSE: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function validateBrackets(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const stack: Array<{ char: string; line: number; col: number }> = [];
    const lines = content.split("\n");
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const ch = line[j];
            const prev = j > 0 ? line[j - 1] : "";

            // Handle string detection
            if ((ch === '"' || ch === "'" || ch === "`") && prev !== "\\") {
                if (!inString) {
                    inString = true;
                    stringChar = ch;
                } else if (ch === stringChar) {
                    inString = false;
                }
                continue;
            }

            if (inString) continue;

            // Line comment
            if (ch === "/" && j + 1 < line.length && (line[j + 1] === "/" || line[j + 1] === "*")) break;

            if (ch in OPEN) {
                stack.push({ char: ch, line: i + 1, col: j });
            } else if (ch in CLOSE) {
                if (stack.length === 0 || stack[stack.length - 1].char !== CLOSE[ch]) {
                    diagnostics.push({
                        id: `bracket-validator:unmatched:${i + 1}:${j}`,
                        line: i + 1,
                        startCol: j,
                        endCol: j + 1,
                        message: `Unmatched closing '${ch}'`,
                        severity: "error",
                        source: "bracket-validator",
                    });
                } else {
                    stack.pop();
                }
            }
        }
    }

    // Remaining unmatched opening brackets
    for (const item of stack) {
        diagnostics.push({
            id: `bracket-validator:unclosed:${item.line}:${item.col}`,
            line: item.line,
            startCol: item.col,
            endCol: item.col + 1,
            message: `Unclosed '${item.char}'`,
            severity: "error",
            source: "bracket-validator",
        });
    }

    return diagnostics;
}

export function createBracketValidatorPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "bracket-validator",
        name: "Bracket Validator",
        version: "1.0.0",
        description: "Validates matching brackets and reports unmatched ones",
        category: "validation",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("bracket-validator");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const diags = validateBrackets(content);
    api.setDiagnostics(diags);
}
