/**
 * @module editor/plugins/builtin/color-preview
 *
 * Detects color values (hex, rgb, hsl, named) in CSS/HTML/JS/TS files
 * and shows decorations with a color swatch.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

import { COLOR_LANGUAGES } from "@/modules/monaco-editor/lib/language-groups";

const COLOR_REGEX = /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)|hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%(?:\s*,\s*[\d.]+)?\s*\)/g;

function normalizeLanguage(lang: string): string {
    const map: Record<string, string> = {
        "CSS": "css", "SCSS": "scss", "HTML": "html",
        "JavaScript": "javascript", "TypeScript": "typescript",
        "JavaScript (JSX)": "jsx", "TypeScript (TSX)": "tsx",
    };
    return map[lang] ?? lang.toLowerCase();
}

function findColors(content: string): Array<{ value: string; line: number; col: number; endCol: number }> {
    const results: Array<{ value: string; line: number; col: number; endCol: number }> = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        let match: RegExpExecArray | null;
        COLOR_REGEX.lastIndex = 0;
        while ((match = COLOR_REGEX.exec(lines[i])) !== null) {
            results.push({
                value: match[0],
                line: i + 1,
                col: match.index,
                endCol: match.index + match[0].length,
            });
        }
    }
    return results;
}

export function createColorPreviewPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "color-preview",
        name: "Color Preview",
        version: "1.0.0",
        description: "Shows color swatches next to hex, rgb, and hsl color values",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 500);
        },

        onLanguageChange(_lang, api) {
            update(api);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("color-preview");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const { language } = api.getFileInfo();
    const lang = normalizeLanguage(language);

    if (!COLOR_LANGUAGES.has(lang)) {
        api.clearInlineDecorations("color-preview");
        return;
    }

    const content = api.getContent();
    const colors = findColors(content);
    const decorations: InlineDecoration[] = colors.map((c, i) => ({
        id: `color-preview:${i}`,
        line: c.line,
        startCol: c.col,
        endCol: c.endCol,
        className: "editor-color-preview",
        style: {
            borderBottom: `2px solid ${c.value}`,
        },
        hoverMessage: c.value,
    }));

    api.clearInlineDecorations("color-preview");
    api.addInlineDecorations(decorations);
}
