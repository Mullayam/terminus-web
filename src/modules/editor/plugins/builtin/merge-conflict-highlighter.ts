/**
 * @module editor/plugins/builtin/merge-conflict-highlighter
 *
 * Detects and highlights Git merge conflict markers.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration, Diagnostic } from "../types";

interface ConflictRegion {
    oursStart: number;
    divider: number;
    theirsEnd: number;
}

function findConflicts(content: string): ConflictRegion[] {
    const regions: ConflictRegion[] = [];
    const lines = content.split("\n");
    let oursStart: number | null = null;
    let divider: number | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("<<<<<<< ")) {
            oursStart = i + 1;
        } else if (line.startsWith("=======") && oursStart !== null) {
            divider = i + 1;
        } else if (line.startsWith(">>>>>>> ") && oursStart !== null && divider !== null) {
            regions.push({ oursStart, divider, theirsEnd: i + 1 });
            oursStart = null;
            divider = null;
        }
    }

    return regions;
}

export function createMergeConflictHighlighterPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "merge-conflict-highlighter",
        name: "Merge Conflict Highlighter",
        version: "1.0.0",
        description: "Highlights Git merge conflict markers and provides resolution commands",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            update(api);

            api.registerCommand("mergeConflict.acceptCurrent", () => resolveConflict(api, "current"));
            api.registerCommand("mergeConflict.acceptIncoming", () => resolveConflict(api, "incoming"));
            api.registerCommand("mergeConflict.acceptBoth", () => resolveConflict(api, "both"));
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 300);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("merge-conflict-highlighter");
            api.clearDiagnostics("merge-conflict-highlighter");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const conflicts = findConflicts(content);

    if (conflicts.length === 0) {
        api.clearInlineDecorations("merge-conflict-highlighter");
        api.clearDiagnostics("merge-conflict-highlighter");
        return;
    }

    const decorations: InlineDecoration[] = [];
    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");

    conflicts.forEach((conflict, ci) => {
        // Highlight "ours" section (green)
        for (let i = conflict.oursStart; i < conflict.divider - 1; i++) {
            decorations.push({
                id: `merge-conflict-highlighter:ours:${ci}:${i}`,
                line: i,
                startCol: 0,
                endCol: (lines[i - 1] || "").length,
                className: "editor-merge-ours",
                style: { backgroundColor: "rgba(80, 250, 123, 0.1)" },
            });
        }

        // Highlight "theirs" section (blue)
        for (let i = conflict.divider + 1; i < conflict.theirsEnd; i++) {
            decorations.push({
                id: `merge-conflict-highlighter:theirs:${ci}:${i}`,
                line: i,
                startCol: 0,
                endCol: (lines[i - 1] || "").length,
                className: "editor-merge-theirs",
                style: { backgroundColor: "rgba(139, 233, 253, 0.1)" },
            });
        }

        // Conflict markers
        decorations.push({
            id: `merge-conflict-highlighter:marker:${ci}:start`,
            line: conflict.oursStart,
            startCol: 0,
            endCol: (lines[conflict.oursStart - 1] || "").length,
            style: { backgroundColor: "rgba(80, 250, 123, 0.2)", fontWeight: "700" },
        });

        diagnostics.push({
            id: `merge-conflict-highlighter:diag:${ci}`,
            line: conflict.oursStart,
            startCol: 0,
            endCol: 7,
            message: "Merge conflict detected",
            severity: "error",
            source: "merge-conflict-highlighter",
        });
    });

    api.clearInlineDecorations("merge-conflict-highlighter");
    api.addInlineDecorations(decorations);
    api.setDiagnostics(diagnostics);
}

function resolveConflict(api: ExtendedPluginAPI, resolution: "current" | "incoming" | "both") {
    const content = api.getContent();
    const { line: cursorLine } = api.getCursorPosition();
    const conflicts = findConflicts(content);

    const conflict = conflicts.find((c) => cursorLine >= c.oursStart && cursorLine <= c.theirsEnd);
    if (!conflict) return;

    const lines = content.split("\n");
    const oursLines = lines.slice(conflict.oursStart, conflict.divider - 2);
    const theirsLines = lines.slice(conflict.divider, conflict.theirsEnd - 2);

    let replacement: string[];
    if (resolution === "current") replacement = oursLines;
    else if (resolution === "incoming") replacement = theirsLines;
    else replacement = [...oursLines, ...theirsLines];

    // Replace the conflict region
    lines.splice(conflict.oursStart - 1, conflict.theirsEnd - conflict.oursStart + 1, ...replacement);
    api.setContent(lines.join("\n"));
}
