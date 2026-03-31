/**
 * @module editor/plugins/builtin/auto-close-tags
 *
 * Automatically close HTML/XML/JSX tags when typing ">".
 */
import type { ExtendedEditorPlugin } from "../types";

import { TAG_LANGUAGES, VOID_ELEMENTS } from "@/modules/monaco-editor/lib/language/language-groups";

function normalizeLanguage(lang: string): string {
    const map: Record<string, string> = {
        "HTML": "html", "XML": "xml", "JavaScript (JSX)": "jsx",
        "TypeScript (TSX)": "tsx", "Vue": "vue", "PHP": "php",
    };
    return map[lang] ?? lang.toLowerCase();
}

export function createAutoCloseTagsPlugin(): ExtendedEditorPlugin {
    return {
        id: "auto-close-tags",
        name: "Auto Close Tags",
        version: "1.0.0",
        description: "Automatically insert closing HTML/XML/JSX tags",
        category: "language",
        defaultEnabled: true,

        onContentChange(content, api) {
            const { language } = api.getFileInfo();
            const lang = normalizeLanguage(language);
            if (!TAG_LANGUAGES.has(lang)) return;

            const { offset } = api.getCursorPosition();
            if (offset < 2) return;

            // Check if user just typed ">"
            if (content[offset - 1] !== ">") return;

            // Find the opening tag
            const before = content.slice(0, offset);
            const tagMatch = before.match(/<(\w[\w.-]*)(?:\s[^>]*)?>\s*$/);
            if (!tagMatch) return;

            const tagName = tagMatch[1].toLowerCase();
            if (VOID_ELEMENTS.has(tagName)) return;

            // Check if closing tag already exists right after cursor
            const after = content.slice(offset);
            if (after.startsWith(`</${tagMatch[1]}>`)) return;

            // Self-closing check
            if (before.endsWith("/>")) return;

            const closing = `</${tagMatch[1]}>`;
            const newContent = content.slice(0, offset) + closing + content.slice(offset);
            api.setContent(newContent);
        },
    };
}
