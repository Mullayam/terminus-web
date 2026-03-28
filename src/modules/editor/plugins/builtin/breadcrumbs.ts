/**
 * @module editor/plugins/builtin/breadcrumbs
 *
 * Shows a breadcrumb trail of the current scope
 * (file > class > function > block).
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

interface Scope {
    name: string;
    kind: "file" | "class" | "function" | "method" | "block";
    startLine: number;
    endLine: number;
}

function detectScopes(content: string, language: string): Scope[] {
    const scopes: Scope[] = [];
    const lines = content.split("\n");
    const bracketStack: Array<{ name: string; kind: Scope["kind"]; startLine: number }> = [];

    const isJsLike = ["javascript", "typescript", "jsx", "tsx", "java", "csharp", "go", "rust", "c", "cpp"].includes(language);
    const isPython = language === "python";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;

        if (isJsLike) {
            let m = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
            if (m) { bracketStack.push({ name: m[1], kind: "function", startLine: lineNum }); }

            m = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
            if (m) { bracketStack.push({ name: m[1], kind: "class", startLine: lineNum }); }

            // Track brace depth
            for (const ch of line) {
                if (ch === "}") {
                    const top = bracketStack.pop();
                    if (top) {
                        scopes.push({ ...top, endLine: lineNum });
                    }
                }
            }
        }

        if (isPython) {
            const m = trimmed.match(/^(?:class|def|async\s+def)\s+(\w+)/);
            if (m) {
                const kind = trimmed.startsWith("class") ? "class" : "function";
                const indent = line.length - trimmed.length;
                // Close any scope with same or deeper indent
                while (bracketStack.length > 0) {
                    const top = bracketStack[bracketStack.length - 1];
                    const topIndent = lines[top.startLine - 1].length - lines[top.startLine - 1].trimStart().length;
                    if (topIndent >= indent) {
                        bracketStack.pop();
                        scopes.push({ ...top, endLine: lineNum - 1 });
                    } else {
                        break;
                    }
                }
                bracketStack.push({ name: m[1], kind, startLine: lineNum });
            }
        }
    }

    // Close remaining scopes
    while (bracketStack.length > 0) {
        const top = bracketStack.pop()!;
        scopes.push({ ...top, endLine: lines.length });
    }

    return scopes;
}

function getBreadcrumbs(scopes: Scope[], line: number, fileName: string): string {
    const active = scopes
        .filter((s) => s.startLine <= line && s.endLine >= line)
        .sort((a, b) => a.startLine - b.startLine);

    const parts = [fileName.split("/").pop() ?? fileName, ...active.map((s) => s.name)];
    return parts.join(" › ");
}

export function createBreadcrumbsPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let scopes: Scope[] = [];

    return {
        id: "breadcrumbs",
        name: "Breadcrumbs",
        version: "1.0.0",
        description: "Shows a scope breadcrumb trail (file > class > function)",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            const content = api.getContent();
            const { language, fileName } = api.getFileInfo();
            scopes = detectScopes(content, language.toLowerCase());
            updateBreadcrumb(api, fileName);
        },

        onContentChange(content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const { language, fileName } = api.getFileInfo();
                scopes = detectScopes(content, language.toLowerCase());
                updateBreadcrumb(api, fileName);
            }, 500);
        },

        onSelectionChange(_sel, api) {
            const { fileName } = api.getFileInfo();
            updateBreadcrumb(api, fileName);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineAnnotations("breadcrumbs");
        },
    };

    function updateBreadcrumb(api: ExtendedPluginAPI, fileName: string) {
        const { line } = api.getCursorPosition();
        const trail = getBreadcrumbs(scopes, line, fileName);
        const annotation: InlineAnnotation = {
            id: "breadcrumbs:trail",
            line: 1,
            text: `  ${trail}`,
            className: "editor-breadcrumb",
            style: { opacity: 0.5, fontStyle: "italic", fontSize: "11px" },
        };
        api.setInlineAnnotations([annotation]);
    }
}
