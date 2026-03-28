/**
 * @module editor/plugins/builtin/string-escape
 *
 * Escape/unescape strings (JSON, regex, HTML, shell).
 */
import type { ExtendedEditorPlugin } from "../types";

export function createStringEscapePlugin(): ExtendedEditorPlugin {
    return {
        id: "string-escape",
        name: "String Escape",
        version: "1.0.0",
        description: "Escape/unescape strings for JSON, regex, HTML, and shell",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("escape.json", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                api.replaceSelection(JSON.stringify(text).slice(1, -1));
            });

            api.registerCommand("unescape.json", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                try {
                    api.replaceSelection(JSON.parse(`"${text}"`));
                } catch {
                    api.showToast("Unescape", "Invalid escaped string", "default");
                }
            });

            api.registerCommand("escape.regex", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                api.replaceSelection(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
            });

            api.registerCommand("escape.shell", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                api.replaceSelection("'" + text.replace(/'/g, "'\"'\"'") + "'");
            });

            api.registerCommand("escape.xml", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                api.replaceSelection(
                    text
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&apos;")
                );
            });
        },
    };
}
