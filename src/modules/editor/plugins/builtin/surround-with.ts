/**
 * @module editor/plugins/builtin/surround-with
 *
 * Surround selection with common structures
 * (try/catch, if/else, for, function, etc.)
 */
import type { ExtendedEditorPlugin } from "../types";

interface SurroundTemplate {
    id: string;
    label: string;
    before: string;
    after: string;
    indent?: boolean;
}

const TEMPLATES: SurroundTemplate[] = [
    { id: "try-catch", label: "try...catch", before: "try {\n", after: "\n} catch (error) {\n  console.error(error);\n}", indent: true },
    { id: "if", label: "if", before: "if (condition) {\n", after: "\n}", indent: true },
    { id: "if-else", label: "if...else", before: "if (condition) {\n", after: "\n} else {\n  \n}", indent: true },
    { id: "for", label: "for", before: "for (let i = 0; i < count; i++) {\n", after: "\n}", indent: true },
    { id: "forEach", label: "forEach", before: "items.forEach((item) => {\n", after: "\n});", indent: true },
    { id: "while", label: "while", before: "while (condition) {\n", after: "\n}", indent: true },
    { id: "function", label: "function", before: "function name() {\n", after: "\n}", indent: true },
    { id: "arrow", label: "arrow function", before: "const fn = () => {\n", after: "\n};", indent: true },
    { id: "async", label: "async function", before: "async function name() {\n", after: "\n}", indent: true },
    { id: "class", label: "class", before: "class Name {\n", after: "\n}", indent: true },
    { id: "div", label: "<div>", before: "<div>\n", after: "\n</div>", indent: true },
    { id: "span", label: "<span>", before: "<span>", after: "</span>", indent: false },
    { id: "region", label: "region", before: "// #region Name\n", after: "\n// #endregion", indent: false },
];

export function createSurroundWithPlugin(): ExtendedEditorPlugin {
    return {
        id: "surround-with",
        name: "Surround With",
        version: "1.0.0",
        description: "Surround selection with common structures (try/catch, if/else, for, etc.)",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            for (const template of TEMPLATES) {
                api.registerCommand(`surround.${template.id}`, () => {
                    const sel = api.getSelection();
                    if (!sel || sel.start === sel.end) {
                        api.showToast("Surround", "Select code to surround", "default");
                        return;
                    }

                    const text = api.getContent().slice(sel.start, sel.end);
                    const body = template.indent
                        ? text.split("\n").map((l) => "  " + l).join("\n")
                        : text;

                    api.replaceSelection(template.before + body + template.after);
                });
            }

            api.registerCommand("surround.showAll", () => {
                const items = TEMPLATES.map((t) => `• surround.${t.id} — ${t.label}`).join("\n");
                api.showToast("Surround With", items, "default");
            });
        },
    };
}
