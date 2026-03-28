/**
 * @module monaco-editor/plugins/ruler-lines-plugin
 *
 * Configurable column ruler lines (e.g. 80, 120 characters).
 * Shows vertical guide lines at specified column positions.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STORAGE_KEY = "terminus-editor-rulers";

const DEFAULT_RULERS = [80, 120];

function loadRulers(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_RULERS;
  } catch {
    return DEFAULT_RULERS;
  }
}

function saveRulers(rulers: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rulers));
  } catch { /* noop */ }
}

export const rulerLinesPlugin: MonacoPlugin = {
  id: "builtin-ruler-lines",
  name: "Ruler Lines",
  version: "1.0.0",
  description: "Configurable column ruler lines at 80/120 chars",

  onMount(ctx: PluginContext) {
    let rulers = loadRulers();

    // Apply rulers
    ctx.editor.updateOptions({ rulers });

    /* Toggle rulers on/off */
    ctx.addAction({
      id: "rulers.toggle",
      label: "Toggle Column Rulers",
      run(editor) {
        const current = (editor.getOption(ctx.monaco.editor.EditorOption.rulers) as any) ?? [];
        if (current.length > 0) {
          editor.updateOptions({ rulers: [] });
          ctx.notify("Column rulers hidden", "info");
        } else {
          editor.updateOptions({ rulers });
          ctx.notify(`Column rulers: ${rulers.join(", ")}`, "info");
        }
      },
    });

    /* Set ruler at 80 */
    ctx.addAction({
      id: "rulers.set-80",
      label: "Set Ruler at Column 80",
      run(editor) {
        rulers = [80];
        editor.updateOptions({ rulers });
        saveRulers(rulers);
      },
    });

    /* Set ruler at 120 */
    ctx.addAction({
      id: "rulers.set-120",
      label: "Set Ruler at Column 120",
      run(editor) {
        rulers = [120];
        editor.updateOptions({ rulers });
        saveRulers(rulers);
      },
    });

    /* Set rulers at 80 + 120 */
    ctx.addAction({
      id: "rulers.set-80-120",
      label: "Set Rulers at 80 and 120",
      run(editor) {
        rulers = [80, 120];
        editor.updateOptions({ rulers });
        saveRulers(rulers);
      },
    });

    /* Remove all rulers */
    ctx.addAction({
      id: "rulers.clear",
      label: "Remove All Rulers",
      run(editor) {
        rulers = [];
        editor.updateOptions({ rulers: [] });
        saveRulers(rulers);
      },
    });
  },
};
