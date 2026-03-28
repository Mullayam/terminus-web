/**
 * @module editor/plugins/builtin/indent-guides
 *
 * Shows vertical indent guide lines in the gutter area.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, GutterDecoration } from "../types";
import { createElement } from "react";

function computeGuides(content: string): GutterDecoration[] {
    const lines = content.split("\n");
    const decorations: GutterDecoration[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().length === 0) continue;
        const indent = line.length - line.trimStart().length;
        const levels = Math.floor(indent / 2);

        if (levels > 0) {
            decorations.push({
                id: `indent-guides:${i + 1}`,
                line: i + 1,
                icon: createElement("span", {
                    style: {
                        display: "inline-block",
                        width: `${levels * 2}px`,
                        borderLeft: "1px solid rgba(255,255,255,0.06)",
                        marginLeft: `${(levels - 1) * 8}px`,
                        height: "100%",
                    },
                }),
                className: "editor-indent-guide",
            });
        }
    }
    return decorations;
}

export function createIndentGuidesPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "indent-guides",
        name: "Indent Guides",
        version: "1.0.0",
        description: "Shows vertical indent guide lines",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 400);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearGutterDecorations("indent-guides");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    api.clearGutterDecorations("indent-guides");
    const content = api.getContent();
    const guides = computeGuides(content);
    api.addGutterDecorations(guides);
}
