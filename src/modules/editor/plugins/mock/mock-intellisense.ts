/**
 * @module editor/plugins/mock/mock-intellisense
 *
 * Mock IntelliSense Plugin.
 *
 * Simulates smart, context-aware completions including:
 *   - Property access after "." (e.g. `console.` → log, error, warn …)
 *   - Import path suggestions after quotes
 *   - Symbol-aware completions extracted from the current document
 *   - Diagnostics (mock lint warnings / errors) on content change
 *
 * Demonstrates:
 *   - CompletionProvider with trigger characters
 *   - `onContentChange` for diagnostics
 *   - `setDiagnostics` / `clearDiagnostics`
 *   - Inline annotations for type hints
 *
 * Usage:
 * ```ts
 * import { createMockIntelliSensePlugin } from "./plugins/mock";
 * <FileEditor plugins={[createMockIntelliSensePlugin()]} … />
 * ```
 */
import type {
    ExtendedEditorPlugin,
    ExtendedPluginAPI,
    CompletionProvider,
    CompletionItem,
    CompletionContext,
    Diagnostic,
    InlineAnnotation,
} from "../types";

// ── Mock property databases ──────────────────────────────────

const PROPERTY_DB: Record<string, Array<{ name: string; detail: string; kind: CompletionItem["kind"] }>> = {
    console: [
        { name: "log",       detail: "(...args: any[]) => void",      kind: "method" },
        { name: "error",     detail: "(...args: any[]) => void",      kind: "method" },
        { name: "warn",      detail: "(...args: any[]) => void",      kind: "method" },
        { name: "info",      detail: "(...args: any[]) => void",      kind: "method" },
        { name: "debug",     detail: "(...args: any[]) => void",      kind: "method" },
        { name: "table",     detail: "(data: any) => void",           kind: "method" },
        { name: "clear",     detail: "() => void",                    kind: "method" },
        { name: "time",      detail: "(label?: string) => void",      kind: "method" },
        { name: "timeEnd",   detail: "(label?: string) => void",      kind: "method" },
    ],
    Math: [
        { name: "abs",       detail: "(x: number) => number",         kind: "method" },
        { name: "ceil",      detail: "(x: number) => number",         kind: "method" },
        { name: "floor",     detail: "(x: number) => number",         kind: "method" },
        { name: "max",       detail: "(...values: number[]) => number", kind: "method" },
        { name: "min",       detail: "(...values: number[]) => number", kind: "method" },
        { name: "random",    detail: "() => number",                   kind: "method" },
        { name: "round",     detail: "(x: number) => number",         kind: "method" },
        { name: "PI",        detail: "3.141592653589793",              kind: "property" },
        { name: "E",         detail: "2.718281828459045",              kind: "property" },
    ],
    document: [
        { name: "getElementById",    detail: "(id: string) => Element | null",     kind: "method" },
        { name: "querySelector",     detail: "(sel: string) => Element | null",    kind: "method" },
        { name: "querySelectorAll",  detail: "(sel: string) => NodeListOf<Element>", kind: "method" },
        { name: "createElement",     detail: "(tag: string) => HTMLElement",       kind: "method" },
        { name: "body",              detail: "HTMLBodyElement",                    kind: "property" },
        { name: "title",             detail: "string",                             kind: "property" },
        { name: "addEventListener",  detail: "(type: string, fn: Function) => void", kind: "method" },
    ],
    window: [
        { name: "innerWidth",   detail: "number",                          kind: "property" },
        { name: "innerHeight",  detail: "number",                          kind: "property" },
        { name: "location",     detail: "Location",                        kind: "property" },
        { name: "localStorage", detail: "Storage",                         kind: "property" },
        { name: "setTimeout",   detail: "(fn: Function, ms: number) => number", kind: "method" },
        { name: "setInterval",  detail: "(fn: Function, ms: number) => number", kind: "method" },
        { name: "fetch",        detail: "(url: string, init?: RequestInit) => Promise<Response>", kind: "method" },
        { name: "addEventListener", detail: "(type: string, fn: Function) => void", kind: "method" },
    ],
    JSON: [
        { name: "parse",     detail: "(text: string) => any",             kind: "method" },
        { name: "stringify",  detail: "(value: any) => string",           kind: "method" },
    ],
    Object: [
        { name: "keys",      detail: "(obj: object) => string[]",         kind: "method" },
        { name: "values",    detail: "(obj: object) => any[]",            kind: "method" },
        { name: "entries",   detail: "(obj: object) => [string, any][]",  kind: "method" },
        { name: "assign",    detail: "(target: object, ...sources: object[]) => object", kind: "method" },
        { name: "freeze",    detail: "(obj: object) => Readonly<object>", kind: "method" },
    ],
    Array: [
        { name: "isArray",   detail: "(arg: any) => boolean",             kind: "method" },
        { name: "from",      detail: "(iterable: Iterable) => any[]",     kind: "method" },
        { name: "of",        detail: "(...items: any[]) => any[]",        kind: "method" },
    ],
    Promise: [
        { name: "all",       detail: "(promises: Promise[]) => Promise",  kind: "method" },
        { name: "race",      detail: "(promises: Promise[]) => Promise",  kind: "method" },
        { name: "resolve",   detail: "(value?: any) => Promise",          kind: "method" },
        { name: "reject",    detail: "(reason?: any) => Promise",         kind: "method" },
        { name: "allSettled", detail: "(promises: Promise[]) => Promise", kind: "method" },
    ],
};

const MOCK_IMPORT_PATHS = [
    { label: "react",            detail: "React library" },
    { label: "react-dom",        detail: "React DOM" },
    { label: "react-router-dom", detail: "React Router" },
    { label: "zustand",          detail: "State management" },
    { label: "axios",            detail: "HTTP client" },
    { label: "lodash",           detail: "Utility library" },
    { label: "zod",              detail: "Schema validation" },
    { label: "date-fns",         detail: "Date utilities" },
];

// ── Mock diagnostics patterns ────────────────────────────────

interface DiagPattern {
    pattern: RegExp;
    message: string;
    severity: Diagnostic["severity"];
}

const DIAG_PATTERNS: DiagPattern[] = [
    { pattern: /\bvar\b/,                    message: "Use 'const' or 'let' instead of 'var'",      severity: "warning" },
    { pattern: /console\.(log|debug)\(/,     message: "Unexpected console statement",               severity: "warning" },
    { pattern: /==(?!=)/,                    message: "Use '===' instead of '=='",                  severity: "warning" },
    { pattern: /!=(?!=)/,                    message: "Use '!==' instead of '!='",                  severity: "warning" },
    { pattern: /\bany\b/,                    message: "Avoid using 'any' type",                     severity: "info" },
    { pattern: /TODO:/i,                     message: "TODO comment found",                          severity: "hint" },
    { pattern: /FIXME:/i,                    message: "FIXME comment found",                         severity: "warning" },
    { pattern: /HACK:/i,                     message: "HACK comment found – consider refactoring",   severity: "warning" },
];

// ── Provider implementation ──────────────────────────────────

class MockIntelliSenseProvider implements CompletionProvider {
    id = "mock-intellisense:provider";
    triggerCharacters = [".", "\"", "'", "/"];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        const beforeCursor = ctx.lineText.slice(0, ctx.column);
        const items: CompletionItem[] = [];

        // ── Property access: "identifier." ───────────────────
        const dotMatch = beforeCursor.match(/(\w+)\.\s*(\w*)$/);
        if (dotMatch) {
            const obj = dotMatch[1];
            const partial = dotMatch[2]?.toLowerCase() ?? "";
            const props = PROPERTY_DB[obj];
            if (props) {
                for (const p of props) {
                    if (!partial || p.name.toLowerCase().startsWith(partial)) {
                        items.push({
                            label: p.name,
                            kind: p.kind,
                            detail: p.detail,
                            insertText: p.name,
                            sortOrder: 0,
                        });
                    }
                }
                return items.slice(0, 20);
            }
        }

        // ── Import path suggestions ─────────────────────────
        const importMatch = beforeCursor.match(/(?:from\s+|import\s+|require\s*\(\s*)["']([^"']*)$/);
        if (importMatch) {
            const partial = importMatch[1].toLowerCase();
            for (const mod of MOCK_IMPORT_PATHS) {
                if (!partial || mod.label.toLowerCase().startsWith(partial)) {
                    items.push({
                        label: mod.label,
                        kind: "module",
                        detail: mod.detail,
                        insertText: mod.label,
                        sortOrder: 0,
                    });
                }
            }
            return items.slice(0, 20);
        }

        // ── Fallback: symbol completions from document ──────
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length < 1) return [];

        const symbolRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]{2,}\b/g;
        const seen = new Set<string>();
        let match: RegExpExecArray | null;
        while ((match = symbolRegex.exec(ctx.content)) !== null) {
            const sym = match[0];
            if (sym.toLowerCase().startsWith(word) && sym.toLowerCase() !== word && !seen.has(sym)) {
                seen.add(sym);
                items.push({
                    label: sym,
                    kind: "variable",
                    detail: "document symbol",
                    insertText: sym,
                    sortOrder: 2,
                });
            }
        }

        return items.slice(0, 20);
    }
}

// ── Diagnostic analysis ──────────────────────────────────────

function analyzeDiagnostics(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const dp of DIAG_PATTERNS) {
            const match = dp.pattern.exec(line);
            if (match) {
                diagnostics.push({
                    id: `mock-diag:${i + 1}:${match.index}`,
                    line: i + 1,
                    startCol: match.index,
                    endCol: match.index + match[0].length,
                    message: dp.message,
                    severity: dp.severity,
                    source: "mock-intellisense",
                });
            }
        }
    }

    return diagnostics;
}

// ── Type hint annotations ────────────────────────────────────

function extractTypeHints(content: string): InlineAnnotation[] {
    const annotations: InlineAnnotation[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // const x = <value>  →  show inferred type hint
        const constMatch = line.match(/^\s*(?:const|let)\s+(\w+)\s*=\s*(.+)/);
        if (constMatch) {
            const value = constMatch[2].trim().replace(/;$/, "");
            let inferredType = "";
            if (/^["'`]/.test(value))                    inferredType = ": string";
            else if (/^\d+$/.test(value))                inferredType = ": number";
            else if (/^\d+\.\d+$/.test(value))           inferredType = ": number";
            else if (/^(true|false)$/.test(value))       inferredType = ": boolean";
            else if (/^\[/.test(value))                  inferredType = ": array";
            else if (/^\{/.test(value))                  inferredType = ": object";
            else if (/^null$/.test(value))               inferredType = ": null";
            else if (/^undefined$/.test(value))          inferredType = ": undefined";

            if (inferredType) {
                annotations.push({
                    id: `mock-type-hint:${i + 1}`,
                    line: i + 1,
                    col: line.length,
                    text: `  ${inferredType}`,
                    style: { color: "var(--editor-muted, #6272a4)", fontStyle: "italic", opacity: 0.7 },
                });
            }
        }
    }

    return annotations;
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN FACTORY
// ═══════════════════════════════════════════════════════════════

export function createMockIntelliSensePlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "mock-intellisense",
        name: "Mock IntelliSense",
        version: "1.0.0",
        description: "Smart context-aware completions, diagnostics, and type hints (no backend required)",
        category: "language",
        defaultEnabled: true,

        completionProviders: [new MockIntelliSenseProvider()],

        onActivate(api) {
            // Run initial analysis
            const content = api.getContent();
            updateAnalysis(content, api);
            api.showToast("Mock IntelliSense", "Diagnostics & smart completions active", "default");
        },

        onContentChange(content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => updateAnalysis(content, api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("mock-intellisense");
            api.clearInlineAnnotations("mock-intellisense");
        },
    };
}

function updateAnalysis(content: string, api: ExtendedPluginAPI) {
    // Clear stale diagnostics before setting new ones
    // This ensures removed lines don't leave ghost diagnostics behind
    api.clearDiagnostics("mock-intellisense");
    const diagnostics = analyzeDiagnostics(content);
    api.setDiagnostics(diagnostics);

    // Clear stale annotations before setting new ones
    api.clearInlineAnnotations("mock-intellisense");
    const annotations = extractTypeHints(content);
    api.setInlineAnnotations(annotations);
}
