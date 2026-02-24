/**
 * @module editor/plugins/builtin/diff-viewer
 *
 * Diff viewer plugin.
 * Provides side-by-side and inline diff views comparing
 * original content with current content.
 */
import { createElement, useState, useMemo } from "react";
import type { ExtendedEditorPlugin, ExtendedPluginAPI, PanelDescriptor, DiffHunk } from "../types";

// ═══════════════════════════════════════════════════════════════
//  DIFF ALGORITHM (Myers-like simplified)
// ═══════════════════════════════════════════════════════════════

interface DiffLine {
    type: "add" | "remove" | "unchanged";
    content: string;
    oldLineNum?: number;
    newLineNum?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const result: DiffLine[] = [];

    // Simple LCS-based diff
    const m = oldLines.length;
    const n = newLines.length;

    // Build LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to get diff
    let i = m, j = n;
    const stack: DiffLine[] = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            stack.push({ type: "unchanged", content: oldLines[i - 1], oldLineNum: i, newLineNum: j });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            stack.push({ type: "add", content: newLines[j - 1], newLineNum: j });
            j--;
        } else if (i > 0) {
            stack.push({ type: "remove", content: oldLines[i - 1], oldLineNum: i });
            i--;
        }
    }

    stack.reverse();
    return stack;
}

// ═══════════════════════════════════════════════════════════════
//  DIFF STATS
// ═══════════════════════════════════════════════════════════════

function getDiffStats(diff: DiffLine[]) {
    const added = diff.filter((d) => d.type === "add").length;
    const removed = diff.filter((d) => d.type === "remove").length;
    const unchanged = diff.filter((d) => d.type === "unchanged").length;
    return { added, removed, unchanged, total: diff.length };
}

// ═══════════════════════════════════════════════════════════════
//  REACT COMPONENTS
// ═══════════════════════════════════════════════════════════════

const DIFF_STYLES = `
.diff-viewer { height: 100%; overflow: auto; font-family: var(--editor-font-family, monospace); font-size: 12px; }
.diff-header { padding: 8px 12px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--editor-border, #44475a); }
.diff-stats { display: flex; gap: 8px; font-size: 11px; }
.diff-stat-add { color: #50fa7b; }
.diff-stat-remove { color: #ff5555; }
.diff-mode-toggle { display: flex; gap: 4px; }
.diff-mode-btn { padding: 2px 8px; border-radius: 3px; border: 1px solid var(--editor-border, #44475a); background: transparent; color: var(--editor-foreground, #f8f8f2); cursor: pointer; font-size: 11px; }
.diff-mode-btn.active { background: var(--editor-accent, #6272a4); border-color: var(--editor-accent, #6272a4); }
.diff-inline { padding: 0; }
.diff-line { display: flex; min-height: 20px; line-height: 20px; }
.diff-line-num { width: 40px; text-align: right; padding: 0 8px; color: var(--editor-gutter-fg, #6272a4); user-select: none; flex-shrink: 0; }
.diff-line-content { flex: 1; padding: 0 8px; white-space: pre-wrap; word-break: break-all; }
.diff-line-add { background: rgba(80, 250, 123, 0.1); }
.diff-line-add .diff-line-content { color: #50fa7b; }
.diff-line-remove { background: rgba(255, 85, 85, 0.1); }
.diff-line-remove .diff-line-content { color: #ff5555; }
.diff-line-unchanged .diff-line-content { color: var(--editor-foreground, #f8f8f2); opacity: 0.6; }
.diff-side-by-side { display: flex; height: calc(100% - 40px); }
.diff-side { flex: 1; overflow: auto; border-right: 1px solid var(--editor-border, #44475a); }
.diff-side:last-child { border-right: none; }
.diff-side-header { padding: 4px 8px; font-size: 11px; color: var(--editor-muted, #6272a4); border-bottom: 1px solid var(--editor-border, #44475a); text-align: center; }
.diff-no-changes { text-align: center; padding: 40px; color: var(--editor-muted, #6272a4); }
`;

function DiffViewerPanel({ api }: { api: ExtendedPluginAPI }) {
    const [mode, setMode] = useState<"inline" | "side-by-side">("inline");
    const state = api.getState() as { content: string; originalContent: string; fileName: string };
    const oldContent = state.originalContent ?? "";
    const newContent = state.content ?? "";

    const diff = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);
    const stats = useMemo(() => getDiffStats(diff), [diff]);

    const hasChanges = stats.added > 0 || stats.removed > 0;

    return createElement("div", { className: "diff-viewer" },
        createElement("style", null, DIFF_STYLES),
        createElement("div", { className: "diff-header" },
            createElement("span", { style: { fontWeight: 600, fontSize: "12px" } }, "Diff View"),
            createElement("div", { className: "diff-stats" },
                createElement("span", { className: "diff-stat-add" }, `+${stats.added}`),
                createElement("span", { className: "diff-stat-remove" }, `-${stats.removed}`),
            ),
            createElement("div", { className: "diff-mode-toggle" },
                createElement("button", {
                    className: `diff-mode-btn ${mode === "inline" ? "active" : ""}`,
                    onClick: () => setMode("inline"),
                }, "Inline"),
                createElement("button", {
                    className: `diff-mode-btn ${mode === "side-by-side" ? "active" : ""}`,
                    onClick: () => setMode("side-by-side"),
                }, "Side by Side"),
            ),
        ),
        !hasChanges
            ? createElement("div", { className: "diff-no-changes" }, "No changes detected")
            : mode === "inline"
                ? createElement(InlineDiffView, { diff })
                : createElement(SideBySideDiffView, { diff }),
    );
}

function InlineDiffView({ diff }: { diff: DiffLine[] }) {
    return createElement("div", { className: "diff-inline" },
        diff.map((line, i) =>
            createElement("div", {
                key: i,
                className: `diff-line diff-line-${line.type}`,
            },
                createElement("span", { className: "diff-line-num" },
                    line.type === "add" ? "+" : line.type === "remove" ? "-" : (line.oldLineNum ?? ""),
                ),
                createElement("span", { className: "diff-line-content" },
                    (line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  ") + line.content,
                ),
            ),
        ),
    );
}

function SideBySideDiffView({ diff }: { diff: DiffLine[] }) {
    const leftLines: Array<{ num?: number; content: string; type: string }> = [];
    const rightLines: Array<{ num?: number; content: string; type: string }> = [];

    for (const d of diff) {
        if (d.type === "unchanged") {
            leftLines.push({ num: d.oldLineNum, content: d.content, type: "unchanged" });
            rightLines.push({ num: d.newLineNum, content: d.content, type: "unchanged" });
        } else if (d.type === "remove") {
            leftLines.push({ num: d.oldLineNum, content: d.content, type: "remove" });
            rightLines.push({ content: "", type: "empty" });
        } else {
            leftLines.push({ content: "", type: "empty" });
            rightLines.push({ num: d.newLineNum, content: d.content, type: "add" });
        }
    }

    const renderSide = (lines: typeof leftLines, title: string) =>
        createElement("div", { className: "diff-side" },
            createElement("div", { className: "diff-side-header" }, title),
            lines.map((line, i) =>
                createElement("div", {
                    key: i,
                    className: `diff-line diff-line-${line.type}`,
                },
                    createElement("span", { className: "diff-line-num" }, line.num ?? ""),
                    createElement("span", { className: "diff-line-content" }, line.content),
                ),
            ),
        );

    return createElement("div", { className: "diff-side-by-side" },
        renderSide(leftLines, "Original"),
        renderSide(rightLines, "Modified"),
    );
}

export function createDiffViewerPlugin(): ExtendedEditorPlugin {
    return {
        id: "diff-viewer",
        name: "Diff Viewer",
        version: "1.0.0",
        description: "Side-by-side and inline diff views comparing original content with current changes",
        category: "tools",
        defaultEnabled: true,

        panels: [
            {
                id: "diff-viewer:panel",
                title: "Diff View",
                position: "right",
                defaultSize: 450,
                render: (api) => createElement(DiffViewerPanel, { api }),
            },
        ],

        onActivate(api) {
            api.registerKeybinding({
                id: "diff-viewer:toggle",
                label: "Toggle Diff View",
                keys: "Ctrl+Shift+G",
                handler: () => api.togglePanel("diff-viewer:panel"),
                when: "editor",
                category: "Diff",
            });

            api.addContextMenuItem({
                label: "Show Diff",
                action: () => api.togglePanel("diff-viewer:panel"),
                shortcut: "Ctrl+Shift+G",
                priority: 90,
            });
        },
    };
}
