/**
 * @module editor/plugins/builtin/inline-annotations
 *
 * Inline annotations plugin.
 * Adds ghost text annotations after certain lines, such as:
 * - Type information hints
 * - Variable value previews
 * - Return type annotations
 * - Parameter count info
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

function computeAnnotations(content: string, language: string): InlineAnnotation[] {
    const annotations: InlineAnnotation[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;

        if (["javascript", "typescript", "jsx", "tsx"].includes(language)) {
            // Function parameter count
            let m = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+\w+\(([^)]*)\)/);
            if (m) {
                const params = m[1].split(",").filter((p) => p.trim()).length;
                annotations.push({
                    id: `inline-annotations:fn:${lineNum}`,
                    line: lineNum,
                    text: `  ${params} param${params !== 1 ? "s" : ""}`,
                    className: "editor-inline-annotation",
                    style: { opacity: 0.5, fontStyle: "italic" },
                });
                continue;
            }

            // Arrow function parameter count
            m = trimmed.match(/(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/);
            if (m) {
                const params = m[1].split(",").filter((p) => p.trim()).length;
                annotations.push({
                    id: `inline-annotations:arrow:${lineNum}`,
                    line: lineNum,
                    text: `  ${params} param${params !== 1 ? "s" : ""}`,
                    className: "editor-inline-annotation",
                    style: { opacity: 0.5, fontStyle: "italic" },
                });
                continue;
            }

            // TODO comments
            if (trimmed.match(/\/\/\s*TODO/i) || trimmed.match(/\/\/\s*FIXME/i) || trimmed.match(/\/\/\s*HACK/i)) {
                const tag = trimmed.match(/\/\/\s*(TODO|FIXME|HACK)/i)?.[1]?.toUpperCase();
                annotations.push({
                    id: `inline-annotations:todo:${lineNum}`,
                    line: lineNum,
                    text: `  ⚠ ${tag}`,
                    className: "editor-inline-annotation editor-inline-annotation-warning",
                    style: { opacity: 0.7, color: "var(--editor-warning, #f1fa8c)" },
                });
                continue;
            }

            // Import count
            if (trimmed.startsWith("import ") && trimmed.includes("from")) {
                const namedMatch = trimmed.match(/\{([^}]+)\}/);
                if (namedMatch) {
                    const count = namedMatch[1].split(",").filter((p) => p.trim()).length;
                    annotations.push({
                        id: `inline-annotations:import:${lineNum}`,
                        line: lineNum,
                        text: `  ${count} import${count !== 1 ? "s" : ""}`,
                        className: "editor-inline-annotation",
                        style: { opacity: 0.4, fontStyle: "italic" },
                    });
                }
            }
        }

        if (language === "python") {
            // Function parameter count
            let m = trimmed.match(/^(?:async\s+)?def\s+\w+\(([^)]*)\)/);
            if (m) {
                const params = m[1].split(",").filter((p) => p.trim() && p.trim() !== "self" && p.trim() !== "cls").length;
                annotations.push({
                    id: `inline-annotations:pyfn:${lineNum}`,
                    line: lineNum,
                    text: `  ${params} param${params !== 1 ? "s" : ""}`,
                    className: "editor-inline-annotation",
                    style: { opacity: 0.5, fontStyle: "italic" },
                });
                continue;
            }

            // TODO/FIXME comments
            if (trimmed.match(/#\s*TODO/i) || trimmed.match(/#\s*FIXME/i)) {
                const tag = trimmed.match(/#\s*(TODO|FIXME)/i)?.[1]?.toUpperCase();
                annotations.push({
                    id: `inline-annotations:pytodo:${lineNum}`,
                    line: lineNum,
                    text: `  ⚠ ${tag}`,
                    className: "editor-inline-annotation editor-inline-annotation-warning",
                    style: { opacity: 0.7, color: "var(--editor-warning, #f1fa8c)" },
                });
            }
        }

        // Generic: line length warning
        if (line.length > 120) {
            annotations.push({
                id: `inline-annotations:long:${lineNum}`,
                line: lineNum,
                text: `  ← ${line.length} chars`,
                className: "editor-inline-annotation editor-inline-annotation-info",
                style: { opacity: 0.4, fontStyle: "italic" },
            });
        }
    }

    return annotations;
}

export function createInlineAnnotationsPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "inline-annotations",
        name: "Inline Annotations",
        version: "1.0.0",
        description: "Ghost text annotations showing parameter counts, TODOs, and line length warnings",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            const content = api.getContent();
            const { language } = api.getFileInfo();
            updateAnnotations(content, language, api);
        },

        onContentChange(content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const { language } = api.getFileInfo();
                updateAnnotations(content, language, api);
            }, 600);
        },

        onLanguageChange(language, api) {
            const content = api.getContent();
            updateAnnotations(content, language, api);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineAnnotations("inline-annotations");
        },
    };
}

function updateAnnotations(content: string, language: string, api: ExtendedPluginAPI) {
    const langMap: Record<string, string> = {
        "JavaScript": "javascript", "JavaScript (JSX)": "javascript",
        "TypeScript": "typescript", "TypeScript (TSX)": "typescript",
        "Python": "python", "Go": "go", "Rust": "rust",
    };
    const lang = langMap[language] ?? language.toLowerCase();
    const annotations = computeAnnotations(content, lang);
    api.setInlineAnnotations(annotations);
}
