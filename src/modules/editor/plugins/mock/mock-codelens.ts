/**
 * @module editor/plugins/mock/mock-codelens
 *
 * Mock CodeLens Plugin.
 *
 * Detects structural symbols (functions, classes, interfaces, types)
 * in the current file and renders CodeLens items above them showing:
 *   - Reference count
 *   - "Run" action (for functions)
 *   - "Peek" action
 *   - "AI Explain" action
 *
 * All actions show a toast – no real backend is involved.
 *
 * Demonstrates:
 *   - `onActivate` / `onContentChange` / `onLanguageChange` life-cycle
 *   - `setCodeLenses` / `clearCodeLenses` API
 *   - CodeLensItem with onClick handlers
 *
 * Usage:
 * ```ts
 * import { createMockCodeLensPlugin } from "./plugins/mock";
 * <FileEditor plugins={[createMockCodeLensPlugin()]} … />
 * ```
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, CodeLensItem } from "../types";

// ── Symbol detection ─────────────────────────────────────────

interface DetectedSymbol {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable";
    line: number;
}

function detectSymbols(content: string, language: string): DetectedSymbol[] {
    const symbols: DetectedSymbol[] = [];
    const lines = content.split("\n");
    const lang = language.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNum = i + 1;

        // JavaScript / TypeScript
        if (["javascript", "typescript", "jsx", "tsx"].includes(lang)) {
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
        }

        // Python
        if (lang === "python") {
            let m = line.match(/^(?:async\s+)?def\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum }); continue; }
            m = line.match(/^class\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", line: lineNum }); }
        }

        // Go
        if (lang === "go") {
            let m = line.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum }); continue; }
            m = line.match(/^type\s+(\w+)\s+(?:struct|interface)/);
            if (m) { symbols.push({ name: m[1], kind: "class", line: lineNum }); }
        }

        // Rust
        if (lang === "rust") {
            let m = line.match(/^(?:pub\s+)?fn\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum }); continue; }
            m = line.match(/^(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", line: lineNum }); }
        }
    }

    return symbols;
}

function countRefs(content: string, name: string): number {
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const matches = content.match(regex);
    return Math.max((matches?.length ?? 0) - 1, 0); // exclude the definition
}

// ── Build lenses ─────────────────────────────────────────────

function buildLenses(content: string, language: string, api: ExtendedPluginAPI): CodeLensItem[] {
    const symbols = detectSymbols(content, language);
    const lenses: CodeLensItem[] = [];

    for (const sym of symbols) {
        const refCount = countRefs(content, sym.name);

        // References
        lenses.push({
            id: `mock-cl:ref:${sym.line}`,
            line: sym.line,
            command: "showReferences",
            title: `${refCount} reference${refCount !== 1 ? "s" : ""}`,
            tooltip: `${sym.name} has ${refCount} reference${refCount !== 1 ? "s" : ""}`,
            onClick: () => {
                api.showToast("References", `${sym.name}: ${refCount} reference${refCount !== 1 ? "s" : ""}`, "default");
            },
        });

        // Run (for functions)
        if (sym.kind === "function" || sym.kind === "method") {
            lenses.push({
                id: `mock-cl:run:${sym.line}`,
                line: sym.line,
                command: "runFunction",
                title: "▶ Run",
                tooltip: `Run ${sym.name}()`,
                onClick: () => {
                    api.showToast("Run", `Mock-executing ${sym.name}() … ✓ Done`, "default");
                },
            });
        }

        // Peek
        lenses.push({
            id: `mock-cl:peek:${sym.line}`,
            line: sym.line,
            command: "peekDefinition",
            title: "peek",
            tooltip: `Peek definition of ${sym.name}`,
            onClick: () => {
                api.showToast("Peek", `Viewing ${sym.kind} "${sym.name}" at line ${sym.line}`, "default");
            },
        });

        // AI Explain
        lenses.push({
            id: `mock-cl:ai:${sym.line}`,
            line: sym.line,
            command: "aiExplain",
            title: "✦ AI Explain",
            tooltip: `Ask AI to explain ${sym.name}`,
            onClick: () => {
                api.showToast(
                    "AI Explain",
                    `Mock AI: "${sym.name}" is a ${sym.kind} that does something really cool…`,
                    "default",
                );
            },
        });
    }

    return lenses;
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN FACTORY
// ═══════════════════════════════════════════════════════════════

const LANG_MAP: Record<string, string> = {
    "JavaScript": "javascript", "JavaScript (JSX)": "javascript",
    "TypeScript": "typescript", "TypeScript (TSX)": "typescript",
    "Python": "python", "Go": "go", "Rust": "rust",
};

export function createMockCodeLensPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "mock-codelens",
        name: "Mock Code Lens",
        version: "1.0.0",
        description: "Shows references, run, peek, and AI explain actions above symbols (no backend)",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            const content = api.getContent();
            const { language } = api.getFileInfo();
            refresh(content, language, api);
            api.showToast("Mock CodeLens", "CodeLens items active above functions & classes", "default");
        },

        onContentChange(content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const { language } = api.getFileInfo();
                refresh(content, language, api);
            }, 600);
        },

        onLanguageChange(language, api) {
            const content = api.getContent();
            refresh(content, language, api);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearCodeLenses("mock-codelens");
        },
    };
}

function refresh(content: string, language: string, api: ExtendedPluginAPI) {
    const lang = LANG_MAP[language] ?? language.toLowerCase();
    const lenses = buildLenses(content, lang, api);
    api.setCodeLenses(lenses);
}
