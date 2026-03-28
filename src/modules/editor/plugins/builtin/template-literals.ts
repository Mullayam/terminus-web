/**
 * @module editor/plugins/builtin/template-literals
 *
 * Provides template literal helpers for JS/TS.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createTemplateLiteralsPlugin(): ExtendedEditorPlugin {
    return {
        id: "template-literals",
        name: "Template Literals",
        version: "1.0.0",
        description: "Convert between string concatenation and template literals",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("templateLiterals.convert", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) {
                    api.showToast("Template Literals", "Select a string expression to convert", "default");
                    return;
                }

                const text = api.getContent().slice(sel.start, sel.end);

                // Pattern: "string" + var + "string"
                const concatPattern = /['"]([^'"]*)['"]\s*\+\s*(\w+)(?:\s*\+\s*['"]([^'"]*)['"])?/g;
                let isConcat = false;
                let result = text;

                // Convert concatenation to template literal
                if (concatPattern.test(text)) {
                    isConcat = true;
                    result = text.replace(
                        /['"]([^'"]*)['"]\s*\+\s*(\w+)/g,
                        (_, str, variable) => `${str}\${${variable}}`
                    );
                    // Clean trailing + "..."
                    result = result.replace(/\s*\+\s*['"]([^'"]*)['"]/g, "$1");
                    result = "`" + result + "`";
                }

                // Convert template literal to concatenation
                if (!isConcat && text.startsWith("`") && text.endsWith("`")) {
                    const inner = text.slice(1, -1);
                    const parts: string[] = [];
                    let lastIndex = 0;
                    const templateRegex = /\$\{([^}]+)\}/g;
                    let match;

                    while ((match = templateRegex.exec(inner)) !== null) {
                        if (match.index > lastIndex) {
                            parts.push(`"${inner.slice(lastIndex, match.index)}"`);
                        }
                        parts.push(match[1]);
                        lastIndex = match.index + match[0].length;
                    }

                    if (lastIndex < inner.length) {
                        parts.push(`"${inner.slice(lastIndex)}"`);
                    }

                    result = parts.join(" + ");
                }

                if (result !== text) {
                    api.replaceSelection(result);
                }
            });
        },
    };
}
