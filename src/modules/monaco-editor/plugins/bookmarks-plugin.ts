/**
 * @module monaco-editor/plugins/bookmarks-plugin
 *
 * Toggle bookmarks on lines with Ctrl+F2, jump between them
 * with F2 / Shift+F2. Bookmarks persist in localStorage.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "bookmarks-plugin-css";
const STORAGE_KEY = "terminus-editor-bookmarks";

const CSS = `
.bookmark-glyph {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--vscode-editorGutter-addedBackground, #2ea043);
  border-radius: 50%;
  margin: 4px 0 0 4px;
  box-shadow: 0 0 3px rgba(46, 160, 67, 0.5);
}
.bookmark-line {
  background: rgba(46, 160, 67, 0.06);
}
.bookmark-minimap {
  background: rgba(46, 160, 67, 0.7);
}
`;

interface BookmarkData {
  [filePath: string]: number[];
}

function loadBookmarks(): BookmarkData {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveBookmarks(data: BookmarkData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* noop */ }
}

export const bookmarksPlugin: MonacoPlugin = {
  id: "builtin-bookmarks",
  name: "Bookmarks",
  version: "1.0.0",
  description: "Toggle bookmarks on lines, jump between them (Ctrl+F2)",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let decorationIds: string[] = [];
    let bookmarks: number[] = [];
    const filePath = ctx.getFilePath() ?? "unknown";

    // Load persisted bookmarks for this file
    const allBookmarks = loadBookmarks();
    bookmarks = (allBookmarks[filePath] ?? []).filter(
      (line) => line >= 1 && line <= (ctx.editor.getModel()?.getLineCount() ?? Infinity),
    );

    const persist = () => {
      const data = loadBookmarks();
      data[filePath] = bookmarks;
      saveBookmarks(data);
    };

    const updateDecorations = () => {
      const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = bookmarks.map((line) => ({
        range: new ctx.monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: "bookmark-line",
          glyphMarginClassName: "bookmark-glyph",
          glyphMarginHoverMessage: { value: `Bookmark (line ${line})` },
          minimap: {
            color: "rgba(46, 160, 67, 0.7)",
            position: ctx.monaco.editor.MinimapPosition.Gutter,
          },
          overviewRuler: {
            color: "rgba(46, 160, 67, 0.7)",
            position: ctx.monaco.editor.OverviewRulerLane.Left,
          },
          stickiness: ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }));

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
    };

    /* Toggle bookmark on current line */
    ctx.addAction({
      id: "bookmarks.toggle",
      label: "Toggle Bookmark",
      keybindings: [ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.F2],
      run(editor) {
        const line = editor.getPosition()?.lineNumber;
        if (!line) return;

        const idx = bookmarks.indexOf(line);
        if (idx >= 0) {
          bookmarks.splice(idx, 1);
        } else {
          bookmarks.push(line);
          bookmarks.sort((a, b) => a - b);
        }

        updateDecorations();
        persist();
      },
    });

    /* Jump to next bookmark */
    ctx.addAction({
      id: "bookmarks.next",
      label: "Next Bookmark",
      keybindings: [ctx.monaco.KeyCode.F2],
      run(editor) {
        if (!bookmarks.length) return;
        const line = editor.getPosition()?.lineNumber ?? 0;
        const next = bookmarks.find((b) => b > line) ?? bookmarks[0];
        editor.setPosition({ lineNumber: next, column: 1 });
        editor.revealLineInCenter(next);
      },
    });

    /* Jump to previous bookmark */
    ctx.addAction({
      id: "bookmarks.prev",
      label: "Previous Bookmark",
      keybindings: [ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.F2],
      run(editor) {
        if (!bookmarks.length) return;
        const line = editor.getPosition()?.lineNumber ?? Infinity;
        const prev = [...bookmarks].reverse().find((b) => b < line) ?? bookmarks[bookmarks.length - 1];
        editor.setPosition({ lineNumber: prev, column: 1 });
        editor.revealLineInCenter(prev);
      },
    });

    /* Clear all bookmarks */
    ctx.addAction({
      id: "bookmarks.clear",
      label: "Clear All Bookmarks",
      run() {
        bookmarks = [];
        updateDecorations();
        persist();
        ctx.notify("All bookmarks cleared", "info");
      },
    });

    /* List bookmarks (jump to selected) */
    ctx.addAction({
      id: "bookmarks.list",
      label: "List Bookmarks",
      run() {
        if (!bookmarks.length) {
          ctx.notify("No bookmarks in this file", "info");
          return;
        }
        // Show notification listing bookmarks
        const list = bookmarks.map((b) => `Line ${b}`).join(", ");
        ctx.notify(`Bookmarks: ${list}`, "info");
      },
    });

    // Initial render
    updateDecorations();

    // Track line changes (insertions/deletions shift bookmark positions)
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent((e) => {
        for (const change of e.changes) {
          const linesAdded = change.text.split("\n").length - 1;
          const linesRemoved = change.range.endLineNumber - change.range.startLineNumber;
          const delta = linesAdded - linesRemoved;

          if (delta !== 0) {
            const changeLine = change.range.startLineNumber;
            bookmarks = bookmarks
              .map((b) => (b > changeLine ? b + delta : b))
              .filter((b) => b >= 1);
          }
        }
        updateDecorations();
        persist();
      }),
    );
  },
};
