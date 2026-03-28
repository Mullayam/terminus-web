/**
 * @module monaco-editor/plugins/auto-indent-detect-plugin
 *
 * Detects the indentation style (tabs vs spaces, tab size) of the opened file
 * by scanning the first lines and auto-configures the editor to match.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const SAMPLE_LINES = 100;

function detectIndentation(text: string): { insertSpaces: boolean; tabSize: number } | null {
  const lines = text.split("\n").slice(0, SAMPLE_LINES);

  let tabCount = 0;
  let spaceCount = 0;
  const spaceSizes: Record<number, number> = {};

  for (const line of lines) {
    if (!line || line.trim().length === 0) continue;

    const tabMatch = line.match(/^\t+/);
    if (tabMatch) {
      tabCount++;
      continue;
    }

    const spaceMatch = line.match(/^( +)\S/);
    if (spaceMatch) {
      spaceCount++;
      const len = spaceMatch[1].length;
      // Only count sizes 1-8
      if (len >= 1 && len <= 8) {
        spaceSizes[len] = (spaceSizes[len] || 0) + 1;
      }
    }
  }

  if (tabCount === 0 && spaceCount === 0) return null;

  const useTabs = tabCount > spaceCount;

  if (useTabs) {
    return { insertSpaces: false, tabSize: 4 };
  }

  // Find the most common indent step by computing GCD of space counts
  let bestSize = 2;
  let bestScore = 0;
  for (const size of [2, 4, 8, 3, 6]) {
    let score = 0;
    for (const [len, count] of Object.entries(spaceSizes)) {
      if (Number(len) % size === 0) score += count;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSize = size;
    }
  }

  return { insertSpaces: true, tabSize: bestSize };
}

export const autoIndentDetectPlugin: MonacoPlugin = {
  id: "builtin-auto-indent-detect",
  name: "Auto Detect Indent",
  version: "1.0.0",
  description: "Detects and applies the file's indentation style",

  onMount(ctx: PluginContext) {
    const apply = () => {
      const content = ctx.getContent();
      if (!content) return;

      const result = detectIndentation(content);
      if (result) {
        ctx.editor.getModel()?.updateOptions({
          insertSpaces: result.insertSpaces,
          tabSize: result.tabSize,
        });
      }
    };

    // Detect on mount
    apply();
  },

  onLanguageChange(_lang: string, ctx: PluginContext) {
    // Re-detect when language changes (file switch)
    const content = ctx.getContent();
    if (!content) return;
    const result = detectIndentation(content);
    if (result) {
      ctx.editor.getModel()?.updateOptions({
        insertSpaces: result.insertSpaces,
        tabSize: result.tabSize,
      });
    }
  },
};
