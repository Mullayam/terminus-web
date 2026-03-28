/**
 * @module editor/plugins/builtin/import-sorter
 *
 * Sorts and groups import statements by type.
 */
import type { ExtendedEditorPlugin } from "../types";

const JS_LANGUAGES = new Set([
    "javascript", "typescript", "jsx", "tsx",
]);

function normalizeLanguage(lang: string): string {
    const map: Record<string, string> = {
        "JavaScript": "javascript", "TypeScript": "typescript",
        "JavaScript (JSX)": "jsx", "TypeScript (TSX)": "tsx",
    };
    return map[lang] ?? lang.toLowerCase();
}

interface ImportLine {
    text: string;
    source: string;
    isType: boolean;
    isDefault: boolean;
}

function parseImport(line: string): ImportLine | null {
    const m = line.match(/^import\s+(.+)\s+from\s+['"]([^'"]+)['"]/);
    if (!m) return null;
    return {
        text: line,
        source: m[2],
        isType: line.includes("import type"),
        isDefault: !line.includes("{"),
    };
}

function getImportGroup(source: string): number {
    if (source.startsWith("react")) return 0;
    if (!source.startsWith(".") && !source.startsWith("@/")) return 1; // node_modules
    if (source.startsWith("@/")) return 2; // absolute aliases
    if (source.startsWith("..")) return 3; // parent
    return 4; // relative
}

function sortImports(content: string): string {
    const lines = content.split("\n");
    let importStart = -1;
    let importEnd = -1;
    const imports: ImportLine[] = [];

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith("import ")) {
            if (importStart < 0) importStart = i;
            importEnd = i;
            const parsed = parseImport(trimmed);
            if (parsed) imports.push(parsed);
        } else if (importStart >= 0 && trimmed.length > 0 && !trimmed.startsWith("//")) {
            break;
        }
    }

    if (imports.length < 2) return content;

    // Sort: by group, then alphabetically
    imports.sort((a, b) => {
        const ga = getImportGroup(a.source);
        const gb = getImportGroup(b.source);
        if (ga !== gb) return ga - gb;
        return a.source.localeCompare(b.source);
    });

    // Add blank lines between groups
    const sortedLines: string[] = [];
    let lastGroup = -1;
    for (const imp of imports) {
        const group = getImportGroup(imp.source);
        if (lastGroup >= 0 && group !== lastGroup) {
            sortedLines.push("");
        }
        sortedLines.push(imp.text);
        lastGroup = group;
    }

    const before = lines.slice(0, importStart);
    const after = lines.slice(importEnd + 1);
    return [...before, ...sortedLines, ...after].join("\n");
}

export function createImportSorterPlugin(): ExtendedEditorPlugin {
    return {
        id: "import-sorter",
        name: "Import Sorter",
        version: "1.0.0",
        description: "Sorts and groups import statements by type (react, npm, aliases, relative)",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("imports.sort", () => {
                const { language } = api.getFileInfo();
                if (!JS_LANGUAGES.has(normalizeLanguage(language))) return;
                const content = api.getContent();
                const sorted = sortImports(content);
                if (sorted !== content) {
                    api.setContent(sorted);
                    api.showToast("Imports", "Imports sorted", "default");
                }
            });

            api.addContextMenuItem({
                label: "Sort Imports",
                action: () => api.executeCommand("imports.sort"),
                priority: 55,
            });
        },

        onSave(_content, api) {
            const { language } = api.getFileInfo();
            if (!JS_LANGUAGES.has(normalizeLanguage(language))) return;
            const content = api.getContent();
            const sorted = sortImports(content);
            if (sorted !== content) {
                api.setContent(sorted);
            }
        },
    };
}
