/**
 * @module editor/plugins/builtin/code-folding
 *
 * Detects foldable code regions (functions, classes, blocks, imports)
 * and provides folding ranges to the editor overlay.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, FoldingRange } from "../types";

function detectFoldingRanges(content: string, language: string): FoldingRange[] {
    const ranges: FoldingRange[] = [];
    const lines = content.split("\n");
    const lang = language.toLowerCase();
    const bracketStack: Array<{ line: number; kind: FoldingRange["kind"] }> = [];
    let idCounter = 0;

    // Import block detection
    let importStart = -1;
    let importEnd = -1;

    // Comment block detection
    let commentStart = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;

        // Multi-line comment blocks
        if (trimmed.startsWith("/*") || trimmed.startsWith("/**")) {
            commentStart = lineNum;
        }
        if (commentStart > 0 && trimmed.endsWith("*/")) {
            if (lineNum > commentStart) {
                ranges.push({
                    id: `code-folding:${idCounter++}`,
                    startLine: commentStart,
                    endLine: lineNum,
                    kind: "comment",
                    collapsedText: "/* ... */",
                });
            }
            commentStart = -1;
        }

        // Python comment blocks (#)
        if (lang === "python" && trimmed.startsWith("#")) {
            if (commentStart < 0) commentStart = lineNum;
        } else if (lang === "python" && commentStart > 0 && !trimmed.startsWith("#")) {
            if (lineNum - 1 > commentStart) {
                ranges.push({
                    id: `code-folding:${idCounter++}`,
                    startLine: commentStart,
                    endLine: lineNum - 1,
                    kind: "comment",
                    collapsedText: "# ...",
                });
            }
            commentStart = -1;
        }

        // Import blocks
        if (trimmed.startsWith("import ") || trimmed.startsWith("from ") || trimmed.startsWith("require(")) {
            if (importStart < 0) importStart = lineNum;
            importEnd = lineNum;
        } else if (importStart > 0 && trimmed.length > 0) {
            if (importEnd > importStart) {
                ranges.push({
                    id: `code-folding:${idCounter++}`,
                    startLine: importStart,
                    endLine: importEnd,
                    kind: "import",
                    collapsedText: "import ...",
                });
            }
            importStart = -1;
        }

        // Brace-based folding for JS-like languages
        if (["javascript", "typescript", "jsx", "tsx", "java", "csharp", "go", "rust", "c", "cpp"].includes(lang)) {
            let kind: FoldingRange["kind"] = "block";
            if (trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s/)) kind = "function";
            else if (trimmed.match(/^(?:export\s+)?class\s/)) kind = "class";
            else if (trimmed.match(/^if\s*\(/)) kind = "if";
            else if (trimmed.match(/^for\s*\(/)) kind = "for";
            else if (trimmed.match(/^while\s*\(/)) kind = "while";
            else if (trimmed.match(/^switch\s*\(/)) kind = "switch";
            else if (trimmed.match(/^try\s*\{/)) kind = "try";

            for (const ch of line) {
                if (ch === "{") {
                    bracketStack.push({ line: lineNum, kind });
                } else if (ch === "}") {
                    const open = bracketStack.pop();
                    if (open && lineNum > open.line) {
                        ranges.push({
                            id: `code-folding:${idCounter++}`,
                            startLine: open.line,
                            endLine: lineNum,
                            kind: open.kind,
                            collapsedText: "{ ... }",
                        });
                    }
                }
            }
        }
    }

    return ranges;
}

export function createCodeFoldingPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "code-folding",
        name: "Code Folding",
        version: "1.0.0",
        description: "Detects foldable regions (functions, classes, blocks, imports, comments)",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            const content = api.getContent();
            const { language } = api.getFileInfo();
            update(content, language, api);
        },

        onContentChange(content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const { language } = api.getFileInfo();
                update(content, language, api);
            }, 600);
        },

        onLanguageChange(language, api) {
            const content = api.getContent();
            update(content, language, api);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearFoldingRanges("code-folding");
        },
    };
}

function update(content: string, language: string, api: ExtendedPluginAPI) {
    const langMap: Record<string, string> = {
        "JavaScript": "javascript", "TypeScript": "typescript",
        "Python": "python", "Go": "go", "Rust": "rust",
    };
    const lang = langMap[language] ?? language.toLowerCase();
    const ranges = detectFoldingRanges(content, lang);
    api.setFoldingRanges(ranges);
}
