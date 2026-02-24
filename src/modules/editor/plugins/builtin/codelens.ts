/**
 * @module editor/plugins/builtin/codelens
 *
 * CodeLens plugin.
 * Detects functions, classes, and other structural elements in the code
 * and adds CodeLens items above them (e.g. "references", "run", "debug").
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, CodeLensItem } from "../types";

interface DetectedSymbol {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "struct" | "enum";
    line: number;
}

function detectSymbols(content: string, language: string): DetectedSymbol[] {
    const symbols: DetectedSymbol[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNum = i + 1;

        if (["javascript", "typescript", "jsx", "tsx"].includes(language)) {
            let m = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum }); continue; }

            m = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$]\w*)\s*=>/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum }); continue; }

            m = line.match(/^(?:export\s+)?class\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", line: lineNum }); continue; }

            m = line.match(/^(?:export\s+)?interface\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "interface", line: lineNum }); continue; }

            m = line.match(/^(?:export\s+)?type\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "type", line: lineNum }); continue; }

            // Class methods
            m = line.match(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/);
            if (m && !["if", "for", "while", "switch", "function", "catch", "constructor"].includes(m[1])) {
                symbols.push({ name: m[1], kind: "method", line: lineNum });
            }
        }

        if (language === "python") {
            let m = line.match(/^(?:async\s+)?def\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum }); continue; }
            m = line.match(/^class\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", line: lineNum }); }
        }

        if (language === "go") {
            let m = line.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum }); continue; }
            m = line.match(/^type\s+(\w+)\s+struct/);
            if (m) { symbols.push({ name: m[1], kind: "struct", line: lineNum }); continue; }
            m = line.match(/^type\s+(\w+)\s+interface/);
            if (m) { symbols.push({ name: m[1], kind: "interface", line: lineNum }); }
        }

        if (language === "rust") {
            let m = line.match(/^(?:pub\s+)?fn\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum }); continue; }
            m = line.match(/^(?:pub\s+)?struct\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "struct", line: lineNum }); continue; }
            m = line.match(/^(?:pub\s+)?enum\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "enum", line: lineNum }); continue; }
            m = line.match(/^(?:pub\s+)?trait\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "interface", line: lineNum }); }
        }
    }

    return symbols;
}

function countReferences(content: string, name: string): number {
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const matches = content.match(regex);
    return (matches?.length ?? 0) - 1; // Exclude the definition itself
}

function computeLenses(content: string, language: string, api: ExtendedPluginAPI): CodeLensItem[] {
    const symbols = detectSymbols(content, language);
    const lenses: CodeLensItem[] = [];

    for (const sym of symbols) {
        const refCount = countReferences(content, sym.name);

        // References lens
        lenses.push({
            id: `codelens:ref:${sym.line}`,
            line: sym.line,
            command: "showReferences",
            title: `${refCount} reference${refCount !== 1 ? "s" : ""}`,
            tooltip: `${sym.name} has ${refCount} reference${refCount !== 1 ? "s" : ""}`,
            onClick: () => {
                api.showToast("References", `${sym.name}: ${refCount} reference${refCount !== 1 ? "s" : ""}`, "default");
            },
        });

        // Type-specific lenses
        if (sym.kind === "function" || sym.kind === "method") {
            lenses.push({
                id: `codelens:peek:${sym.line}`,
                line: sym.line,
                command: "peekDefinition",
                title: "peek",
                tooltip: `Peek definition of ${sym.name}`,
                onClick: () => {
                    // Scroll to the function
                    api.showToast("Peek", `Viewing ${sym.name}`, "default");
                },
            });
        }
    }

    return lenses;
}

export function createCodeLensPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "codelens",
        name: "Code Lens",
        version: "1.0.0",
        description: "Shows references and actions above functions, classes, and types",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            const content = api.getContent();
            const { language } = api.getFileInfo();
            updateLenses(content, language, api);
        },

        onContentChange(content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const { language } = api.getFileInfo();
                updateLenses(content, language, api);
            }, 800);
        },

        onLanguageChange(language, api) {
            const content = api.getContent();
            updateLenses(content, language, api);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearCodeLenses("codelens");
        },
    };
}

function updateLenses(content: string, language: string, api: ExtendedPluginAPI) {
    const langMap: Record<string, string> = {
        "JavaScript": "javascript", "JavaScript (JSX)": "javascript",
        "TypeScript": "typescript", "TypeScript (TSX)": "typescript",
        "Python": "python", "Go": "go", "Rust": "rust",
    };
    const lang = langMap[language] ?? language.toLowerCase();
    const lenses = computeLenses(content, lang, api);
    api.setCodeLenses(lenses);
}
