/**
 * @module editor/plugins/builtin/emmet-abbreviation
 *
 * Minimal Emmet-like abbreviation expansion for HTML/CSS.
 * Expands abbreviations like div>ul>li*3, .class, #id, etc.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

const TAG_LANGUAGES = new Set(["html", "xml", "jsx", "tsx", "vue", "svelte", "php", "astro"]);

function expandEmmet(abbr: string): string | null {
    if (!abbr || abbr.length < 2) return null;

    // Simple tag expansion: div, p, span, etc.
    const simpleTag = /^([a-z][a-z0-9]*)(\.[\w-]+)?(#[\w-]+)?(\*(\d+))?$/;
    const m = abbr.match(simpleTag);
    if (m) {
        const tag = m[1];
        const cls = m[2] ? ` class="${m[2].slice(1)}"` : "";
        const id = m[3] ? ` id="${m[3].slice(1)}"` : "";
        const count = m[5] ? parseInt(m[5]) : 1;
        const single = `<${tag}${cls}${id}></${tag}>`;
        return Array(count).fill(single).join("\n");
    }

    // Shorthand: .class => <div class="class"></div>
    if (abbr.startsWith(".") && /^\.[\w-]+$/.test(abbr)) {
        return `<div class="${abbr.slice(1)}"></div>`;
    }

    // Shorthand: #id => <div id="id"></div>
    if (abbr.startsWith("#") && /^#[\w-]+$/.test(abbr)) {
        return `<div id="${abbr.slice(1)}"></div>`;
    }

    // !! => HTML5 boilerplate
    if (abbr === "!" || abbr === "html:5") {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    
</body>
</html>`;
    }

    // lorem => Lorem ipsum paragraph
    if (abbr === "lorem" || abbr === "lipsum") {
        return "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
    }

    return null;
}

function normalizeLanguage(lang: string): string {
    const map: Record<string, string> = {
        "HTML": "html", "XML": "xml", "JavaScript (JSX)": "jsx",
        "TypeScript (TSX)": "tsx", "Vue": "vue",
    };
    return map[lang] ?? lang.toLowerCase();
}

export function createEmmetPlugin(): ExtendedEditorPlugin {
    return {
        id: "emmet-abbreviation",
        name: "Emmet Abbreviation",
        version: "1.0.0",
        description: "Expand Emmet abbreviations for HTML/CSS (Tab to expand)",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("emmet.expand", () => {
                const { language } = api.getFileInfo();
                const lang = normalizeLanguage(language);
                if (!TAG_LANGUAGES.has(lang)) return;

                const content = api.getContent();
                const { offset } = api.getCursorPosition();

                // Get the word before cursor
                const before = content.slice(0, offset);
                const wordMatch = before.match(/[\w.#!:*]+$/);
                if (!wordMatch) return;

                const abbr = wordMatch[0];
                const expanded = expandEmmet(abbr);
                if (!expanded) return;

                const newContent = content.slice(0, offset - abbr.length) + expanded + content.slice(offset);
                api.setContent(newContent);
            });
        },
    };
}
