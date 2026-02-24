/**
 * @module editor/plugins/builtin/intellisense
 *
 * IntelliSense-style suggestions plugin.
 * Provides smart, context-aware completions that go beyond simple word matching:
 * - Property access after "."
 * - Import path suggestions
 * - Function signature hints
 * - Type-aware completions based on document analysis
 */
import type { ExtendedEditorPlugin, CompletionProvider, CompletionItem, CompletionContext } from "../types";

// ── Detect functions / variables / classes in document ────────

interface SymbolInfo {
    name: string;
    kind: CompletionItem["kind"];
    detail?: string;
}

function extractSymbols(content: string, language: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();

        // JavaScript/TypeScript patterns
        if (["javascript", "typescript", "jsx", "tsx"].includes(language)) {
            // Function declarations
            let m = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", detail: "function" }); continue; }

            // Arrow functions
            m = trimmed.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
            if (m) { symbols.push({ name: m[1], kind: "function", detail: "arrow function" }); continue; }

            // Class declarations
            m = trimmed.match(/(?:export\s+)?class\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", detail: "class" }); continue; }

            // Interface / Type
            m = trimmed.match(/(?:export\s+)?(?:interface|type)\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", detail: "type" }); continue; }

            // Variable declarations
            m = trimmed.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]/);
            if (m && !trimmed.includes("=>") && !trimmed.includes("function")) {
                symbols.push({ name: m[1], kind: "variable", detail: "variable" });
            }

            // Method definitions
            m = trimmed.match(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/);
            if (m && !["if", "for", "while", "switch", "function", "catch"].includes(m[1])) {
                symbols.push({ name: m[1], kind: "method", detail: "method" });
            }
        }

        // Python patterns
        if (language === "python") {
            let m = trimmed.match(/^def\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", detail: "function" }); continue; }
            m = trimmed.match(/^class\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", detail: "class" }); continue; }
            m = trimmed.match(/^(\w+)\s*=/);
            if (m) { symbols.push({ name: m[1], kind: "variable", detail: "variable" }); }
        }

        // Go patterns
        if (language === "go") {
            let m = trimmed.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", detail: "function" }); continue; }
            m = trimmed.match(/^type\s+(\w+)\s+struct/);
            if (m) { symbols.push({ name: m[1], kind: "class", detail: "struct" }); continue; }
            m = trimmed.match(/^type\s+(\w+)\s+interface/);
            if (m) { symbols.push({ name: m[1], kind: "class", detail: "interface" }); continue; }
        }

        // Rust patterns
        if (language === "rust") {
            let m = trimmed.match(/^(?:pub\s+)?fn\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", detail: "function" }); continue; }
            m = trimmed.match(/^(?:pub\s+)?struct\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", detail: "struct" }); continue; }
            m = trimmed.match(/^(?:pub\s+)?enum\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", detail: "enum" }); continue; }
            m = trimmed.match(/^(?:pub\s+)?trait\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", detail: "trait" }); }
        }
    }

    // Deduplicate
    const seen = new Set<string>();
    return symbols.filter((s) => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
    });
}

// ── Property access suggestions ──────────────────────────────

const COMMON_PROPERTIES: Record<string, Array<{ name: string; detail: string }>> = {
    console: [
        { name: "log", detail: "(...data: any[]) => void" },
        { name: "error", detail: "(...data: any[]) => void" },
        { name: "warn", detail: "(...data: any[]) => void" },
        { name: "info", detail: "(...data: any[]) => void" },
        { name: "debug", detail: "(...data: any[]) => void" },
        { name: "table", detail: "(data: any) => void" },
        { name: "time", detail: "(label?: string) => void" },
        { name: "timeEnd", detail: "(label?: string) => void" },
        { name: "group", detail: "(...label: any[]) => void" },
        { name: "groupEnd", detail: "() => void" },
        { name: "clear", detail: "() => void" },
        { name: "assert", detail: "(condition?: boolean, ...data: any[]) => void" },
        { name: "count", detail: "(label?: string) => void" },
        { name: "dir", detail: "(item?: any) => void" },
        { name: "trace", detail: "(...data: any[]) => void" },
    ],
    Math: [
        { name: "abs", detail: "(x: number) => number" },
        { name: "ceil", detail: "(x: number) => number" },
        { name: "floor", detail: "(x: number) => number" },
        { name: "round", detail: "(x: number) => number" },
        { name: "max", detail: "(...values: number[]) => number" },
        { name: "min", detail: "(...values: number[]) => number" },
        { name: "random", detail: "() => number" },
        { name: "sqrt", detail: "(x: number) => number" },
        { name: "pow", detail: "(base: number, exp: number) => number" },
        { name: "PI", detail: "3.141592653589793" },
    ],
    JSON: [
        { name: "parse", detail: "(text: string) => any" },
        { name: "stringify", detail: "(value: any, replacer?, space?) => string" },
    ],
    Object: [
        { name: "keys", detail: "(o: object) => string[]" },
        { name: "values", detail: "(o: object) => any[]" },
        { name: "entries", detail: "(o: object) => [string, any][]" },
        { name: "assign", detail: "(target: any, ...sources: any[]) => any" },
        { name: "freeze", detail: "(o: any) => any" },
        { name: "create", detail: "(proto: object | null) => any" },
        { name: "defineProperty", detail: "(o: any, p: string, attributes: PropertyDescriptor) => any" },
        { name: "hasOwnProperty", detail: "(v: string) => boolean" },
    ],
    Array: [
        { name: "from", detail: "(arrayLike: any) => any[]" },
        { name: "isArray", detail: "(arg: any) => boolean" },
        { name: "of", detail: "(...items: any[]) => any[]" },
    ],
    Promise: [
        { name: "all", detail: "(values: Promise[]) => Promise" },
        { name: "race", detail: "(values: Promise[]) => Promise" },
        { name: "resolve", detail: "(value?: any) => Promise" },
        { name: "reject", detail: "(reason?: any) => Promise" },
        { name: "allSettled", detail: "(values: Promise[]) => Promise" },
    ],
    document: [
        { name: "getElementById", detail: "(id: string) => Element | null" },
        { name: "querySelector", detail: "(selectors: string) => Element | null" },
        { name: "querySelectorAll", detail: "(selectors: string) => NodeList" },
        { name: "createElement", detail: "(tagName: string) => Element" },
        { name: "createTextNode", detail: "(data: string) => Text" },
        { name: "addEventListener", detail: "(type: string, listener: Function) => void" },
        { name: "body", detail: "HTMLBodyElement" },
        { name: "head", detail: "HTMLHeadElement" },
        { name: "title", detail: "string" },
    ],
};

// Array instance methods
const ARRAY_METHODS = [
    { name: "push", detail: "(...items: T[]) => number" },
    { name: "pop", detail: "() => T | undefined" },
    { name: "shift", detail: "() => T | undefined" },
    { name: "unshift", detail: "(...items: T[]) => number" },
    { name: "map", detail: "(fn: (v: T, i: number) => U) => U[]" },
    { name: "filter", detail: "(fn: (v: T) => boolean) => T[]" },
    { name: "reduce", detail: "(fn: (acc, v: T) => U, init: U) => U" },
    { name: "forEach", detail: "(fn: (v: T, i: number) => void) => void" },
    { name: "find", detail: "(fn: (v: T) => boolean) => T | undefined" },
    { name: "findIndex", detail: "(fn: (v: T) => boolean) => number" },
    { name: "includes", detail: "(v: T) => boolean" },
    { name: "indexOf", detail: "(v: T) => number" },
    { name: "join", detail: "(sep?: string) => string" },
    { name: "slice", detail: "(start?: number, end?: number) => T[]" },
    { name: "splice", detail: "(start: number, count?: number) => T[]" },
    { name: "sort", detail: "(fn?: (a: T, b: T) => number) => T[]" },
    { name: "reverse", detail: "() => T[]" },
    { name: "concat", detail: "(...items: T[]) => T[]" },
    { name: "flat", detail: "(depth?: number) => T[]" },
    { name: "flatMap", detail: "(fn: (v: T) => U[]) => U[]" },
    { name: "every", detail: "(fn: (v: T) => boolean) => boolean" },
    { name: "some", detail: "(fn: (v: T) => boolean) => boolean" },
    { name: "length", detail: "number" },
];

// String instance methods
const STRING_METHODS = [
    { name: "length", detail: "number" },
    { name: "charAt", detail: "(pos: number) => string" },
    { name: "charCodeAt", detail: "(index: number) => number" },
    { name: "includes", detail: "(search: string) => boolean" },
    { name: "indexOf", detail: "(search: string) => number" },
    { name: "lastIndexOf", detail: "(search: string) => number" },
    { name: "match", detail: "(regexp: RegExp) => RegExpMatchArray | null" },
    { name: "replace", detail: "(search: string | RegExp, replace: string) => string" },
    { name: "replaceAll", detail: "(search: string, replace: string) => string" },
    { name: "slice", detail: "(start?: number, end?: number) => string" },
    { name: "split", detail: "(separator: string) => string[]" },
    { name: "startsWith", detail: "(search: string) => boolean" },
    { name: "endsWith", detail: "(search: string) => boolean" },
    { name: "toLowerCase", detail: "() => string" },
    { name: "toUpperCase", detail: "() => string" },
    { name: "trim", detail: "() => string" },
    { name: "trimStart", detail: "() => string" },
    { name: "trimEnd", detail: "() => string" },
    { name: "padStart", detail: "(maxLength: number, fillString?: string) => string" },
    { name: "padEnd", detail: "(maxLength: number, fillString?: string) => string" },
    { name: "repeat", detail: "(count: number) => string" },
    { name: "substring", detail: "(start: number, end?: number) => string" },
];

class IntelliSenseProvider implements CompletionProvider {
    id = "intellisense:smart";
    triggerCharacters = [".", "(", '"', "'", "/", "@"];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        const items: CompletionItem[] = [];

        // Property access: detect "identifier." pattern
        const beforeCursor = ctx.lineText.slice(0, ctx.column);
        const dotMatch = beforeCursor.match(/(\w+)\.\s*(\w*)$/);
        
        if (dotMatch) {
            const obj = dotMatch[1];
            const partial = dotMatch[2]?.toLowerCase() ?? "";
            
            // Check known objects
            const props = COMMON_PROPERTIES[obj];
            if (props) {
                for (const p of props) {
                    if (!partial || p.name.toLowerCase().startsWith(partial)) {
                        items.push({
                            label: p.name,
                            kind: p.detail.includes("=>") ? "method" : "property",
                            detail: p.detail,
                            insertText: p.name,
                            sortOrder: 0,
                        });
                    }
                }
            }

            // Heuristic: if variable looks like array, suggest array methods
            // Check for patterns like `const x = [`, `x = []`, etc. in document
            const arrayPattern = new RegExp(`(?:const|let|var)\\s+${obj}\\s*(?::\\s*\\w+\\[\\])?\\s*=\\s*\\[`, "m");
            if (arrayPattern.test(ctx.content)) {
                for (const m of ARRAY_METHODS) {
                    if (!partial || m.name.toLowerCase().startsWith(partial)) {
                        items.push({
                            label: m.name,
                            kind: typeof m.detail === "string" && m.detail.includes("=>") ? "method" : "property",
                            detail: m.detail,
                            insertText: m.name,
                            sortOrder: 1,
                        });
                    }
                }
            }

            // Heuristic: if variable looks like string, suggest string methods
            const stringPattern = new RegExp(`(?:const|let|var)\\s+${obj}\\s*(?::\\s*string)?\\s*=\\s*["'\`]`, "m");
            if (stringPattern.test(ctx.content)) {
                for (const m of STRING_METHODS) {
                    if (!partial || m.name.toLowerCase().startsWith(partial)) {
                        items.push({
                            label: m.name,
                            kind: typeof m.detail === "string" && m.detail.includes("=>") ? "method" : "property",
                            detail: m.detail,
                            insertText: m.name,
                            sortOrder: 1,
                        });
                    }
                }
            }

            if (items.length > 0) return items;
        }

        // Symbol completions from document
        const symbols = extractSymbols(ctx.content, ctx.language);
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length >= 1) {
            for (const sym of symbols) {
                if (sym.name.toLowerCase().startsWith(word) && sym.name.toLowerCase() !== word) {
                    items.push({
                        label: sym.name,
                        kind: sym.kind,
                        detail: sym.detail ?? "",
                        insertText: sym.name,
                        sortOrder: 1,
                    });
                }
            }
        }

        return items.slice(0, 50);
    }
}

export function createIntelliSensePlugin(): ExtendedEditorPlugin {
    return {
        id: "intellisense",
        name: "IntelliSense Suggestions",
        version: "1.0.0",
        description: "Smart, context-aware code suggestions with property access and symbol detection",
        category: "editor",
        defaultEnabled: true,

        completionProviders: [new IntelliSenseProvider()],
    };
}
