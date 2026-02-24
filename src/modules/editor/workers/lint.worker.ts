/**
 * @module editor/workers/lint.worker
 *
 * Background linting Web Worker.
 * Performs basic structural linting on content without blocking the main thread.
 *
 * Checks:
 *   - Bracket/parenthesis/brace matching
 *   - Trailing whitespace detection
 *   - Mixed indentation (tabs vs spaces)
 *   - Very long lines (>500 chars)
 *   - Consecutive blank lines (>3)
 *
 * Message protocol:
 *   Request:  { id, type: "lint", content, language? }
 *   Response: { id, type: "lint", diagnostics: LintDiagnostic[], duration }
 */

export interface LintDiagnostic {
    line: number;       // 1-based
    col: number;        // 1-based
    severity: "error" | "warning" | "info";
    message: string;
    source: string;
}

// ── Bracket matching ─────────────────────────────────────────

const OPENERS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function checkBrackets(lines: string[]): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const stack: { char: string; line: number; col: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let inString: string | null = null;

        for (let j = 0; j < line.length; j++) {
            const ch = line[j];

            // Simple string detection (not 100% accurate but good enough)
            if ((ch === '"' || ch === "'" || ch === "`") && (j === 0 || line[j - 1] !== "\\")) {
                if (inString === ch) inString = null;
                else if (!inString) inString = ch;
                continue;
            }
            if (inString) continue;

            // Skip line comments
            if (ch === "/" && j + 1 < line.length && (line[j + 1] === "/" || line[j + 1] === "*")) {
                break;
            }

            if (OPENERS[ch]) {
                stack.push({ char: ch, line: i + 1, col: j + 1 });
            } else if (CLOSERS[ch]) {
                const expected = CLOSERS[ch];
                if (stack.length === 0) {
                    diagnostics.push({
                        line: i + 1,
                        col: j + 1,
                        severity: "error",
                        message: `Unmatched closing '${ch}'`,
                        source: "bracket-match",
                    });
                } else {
                    const top = stack[stack.length - 1];
                    if (top.char !== expected) {
                        diagnostics.push({
                            line: i + 1,
                            col: j + 1,
                            severity: "error",
                            message: `Mismatched bracket: expected '${OPENERS[top.char]}' but found '${ch}'`,
                            source: "bracket-match",
                        });
                    }
                    stack.pop();
                }
            }
        }
    }

    // Report unclosed brackets
    for (const item of stack) {
        diagnostics.push({
            line: item.line,
            col: item.col,
            severity: "error",
            message: `Unclosed '${item.char}'`,
            source: "bracket-match",
        });
    }

    return diagnostics;
}

// ── Trailing whitespace ──────────────────────────────────────

function checkTrailingWhitespace(lines: string[]): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 0 && line !== line.trimEnd()) {
            diagnostics.push({
                line: i + 1,
                col: line.trimEnd().length + 1,
                severity: "info",
                message: "Trailing whitespace",
                source: "whitespace",
            });
        }
    }

    return diagnostics;
}

// ── Mixed indentation ────────────────────────────────────────

function checkMixedIndentation(lines: string[]): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    let tabCount = 0;
    let spaceCount = 0;

    for (const line of lines) {
        if (line.startsWith("\t")) tabCount++;
        else if (line.startsWith("  ")) spaceCount++;
    }

    // Only warn if there's a clear mix
    if (tabCount > 0 && spaceCount > 0 && Math.min(tabCount, spaceCount) > 3) {
        const dominant = tabCount > spaceCount ? "tabs" : "spaces";
        const minority = dominant === "tabs" ? "spaces" : "tabs";
        diagnostics.push({
            line: 1,
            col: 1,
            severity: "warning",
            message: `Mixed indentation: file uses mostly ${dominant} but has ${minority} too`,
            source: "indentation",
        });
    }

    return diagnostics;
}

// ── Long lines ───────────────────────────────────────────────

function checkLongLines(lines: string[], maxLength = 500): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > maxLength) {
            diagnostics.push({
                line: i + 1,
                col: maxLength + 1,
                severity: "warning",
                message: `Line exceeds ${maxLength} characters (${lines[i].length})`,
                source: "line-length",
            });
        }
    }

    return diagnostics;
}

// ── Consecutive blank lines ──────────────────────────────────

function checkConsecutiveBlanks(lines: string[], maxBlanks = 3): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    let blankCount = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "") {
            blankCount++;
            if (blankCount === maxBlanks + 1) {
                diagnostics.push({
                    line: i + 1,
                    col: 1,
                    severity: "info",
                    message: `More than ${maxBlanks} consecutive blank lines`,
                    source: "blank-lines",
                });
            }
        } else {
            blankCount = 0;
        }
    }

    return diagnostics;
}

// ── Message handler ──────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent) => {
    const { id, type, content } = e.data;
    const t0 = performance.now();

    if (type === "lint") {
        const lines = content.split("\n");

        const diagnostics: LintDiagnostic[] = [
            ...checkBrackets(lines),
            ...checkTrailingWhitespace(lines),
            ...checkMixedIndentation(lines),
            ...checkLongLines(lines),
            ...checkConsecutiveBlanks(lines),
        ];

        // Sort by line number
        diagnostics.sort((a, b) => a.line - b.line || a.col - b.col);

        self.postMessage({
            id,
            type: "lint",
            diagnostics,
            duration: performance.now() - t0,
        });
    }
});
