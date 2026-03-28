/**
 * @module monaco-editor/plugins/font-ligatures-plugin
 *
 * Quick-toggle font ligatures and font family from the command palette.
 * Supports Fira Code, JetBrains Mono, Cascadia Code, and custom fonts.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STORAGE_KEY = "terminus-editor-font-prefs";

const FONT_OPTIONS = [
  { name: "Fira Code", family: "'Fira Code', 'Fira Mono', Consolas, monospace", ligatures: true },
  { name: "JetBrains Mono", family: "'JetBrains Mono', Consolas, monospace", ligatures: true },
  { name: "Cascadia Code", family: "'Cascadia Code', Consolas, monospace", ligatures: true },
  { name: "Source Code Pro", family: "'Source Code Pro', Consolas, monospace", ligatures: false },
  { name: "Consolas", family: "Consolas, 'Courier New', monospace", ligatures: false },
  { name: "Monaco (default)", family: "Menlo, Monaco, 'Courier New', monospace", ligatures: false },
];

interface FontPrefs {
  fontFamily: string;
  fontLigatures: boolean;
}

function loadPrefs(): FontPrefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePrefs(prefs: FontPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* noop */ }
}

export const fontLigaturesPlugin: MonacoPlugin = {
  id: "builtin-font-ligatures",
  name: "Font & Ligatures",
  version: "1.0.0",
  description: "Toggle font family and ligatures from command palette",

  onMount(ctx: PluginContext) {
    // Apply saved preferences
    const saved = loadPrefs();
    if (saved) {
      ctx.editor.updateOptions({
        fontFamily: saved.fontFamily,
        fontLigatures: saved.fontLigatures,
      });
    }

    /* Toggle ligatures */
    ctx.addAction({
      id: "font.toggle-ligatures",
      label: "Toggle Font Ligatures",
      run(editor) {
        const current = editor.getOption(ctx.monaco.editor.EditorOption.fontLigatures);
        const enabled = !current;
        editor.updateOptions({ fontLigatures: enabled });

        const prefs = loadPrefs() ?? {
          fontFamily: editor.getOption(ctx.monaco.editor.EditorOption.fontFamily),
          fontLigatures: enabled,
        };
        prefs.fontLigatures = enabled;
        savePrefs(prefs);

        ctx.notify(`Font ligatures ${enabled ? "enabled" : "disabled"}`, "info");
      },
    });

    /* Cycle through fonts */
    ctx.addAction({
      id: "font.change-family",
      label: "Change Editor Font",
      run(editor) {
        const currentFamily = editor.getOption(ctx.monaco.editor.EditorOption.fontFamily);
        const currentIdx = FONT_OPTIONS.findIndex((f) =>
          currentFamily.includes(f.name) || currentFamily.includes(f.family.split(",")[0].replace(/'/g, "")),
        );
        const nextIdx = (currentIdx + 1) % FONT_OPTIONS.length;
        const next = FONT_OPTIONS[nextIdx];

        editor.updateOptions({
          fontFamily: next.family,
          fontLigatures: next.ligatures,
        });

        savePrefs({ fontFamily: next.family, fontLigatures: next.ligatures });
        ctx.notify(`Font: ${next.name}${next.ligatures ? " (ligatures on)" : ""}`, "info");
      },
    });

    /* Increase / decrease font size */
    ctx.addAction({
      id: "font.increase-size",
      label: "Increase Font Size",
      keybindings: [ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.Equal],
      run(editor) {
        const current = editor.getOption(ctx.monaco.editor.EditorOption.fontSize);
        editor.updateOptions({ fontSize: Math.min(current + 1, 40) });
      },
    });

    ctx.addAction({
      id: "font.decrease-size",
      label: "Decrease Font Size",
      keybindings: [ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.Minus],
      run(editor) {
        const current = editor.getOption(ctx.monaco.editor.EditorOption.fontSize);
        editor.updateOptions({ fontSize: Math.max(current - 1, 8) });
      },
    });

    ctx.addAction({
      id: "font.reset-size",
      label: "Reset Font Size",
      keybindings: [ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.Digit0],
      run(editor) {
        editor.updateOptions({ fontSize: 14 });
      },
    });
  },
};
