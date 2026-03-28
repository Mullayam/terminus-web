/**
 * @module monaco-editor/plugins/git-diff-gutter-plugin
 *
 * Shows add/modify/delete indicators in the editor gutter
 * by comparing the current content against the last-saved (original) version.
 * Green = added, blue = modified, red triangle = deleted.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "git-diff-gutter-plugin-css";

const CSS = `
.diff-gutter-added {
  background: rgba(40, 167, 69, 0.45);
  width: 3px !important;
  margin-left: 3px;
}
.diff-gutter-modified {
  background: rgba(0, 122, 204, 0.55);
  width: 3px !important;
  margin-left: 3px;
}
.diff-gutter-deleted {
  border-left: 4px solid rgba(220, 53, 69, 0.65);
  width: 0 !important;
  margin-left: 3px;
}
.diff-gutter-added-line {
  background: rgba(40, 167, 69, 0.06);
}
.diff-gutter-modified-line {
  background: rgba(0, 122, 204, 0.06);
}
`;

interface DiffHunk {
  type: "added" | "modified" | "deleted";
  startLine: number;
  endLine: number;
}

/**
 * Simple line-level diff between original and current text.
 * Returns hunks indicating added, modified, or deleted line ranges.
 */
function computeLineDiff(original: string, current: string): DiffHunk[] {
  const origLines = original.split("\n");
  const currLines = current.split("\n");
  const hunks: DiffHunk[] = [];

  // LCS-based approach is too expensive for large files;
  // use a simple sequential diff like VS Code's dirty diff.
  const maxLen = Math.max(origLines.length, currLines.length);
  let oi = 0;
  let ci = 0;

  while (oi < origLines.length || ci < currLines.length) {
    if (oi >= origLines.length) {
      // Remaining lines are added
      const start = ci + 1;
      while (ci < currLines.length) ci++;
      hunks.push({ type: "added", startLine: start, endLine: ci });
      break;
    }
    if (ci >= currLines.length) {
      // Lines were deleted
      hunks.push({ type: "deleted", startLine: ci + 1, endLine: ci + 1 });
      break;
    }

    if (origLines[oi] === currLines[ci]) {
      oi++;
      ci++;
      continue;
    }

    // Try to find the matching line ahead
    let foundOrig = -1;
    let foundCurr = -1;

    // Look ahead in current for original line
    for (let j = ci + 1; j < Math.min(ci + 50, currLines.length); j++) {
      if (currLines[j] === origLines[oi]) {
        foundCurr = j;
        break;
      }
    }

    // Look ahead in original for current line
    for (let j = oi + 1; j < Math.min(oi + 50, origLines.length); j++) {
      if (origLines[j] === currLines[ci]) {
        foundOrig = j;
        break;
      }
    }

    if (foundCurr >= 0 && (foundOrig < 0 || foundCurr - ci <= foundOrig - oi)) {
      // Lines were added in current
      hunks.push({ type: "added", startLine: ci + 1, endLine: foundCurr });
      ci = foundCurr;
    } else if (foundOrig >= 0) {
      // Lines were deleted from original
      hunks.push({ type: "deleted", startLine: ci + 1, endLine: ci + 1 });
      oi = foundOrig;
    } else {
      // Modified line
      hunks.push({ type: "modified", startLine: ci + 1, endLine: ci + 1 });
      oi++;
      ci++;
    }
  }

  void maxLen;
  return hunks;
}

export const gitDiffGutterPlugin: MonacoPlugin = {
  id: "builtin-git-diff-gutter",
  name: "Diff Gutter",
  version: "1.0.0",
  description: "Shows add/modify/delete indicators in the gutter",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let decorationIds: string[] = [];
    let originalContent: string = ctx.getContent();

    /* Save original on first load */
    ctx.on("file-saved", () => {
      originalContent = ctx.getContent();
      update();
    });

    /* Update decorations */
    const update = () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      const current = model.getValue();
      if (current === originalContent) {
        decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
        return;
      }

      const hunks = computeLineDiff(originalContent, current);
      const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = [];

      for (const hunk of hunks) {
        if (hunk.type === "added") {
          decorations.push({
            range: new ctx.monaco.Range(hunk.startLine, 1, hunk.endLine, 1),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: "diff-gutter-added",
              className: "diff-gutter-added-line",
              minimap: {
                color: "rgba(40, 167, 69, 0.65)",
                position: ctx.monaco.editor.MinimapPosition.Gutter,
              },
              overviewRuler: {
                color: "rgba(40, 167, 69, 0.65)",
                position: ctx.monaco.editor.OverviewRulerLane.Left,
              },
            },
          });
        } else if (hunk.type === "modified") {
          decorations.push({
            range: new ctx.monaco.Range(hunk.startLine, 1, hunk.endLine, 1),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: "diff-gutter-modified",
              className: "diff-gutter-modified-line",
              minimap: {
                color: "rgba(0, 122, 204, 0.65)",
                position: ctx.monaco.editor.MinimapPosition.Gutter,
              },
              overviewRuler: {
                color: "rgba(0, 122, 204, 0.65)",
                position: ctx.monaco.editor.OverviewRulerLane.Left,
              },
            },
          });
        } else {
          decorations.push({
            range: new ctx.monaco.Range(hunk.startLine, 1, hunk.startLine, 1),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: "diff-gutter-deleted",
            },
          });
        }
      }

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
    };

    /* Debounced update on content change */
    let timer: ReturnType<typeof setTimeout>;
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        clearTimeout(timer);
        timer = setTimeout(update, 400);
      }),
    );

    update();
  },
};
