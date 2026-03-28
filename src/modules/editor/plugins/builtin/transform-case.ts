/**
 * @module editor/plugins/builtin/transform-case
 *
 * Transform selected text between camelCase, snake_case,
 * PascalCase, CONSTANT_CASE, kebab-case, Title Case, etc.
 */
import type { ExtendedEditorPlugin } from "../types";

function toWords(str: string): string[] {
    return str
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[-_]+/g, " ")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
}

const transforms: Record<string, (s: string) => string> = {
    camelCase: (s) => {
        const w = toWords(s);
        return w.map((word, i) => (i === 0 ? word : word[0].toUpperCase() + word.slice(1))).join("");
    },
    PascalCase: (s) => toWords(s).map((w) => w[0].toUpperCase() + w.slice(1)).join(""),
    snake_case: (s) => toWords(s).join("_"),
    CONSTANT_CASE: (s) => toWords(s).join("_").toUpperCase(),
    "kebab-case": (s) => toWords(s).join("-"),
    "Title Case": (s) => toWords(s).map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
    lowercase: (s) => s.toLowerCase(),
    UPPERCASE: (s) => s.toUpperCase(),
};

export function createTransformCasePlugin(): ExtendedEditorPlugin {
    return {
        id: "transform-case",
        name: "Transform Case",
        version: "1.0.0",
        description: "Convert selected text between camelCase, snake_case, PascalCase, CONSTANT_CASE, kebab-case",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            for (const [name, fn] of Object.entries(transforms)) {
                api.registerCommand(`transformCase.${name}`, () => {
                    const sel = api.getSelection();
                    if (!sel || sel.start === sel.end) return;
                    const text = api.getContent().slice(sel.start, sel.end);
                    api.replaceSelection(fn(text));
                });
            }
        },
    };
}
