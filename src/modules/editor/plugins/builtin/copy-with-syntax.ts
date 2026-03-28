/**
 * @module editor/plugins/builtin/copy-with-syntax
 *
 * Copy code to clipboard with markdown fencing
 * for sharing in chat/docs.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createCopyWithSyntaxPlugin(): ExtendedEditorPlugin {
    return {
        id: "copy-with-syntax",
        name: "Copy with Syntax",
        version: "1.0.0",
        description: "Copy selected code with markdown syntax fencing",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("copy.withMarkdown", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;

                const text = api.getContent().slice(sel.start, sel.end);
                const { language, fileName } = api.getFileInfo();
                const lang = language.toLowerCase();

                const fenced = "```" + lang + "\n" + text + "\n```";

                navigator.clipboard.writeText(fenced).then(() => {
                    api.showToast("Copy", "Copied with markdown fencing", "default");
                });
            });

            api.registerCommand("copy.withLineNumbers", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;

                const content = api.getContent();
                const text = content.slice(sel.start, sel.end);
                const startLine = content.slice(0, sel.start).split("\n").length;

                const numbered = text
                    .split("\n")
                    .map((line, i) => `${String(startLine + i).padStart(4)} | ${line}`)
                    .join("\n");

                navigator.clipboard.writeText(numbered).then(() => {
                    api.showToast("Copy", "Copied with line numbers", "default");
                });
            });

            api.registerCommand("copy.asHtml", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;

                const text = api.getContent().slice(sel.start, sel.end);
                const escaped = text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                const html = `<pre><code>${escaped}</code></pre>`;

                navigator.clipboard.writeText(html).then(() => {
                    api.showToast("Copy", "Copied as HTML", "default");
                });
            });

            api.addContextMenuItem({
                label: "Copy with Markdown",
                action: () => api.executeCommand("copy.withMarkdown"),
                priority: 50,
            });
        },
    };
}
