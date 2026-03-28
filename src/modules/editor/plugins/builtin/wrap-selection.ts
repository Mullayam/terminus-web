/**
 * @module editor/plugins/builtin/wrap-selection
 *
 * Wrap selection with brackets, quotes, or custom strings.
 */
import type { ExtendedEditorPlugin } from "../types";

const WRAP_PAIRS: Record<string, [string, string]> = {
    "(": ["(", ")"],
    "[": ["[", "]"],
    "{": ["{", "}"],
    "<": ["<", ">"],
    "'": ["'", "'"],
    '"': ['"', '"'],
    "`": ["`", "`"],
    "**": ["**", "**"],
    "~~": ["~~", "~~"],
    "```": ["```\n", "\n```"],
};

export function createWrapSelectionPlugin(): ExtendedEditorPlugin {
    return {
        id: "wrap-selection",
        name: "Wrap Selection",
        version: "1.0.0",
        description: "Wrap selected text with brackets, quotes, or custom wrappers",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            for (const [key, [open, close]] of Object.entries(WRAP_PAIRS)) {
                api.registerCommand(`wrapSelection.${key}`, () => {
                    const sel = api.getSelection();
                    if (!sel || sel.start === sel.end) return;
                    const text = api.getContent().slice(sel.start, sel.end);
                    api.replaceSelection(`${open}${text}${close}`);
                });
            }

            api.addContextMenuItem({
                label: "Wrap with Quotes",
                action: () => api.executeCommand('wrapSelection."'),
                priority: 40,
            });

            api.addContextMenuItem({
                label: "Wrap with Brackets",
                action: () => api.executeCommand("wrapSelection.("),
                priority: 41,
            });
        },
    };
}
