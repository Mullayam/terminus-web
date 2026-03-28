/**
 * @module monaco-editor/plugins/minimap-search-plugin
 *
 * Highlights all find-match occurrences in the minimap with a distinct color.
 * Listens to the editor's find state and refreshes decorations accordingly.
 */

import type { MonacoPlugin, PluginContext } from "../types";

export const minimapSearchPlugin: MonacoPlugin = {
  id: "builtin-minimap-search",
  name: "Minimap Search Highlights",
  version: "1.0.0",
  description: "Shows search matches in the minimap",

  onMount(ctx: PluginContext) {
    let decorationIds: string[] = [];
    let lastSearchValue = "";

    const update = () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      // Access the find controller's state
      const findController = (ctx.editor as any).getContribution?.("editor.contrib.findController");
      const findState = findController?.getState?.();

      const searchString = findState?.searchString ?? "";

      if (!searchString || searchString === lastSearchValue) {
        if (!searchString && decorationIds.length) {
          decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
          lastSearchValue = "";
        }
        return;
      }

      lastSearchValue = searchString;

      const isRegex = findState?.isRegex ?? false;
      const matchCase = findState?.matchCase ?? false;
      const wholeWord = findState?.wholeWord ?? false;

      const matches = model.findMatches(
        searchString,
        true, // searchOnlyEditableRange = false -> search all
        isRegex,
        matchCase,
        wholeWord ? "\\b" : null,
        false,
      );

      const decorations = matches.map((m) => ({
        range: m.range,
        options: {
          minimap: {
            color: "rgba(255, 165, 0, 0.7)", // Orange
            position: ctx.monaco.editor.MinimapPosition.Inline,
          },
          overviewRuler: {
            color: "rgba(255, 165, 0, 0.8)",
            position: ctx.monaco.editor.OverviewRulerLane.Center,
          },
          stickiness:
            ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }));

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
    };

    // Poll for find state changes (Monaco doesn't expose a clean event)
    const interval = setInterval(update, 500);

    // Also update on content change
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        lastSearchValue = ""; // force refresh
        setTimeout(update, 200);
      }),
    );

    ctx.addDisposable({
      dispose() {
        clearInterval(interval);
        decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
      },
    });
  },
};
