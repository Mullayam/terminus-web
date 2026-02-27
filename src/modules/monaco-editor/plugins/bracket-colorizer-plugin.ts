/**
 * @module monaco-editor/plugins/bracket-colorizer-plugin
 *
 * Enhanced bracket pair colorizer — highlights the active line's
 * matching bracket when the cursor is adjacent to one.
 *
 * Monaco already has built-in `bracketPairColorization`; this plugin
 * adds an extra background highlight decoration for the active bracket.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const BRACKET_CHARS = new Set(["(", ")", "[", "]", "{", "}"]);

export const bracketColorizerPlugin: MonacoPlugin = {
  id: "builtin-bracket-colorizer",
  name: "Bracket Colorizer",
  version: "1.0.0",
  description: "Highlights matching bracket pairs with background color",

  onMount(ctx: PluginContext) {
    let decorationIds: string[] = [];

    const updateBrackets = () => {
      const position = ctx.editor.getPosition();
      const model = ctx.editor.getModel();
      if (!position || !model) {
        decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
        return;
      }

      const line = position.lineNumber;
      const col = position.column;
      const lineText = model.getLineContent(line);

      const charBefore = col > 1 ? lineText[col - 2] : "";
      const charAt = lineText[col - 1] ?? "";

      let bracketCol = 0;
      if (BRACKET_CHARS.has(charBefore)) {
        bracketCol = col - 1;
      } else if (BRACKET_CHARS.has(charAt)) {
        bracketCol = col;
      }

      if (!bracketCol) {
        decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
        return;
      }

      const bracketRange = new ctx.monaco.Range(line, bracketCol, line, bracketCol + 1);

      decorationIds = ctx.editor.deltaDecorations(decorationIds, [
        {
          range: bracketRange,
          options: {
            className: "bracket-match-highlight",
            overviewRuler: {
              color: "rgba(80, 180, 255, 0.5)",
              position: ctx.monaco.editor.OverviewRulerLane.Center,
            },
            stickiness:
              ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ]);
    };

    ctx.addDisposable(ctx.editor.onDidChangeCursorPosition(updateBrackets));
  },
};
