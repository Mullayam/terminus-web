/**
 * @module monaco-editor/plugins/rainbow-indent-plugin
 *
 * Colorized indent-level guides: alternating translucent background
 * bands at each indentation depth, making nesting instantly visible.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "rainbow-indent-plugin-css";

const COLORS = [
  "rgba(255, 255, 64, 0.04)",
  "rgba(127, 255, 127, 0.04)",
  "rgba(255, 127, 255, 0.04)",
  "rgba(79, 236, 236, 0.04)",
  "rgba(255, 127, 80, 0.04)",
  "rgba(160, 130, 255, 0.04)",
];

function buildCSS(): string {
  let css = "";
  for (let i = 0; i < COLORS.length; i++) {
    css += `.ri-depth-${i} { background: ${COLORS[i]}; }\n`;
  }
  return css;
}

export const rainbowIndentPlugin: MonacoPlugin = {
  id: "builtin-rainbow-indent",
  name: "Rainbow Indent",
  version: "1.0.0",
  description: "Colorized indent-level background bands",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = buildCSS();
      document.head.appendChild(style);
    }

    let decorationIds: string[] = [];

    const update = () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      const opts = model.getOptions();
      const tabSize = opts.tabSize;
      const lineCount = model.getLineCount();
      const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = [];

      for (let line = 1; line <= lineCount; line++) {
        const content = model.getLineContent(line);
        if (!content.trim()) continue;

        // Count leading whitespace in tab-equivalent units
        let spaces = 0;
        for (const ch of content) {
          if (ch === "\t") spaces += tabSize;
          else if (ch === " ") spaces++;
          else break;
        }

        const depth = Math.floor(spaces / tabSize);
        if (depth <= 0) continue;

        // Apply one decoration per depth level
        for (let d = 0; d < depth && d < 10; d++) {
          const startCol = d * tabSize + 1;
          const endCol = (d + 1) * tabSize + 1;
          decorations.push({
            range: new ctx.monaco.Range(line, startCol, line, endCol),
            options: {
              className: `ri-depth-${d % COLORS.length}`,
              stickiness: ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
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
        timer = setTimeout(update, 200);
      }),
    );

    update();
  },
};
