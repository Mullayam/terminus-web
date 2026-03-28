/**
 * @module editor/plugins/builtin/diff-stats
 *
 * Shows diff statistics (lines added/removed/changed)
 * compared to the original content.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

interface DiffStats {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
}

function computeDiffStats(original: string, current: string): DiffStats {
    const oldLines = original.split("\n");
    const newLines = current.split("\n");
    let added = 0, removed = 0, modified = 0, unchanged = 0;

    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
        if (i >= oldLines.length) added++;
        else if (i >= newLines.length) removed++;
        else if (oldLines[i] === newLines[i]) unchanged++;
        else modified++;
    }

    return { added, removed, modified, unchanged };
}

export function createDiffStatsPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "diff-stats",
        name: "Diff Stats",
        version: "1.0.0",
        description: "Shows lines added/removed/changed compared to original",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            update(api);

            api.registerCommand("diffStats.show", () => {
                const state = api.getState() as { originalContent?: string };
                const original = state.originalContent ?? "";
                const current = api.getContent();
                const stats = computeDiffStats(original, current);
                api.showToast("Diff Stats",
                    `+${stats.added} -${stats.removed} ~${stats.modified} =${stats.unchanged}`,
                    "default"
                );
            });
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineAnnotations("diff-stats");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const state = api.getState() as { originalContent?: string };
    const original = state.originalContent ?? "";
    const current = api.getContent();

    if (!original || original === current) {
        api.clearInlineAnnotations("diff-stats");
        return;
    }

    const stats = computeDiffStats(original, current);
    const annotation: InlineAnnotation = {
        id: "diff-stats:summary",
        line: 1,
        text: `  📊 +${stats.added} -${stats.removed} ~${stats.modified}`,
        style: { opacity: 0.35, fontSize: "10px" },
    };

    api.setInlineAnnotations([annotation]);
}
