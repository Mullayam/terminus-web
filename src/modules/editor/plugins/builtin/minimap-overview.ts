/**
 * @module editor/plugins/builtin/minimap-overview
 *
 * Provides minimap annotations for errors, warnings,
 * TODOs, and search results.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, GutterDecoration } from "../types";
import { createElement } from "react";

export function createMinimapOverviewPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "minimap-overview",
        name: "Minimap Overview",
        version: "1.0.0",
        description: "Annotates gutter with overview markers for errors, warnings, and TODOs",
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
            api.clearGutterDecorations("minimap-overview");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const lines = content.split("\n");
    const decorations: GutterDecoration[] = [];

    const todoPattern = /\b(TODO|FIXME|HACK|BUG|XXX):?/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (todoPattern.test(line)) {
            decorations.push({
                id: `minimap-overview:todo:${i + 1}`,
                line: i + 1,
                icon: createElement("span", {
                    style: {
                        display: "inline-block",
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        backgroundColor: "#f1fa8c",
                    },
                }),
                hoverMessage: "TODO marker",
            });
        }
    }

    api.clearGutterDecorations("minimap-overview");
    if (decorations.length > 0) {
        api.addGutterDecorations(decorations);
    }
}
