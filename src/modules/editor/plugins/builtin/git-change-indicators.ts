/**
 * @module editor/plugins/builtin/git-change-indicators
 *
 * Shows gutter indicators for added, modified, and deleted lines
 * compared to original content.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, GutterDecoration } from "../types";
import { createElement } from "react";

type ChangeType = "added" | "modified" | "deleted";

interface LineChange {
    line: number;
    type: ChangeType;
}

function computeChanges(original: string, current: string): LineChange[] {
    const oldLines = original.split("\n");
    const newLines = current.split("\n");
    const changes: LineChange[] = [];

    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
        if (i >= oldLines.length) {
            changes.push({ line: i + 1, type: "added" });
        } else if (i >= newLines.length) {
            changes.push({ line: oldLines.length, type: "deleted" });
        } else if (oldLines[i] !== newLines[i]) {
            changes.push({ line: i + 1, type: "modified" });
        }
    }

    return changes;
}

const COLOR_MAP: Record<ChangeType, string> = {
    added: "#50fa7b",
    modified: "#8be9fd",
    deleted: "#ff5555",
};

export function createGitChangeIndicatorsPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "git-change-indicators",
        name: "Git Change Indicators",
        version: "1.0.0",
        description: "Shows added/modified/deleted line indicators in the gutter",
        category: "tools",
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
            api.clearGutterDecorations("git-change-indicators");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const state = api.getState() as { originalContent?: string; content?: string };
    const original = state.originalContent ?? "";
    const current = api.getContent();

    if (!original) {
        api.clearGutterDecorations("git-change-indicators");
        return;
    }

    const changes = computeChanges(original, current);
    const decorations: GutterDecoration[] = changes.map((ch) => ({
        id: `git-change-indicators:${ch.line}`,
        line: ch.line,
        icon: createElement("span", {
            style: {
                display: "inline-block",
                width: "3px",
                height: "100%",
                backgroundColor: COLOR_MAP[ch.type],
                borderRadius: "1px",
            },
        }),
        className: `editor-change-${ch.type}`,
        hoverMessage: `Line ${ch.type}`,
    }));

    api.clearGutterDecorations("git-change-indicators");
    api.addGutterDecorations(decorations);
}
