/**
 * @module monaco-editor/plugins/trailing-whitespace-plugin
 *
 * Highlights trailing whitespace in red and auto-trims on save.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "trailing-ws-plugin-css";
const CSS = `.trailing-ws { background: rgba(255, 70, 70, 0.28); border-bottom: 1px solid rgba(255, 70, 70, 0.4); }`;

export const trailingWhitespacePlugin: MonacoPlugin = {
  id: "builtin-trailing-whitespace",
  name: "Trailing Whitespace",
  version: "1.0.0",
  description: "Highlights trailing whitespace and trims on save",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let decorationIds: string[] = [];

    const update = () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      const cursorLine = ctx.editor.getPosition()?.lineNumber ?? -1;
      const lineCount = model.getLineCount();
      const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = [];

      for (let i = 1; i <= lineCount; i++) {
        // Skip the current cursor line to avoid annoying flicker while typing
        if (i === cursorLine) continue;

        const line = model.getLineContent(i);
        const match = line.match(/(\s+)$/);
        if (match) {
          const startCol = line.length - match[1].length + 1;
          const endCol = line.length + 1;
          decorations.push({
            range: new ctx.monaco.Range(i, startCol, i, endCol),
            options: {
              className: "trailing-ws",
              stickiness: ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              overviewRuler: {
                color: "rgba(255, 70, 70, 0.5)",
                position: ctx.monaco.editor.OverviewRulerLane.Right,
              },
            },
          });
        }
      }

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
    };

    let timer: ReturnType<typeof setTimeout>;
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        clearTimeout(timer);
        timer = setTimeout(update, 250);
      }),
    );
    ctx.addDisposable(ctx.editor.onDidChangeCursorPosition(() => {
      clearTimeout(timer);
      timer = setTimeout(update, 150);
    }));

    update();

    /* Trim trailing whitespace command */
    ctx.addAction({
      id: "trailing-ws.trim",
      label: "Trim Trailing Whitespace",
      run(editor) {
        const model = editor.getModel();
        if (!model) return;

        const edits: import("monaco-editor").editor.IIdentifiedSingleEditOperation[] = [];
        for (let i = 1; i <= model.getLineCount(); i++) {
          const line = model.getLineContent(i);
          const match = line.match(/(\s+)$/);
          if (match) {
            const startCol = line.length - match[1].length + 1;
            edits.push({
              range: new ctx.monaco.Range(i, startCol, i, line.length + 1),
              text: "",
            });
          }
        }

        if (edits.length) {
          editor.executeEdits("trailing-ws", edits);
        }
      },
    });

    /* Auto-trim on save event */
    ctx.on("file-save", () => {
      const model = ctx.editor.getModel();
      if (!model) return;
      const edits: import("monaco-editor").editor.IIdentifiedSingleEditOperation[] = [];
      for (let i = 1; i <= model.getLineCount(); i++) {
        const line = model.getLineContent(i);
        const match = line.match(/(\s+)$/);
        if (match) {
          const startCol = line.length - match[1].length + 1;
          edits.push({
            range: new ctx.monaco.Range(i, startCol, i, line.length + 1),
            text: "",
          });
        }
      }
      if (edits.length) ctx.editor.executeEdits("trailing-ws", edits);
    });
  },
};
