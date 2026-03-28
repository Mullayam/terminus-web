/**
 * @module editor/plugins/builtin/html-tag-rename
 *
 * When renaming an HTML opening tag, automatically renames
 * the matching closing tag (and vice versa).
 */
import type { ExtendedEditorPlugin } from "../types";

const TAG_LANGUAGES = new Set(["html", "xml", "jsx", "tsx", "vue", "svelte", "php", "astro"]);

function normalizeLanguage(lang: string): string {
    const map: Record<string, string> = {
        "HTML": "html", "XML": "xml", "JavaScript (JSX)": "jsx",
        "TypeScript (TSX)": "tsx",
    };
    return map[lang] ?? lang.toLowerCase();
}

export function createHtmlTagRenamePlugin(): ExtendedEditorPlugin {
    return {
        id: "html-tag-rename",
        name: "HTML Tag Auto-Rename",
        version: "1.0.0",
        description: "Automatically renames matching open/close HTML tags",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("htmlTag.rename", (...args: unknown[]) => {
                const { language } = api.getFileInfo();
                if (!TAG_LANGUAGES.has(normalizeLanguage(language))) return;

                const newName = typeof args[0] === "string" ? args[0] : null;
                if (!newName) return;

                const content = api.getContent();
                const { offset } = api.getCursorPosition();

                // Find the tag at cursor
                const before = content.slice(0, offset);
                const after = content.slice(offset);

                // Check if inside an opening tag
                const openMatch = before.match(/<(\w+)$/);
                if (openMatch) {
                    const oldName = openMatch[1];
                    const closeRegex = new RegExp(`</${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}>`);
                    const newContent = content.replace(closeRegex, `</${newName}>`);
                    api.setContent(newContent);
                    return;
                }

                // Check if inside a closing tag
                const closeMatch = before.match(/<\/(\w+)$/);
                if (closeMatch) {
                    const oldName = closeMatch[1];
                    const openRegex = new RegExp(`<${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|>)`);
                    const newContent = content.replace(openRegex, `<${newName}$1`);
                    api.setContent(newContent);
                }
            });
        },
    };
}
