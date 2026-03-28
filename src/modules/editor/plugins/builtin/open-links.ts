/**
 * @module editor/plugins/builtin/open-links
 *
 * Detects URLs in code and provides clickable link annotations.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

const URL_REGEX = /https?:\/\/[^\s'"<>)}\]]+/g;

export function createOpenLinksPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "open-links",
        name: "Open Links",
        version: "1.0.0",
        description: "Detects URLs in code and makes them clickable",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            update(api);

            api.registerCommand("links.open", (...args: unknown[]) => {
                const url = typeof args[0] === "string" ? args[0] : "";
                if (url && /^https?:\/\//.test(url)) {
                    window.open(url, "_blank", "noopener,noreferrer");
                }
            });
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("open-links");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const lines = content.split("\n");
    const decorations: InlineDecoration[] = [];

    for (let i = 0; i < lines.length; i++) {
        let match;
        const lineRegex = new RegExp(URL_REGEX.source, "g");
        while ((match = lineRegex.exec(lines[i])) !== null) {
            decorations.push({
                id: `open-links:${i + 1}:${match.index}`,
                line: i + 1,
                startCol: match.index,
                endCol: match.index + match[0].length,
                className: "editor-link",
                style: { textDecoration: "underline", cursor: "pointer", opacity: 0.8 },
                hoverMessage: `${match[0]} (Ctrl+Click to open)`,
            });
        }
    }

    api.clearInlineDecorations("open-links");
    if (decorations.length > 0) {
        api.addInlineDecorations(decorations);
    }
}
