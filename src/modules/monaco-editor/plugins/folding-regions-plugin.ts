/**
 * @module monaco-editor/plugins/folding-regions-plugin
 *
 * Adds support for custom folding regions using #region/#endregion
 * markers across all languages.
 *
 * Supported markers:
 *   // #region Name     →  // #endregion
 *   // <editor-fold>    →  // </editor-fold>
 *   /* region Name * /  →  /* endregion * /
 *   # region Name       →  # endregion  (Python/Shell)
 *   -- #region          →  -- #endregion (SQL/Lua)
 */

import type { MonacoPlugin, PluginContext, Monaco } from "../types";

let FoldingRangeKindRegion: import("monaco-editor").languages.FoldingRangeKind;

interface FoldingMarkerPair {
  startRegex: RegExp;
  endRegex: RegExp;
}

const MARKER_PAIRS: FoldingMarkerPair[] = [
  {
    startRegex: /^\s*(?:\/\/|#|--|;)\s*#?region\b(.*)$/i,
    endRegex: /^\s*(?:\/\/|#|--|;)\s*#?endregion\b/i,
  },
  {
    startRegex: /^\s*\/\/\s*<editor-fold\b/i,
    endRegex: /^\s*\/\/\s*<\/editor-fold>/i,
  },
  {
    startRegex: /^\s*\/\*\s*region\b/i,
    endRegex: /^\s*\/\*\s*endregion\b/i,
  },
  {
    startRegex: /^\s*<!--\s*#?region\b/i,
    endRegex: /^\s*<!--\s*#?endregion\b/i,
  },
];

export const foldingRegionsPlugin: MonacoPlugin = {
  id: "builtin-folding-regions",
  name: "Code Folding Regions",
  version: "1.0.0",
  description: "Support for #region/#endregion custom folding markers",

  onBeforeMount(monaco: Monaco) {
    FoldingRangeKindRegion = monaco.languages.FoldingRangeKind.Region;
  },

  onMount(ctx: PluginContext) {
    /* Register folding provider for all languages */
    ctx.registerFoldingRangeProvider(["*"], {
      provideFoldingRanges(model) {
        const lineCount = model.getLineCount();
        const ranges: import("monaco-editor").languages.FoldingRange[] = [];

        // Stack-based matching per marker pair
        for (const pair of MARKER_PAIRS) {
          const stack: number[] = [];

          for (let i = 1; i <= lineCount; i++) {
            const line = model.getLineContent(i);

            if (pair.startRegex.test(line)) {
              stack.push(i);
            } else if (pair.endRegex.test(line) && stack.length > 0) {
              const startLine = stack.pop()!;
              ranges.push({
                start: startLine,
                end: i,
                kind: FoldingRangeKindRegion
              });
            }
          }
        }

        return ranges;
      },
    });
  },
};
