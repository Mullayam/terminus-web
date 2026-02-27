/**
 * @module monaco-editor/plugins/word-highlight-plugin
 *
 * When the cursor is on a word, highlights all other occurrences
 * of that word in the visible range.
 */

import type { MonacoPlugin, PluginContext } from "../types";

export const wordHighlightPlugin: MonacoPlugin = {
  id: "builtin-word-highlight",
  name: "Word Highlight",
  version: "1.0.0",
  description: "Highlights all occurrences of the word under cursor",

  onMount(ctx: PluginContext) {
    let decorationIds: string[] = [];
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const update = () => {
      const position = ctx.editor.getPosition();
      const model = ctx.editor.getModel();
      if (!position || !model) {
        decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
        return;
      }

      const word = model.getWordAtPosition(position);
      if (!word || word.word.length < 2) {
        decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
        return;
      }

      const matches = model.findMatches(
        `\\b${word.word}\\b`,
        true,
        true,
        true,
        null,
        false,
      );

      const decorations = matches.map((match) => ({
        range: match.range,
        options: {
          className: "word-highlight-occurrence",
          overviewRuler: {
            color: "rgba(255, 200, 50, 0.4)",
            position: ctx.monaco.editor.OverviewRulerLane.Center,
          },
          stickiness:
            ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          minimap: {
            color: "rgba(255, 200, 50, 0.6)",
            position: ctx.monaco.editor.MinimapPosition.Inline,
          },
        },
      }));

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
    };

    ctx.addDisposable(
      ctx.editor.onDidChangeCursorPosition(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(update, 150);
      }),
    );
  },
};
