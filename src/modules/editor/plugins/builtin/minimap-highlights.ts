/**
 * @module editor/plugins/builtin/minimap-highlights
 *
 * Highlights search matches, bookmarks, and errors on the minimap.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, GutterDecoration } from "../types";
import { createElement } from "react";

type HighlightKind = "error" | "warning" | "bookmark" | "search" | "todo";

const KIND_COLORS: Record<HighlightKind, string> = {
    error: "#ff5555",
    warning: "#f1fa8c",
    bookmark: "#50fa7b",
    search: "#8be9fd",
    todo: "#ffb86c",
};

function findHighlightLines(content: string): Array<{ line: number; kind: HighlightKind }> {
    const results: Array<{ line: number; kind: HighlightKind }> = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.match(/\b(TODO|FIXME)\b/i)) {
            results.push({ line: i + 1, kind: "todo" });
        }
        if (trimmed.match(/\b(HACK|BUG|XXX)\b/i)) {
            results.push({ line: i + 1, kind: "warning" });
        }
        if (trimmed.match(/\bconsole\.error\b/)) {
            results.push({ line: i + 1, kind: "error" });
        }
    }

    return results;
}

export function createMinimapHighlightsPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "minimap-highlights",
        name: "Minimap Highlights",
        version: "1.0.0",
        description: "Highlights TODOs, warnings, and errors in the gutter/minimap",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 600);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearGutterDecorations("minimap-highlights");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const highlights = findHighlightLines(content);
    const decorations: GutterDecoration[] = highlights.map((h, i) => ({
        id: `minimap-highlights:${i}`,
        line: h.line,
        icon: createElement("span", {
            style: {
                display: "inline-block",
                width: "3px",
                height: "3px",
                borderRadius: "50%",
                backgroundColor: KIND_COLORS[h.kind],
            },
        }),
        className: `editor-minimap-${h.kind}`,
        hoverMessage: `${h.kind.toUpperCase()} on line ${h.line}`,
    }));

    api.clearGutterDecorations("minimap-highlights");
    api.addGutterDecorations(decorations);
}
