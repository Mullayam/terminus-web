/**
 * @module monaco-editor/plugins/save-state-plugin
 *
 * Persists and restores editor state (cursor position, scroll, folds)
 * across remounts using sessionStorage.
 *
 * Usage:
 *   import { saveStatePlugin } from "@/modules/monaco-editor";
 *   <MonacoEditor plugins={[saveStatePlugin]} filePath="/app/main.ts" />
 */

import type { MonacoPlugin, Monaco, PluginContext } from "../types";

export const saveStatePlugin: MonacoPlugin = {
  id: "builtin-save-state",
  name: "Save Editor State",
  version: "1.0.0",
  description: "Persists cursor position and scroll across remounts",
  priority: -10, // load late

  onMount(ctx: PluginContext) {
    const key = `monaco-state:${ctx.getFilePath() ?? "untitled"}`;

    // Restore
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.position) {
          ctx.editor.setPosition(state.position);
          ctx.editor.revealPositionInCenter(state.position);
        }
        if (state.scrollTop !== undefined) {
          ctx.editor.setScrollTop(state.scrollTop);
        }
      }
    } catch {
      // Ignore parse errors
    }

    // Save on cursor change
    const saveFn = () => {
      try {
        const position = ctx.editor.getPosition();
        const scrollTop = ctx.editor.getScrollTop();
        sessionStorage.setItem(key, JSON.stringify({ position, scrollTop }));
      } catch {
        // Ignore storage errors
      }
    };

    ctx.addDisposable(ctx.editor.onDidChangeCursorPosition(saveFn));
    ctx.addDisposable(ctx.editor.onDidScrollChange(saveFn));
  },
};
