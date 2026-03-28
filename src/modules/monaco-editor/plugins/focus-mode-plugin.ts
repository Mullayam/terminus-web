/**
 * @module monaco-editor/plugins/focus-mode-plugin
 *
 * Zen / Focus mode: hides all chrome (sidebar, status bar, tabs, minimap, line numbers)
 * and centers the editor. Toggle with Ctrl+K Z (or Cmd+K Z on Mac).
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "focus-mode-plugin-css";

const CSS = `
.monaco-focus-mode .editor-sidebar,
.monaco-focus-mode .editor-statusbar,
.monaco-focus-mode .editor-tabs,
.monaco-focus-mode .editor-activity-bar,
.monaco-focus-mode .editor-right-sidebar,
.monaco-focus-mode .editor-panel,
.monaco-focus-mode .breadcrumbs-bar {
  display: none !important;
}
.monaco-focus-mode {
  background: var(--vscode-editor-background, #1e1e1e) !important;
}
.monaco-focus-mode .monaco-editor {
  margin: 0 auto;
  max-width: 900px;
}
.focus-mode-indicator {
  position: fixed;
  top: 8px;
  right: 12px;
  padding: 4px 12px;
  font-size: 11px;
  font-family: var(--vscode-font-family, system-ui);
  color: var(--vscode-editorWidget-foreground, #cccccc);
  background: var(--vscode-editorWidget-background, #252526);
  border: 1px solid var(--vscode-editorWidget-border, #454545);
  border-radius: 4px;
  z-index: 10000;
  opacity: 0.8;
  pointer-events: none;
  transition: opacity 0.3s;
  animation: focus-mode-fade 3s forwards;
}
@keyframes focus-mode-fade {
  0% { opacity: 0.9; }
  70% { opacity: 0.9; }
  100% { opacity: 0; }
}
`;

export const focusModePlugin: MonacoPlugin = {
  id: "builtin-focus-mode",
  name: "Focus Mode",
  version: "1.0.0",
  description: "Zen mode — hides chrome, centers editor. Toggle: Ctrl+K Z",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let active = false;
    let indicator: HTMLElement | null = null;
    let savedOptions: Record<string, unknown> = {};

    const getContainer = (): HTMLElement | null => {
      const dom = ctx.editor.getDomNode();
      // Walk up to find the outermost editor wrapper
      let el = dom?.parentElement;
      for (let i = 0; i < 8 && el; i++) {
        if (
          el.classList.contains("monaco-editor-wrapper") ||
          el.classList.contains("editor-container") ||
          el.dataset.editorRoot !== undefined
        ) {
          return el;
        }
        el = el.parentElement;
      }
      return dom?.parentElement?.parentElement ?? null;
    };

    const toggle = () => {
      active = !active;
      const container = getContainer();

      if (active) {
        /* Save current options */
        const opts = ctx.editor.getOptions();
        savedOptions = {
          minimap: (opts as any)._values?.[72] ?? {},
          lineNumbers: ctx.editor.getOption(ctx.monaco.editor.EditorOption.lineNumbers),
          folding: ctx.editor.getOption(ctx.monaco.editor.EditorOption.folding),
          glyphMargin: ctx.editor.getOption(ctx.monaco.editor.EditorOption.glyphMargin),
          renderLineHighlight: ctx.editor.getOption(ctx.monaco.editor.EditorOption.renderLineHighlight),
        };

        container?.classList.add("monaco-focus-mode");
        ctx.editor.updateOptions({
          minimap: { enabled: false },
          lineNumbers: "off",
          folding: false,
          glyphMargin: false,
          renderLineHighlight: "none",
        });

        /* Show ephemeral indicator */
        indicator = document.createElement("div");
        indicator.className = "focus-mode-indicator";
        indicator.textContent = "Focus Mode — Ctrl+K Z to exit";
        document.body.appendChild(indicator);
        setTimeout(() => indicator?.remove(), 3500);
      } else {
        container?.classList.remove("monaco-focus-mode");
        ctx.editor.updateOptions({
          minimap: { enabled: true },
          lineNumbers: "on",
          folding: true,
          glyphMargin: true,
          renderLineHighlight: "line",
          ...savedOptions,
        } as any);
        indicator?.remove();
      }

      ctx.editor.layout();
      ctx.editor.focus();
    };

    /* Ctrl+K Z keybinding (chord) */
    ctx.addAction({
      id: "focus-mode.toggle",
      label: "Toggle Focus Mode",
      keybindings: [
        ctx.monaco.KeyMod.chord(
          ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.KeyK,
          ctx.monaco.KeyCode.KeyZ,
        ),
      ],
      run: toggle,
    });

    /* Escape exits focus mode */
    ctx.addDisposable(
      ctx.editor.onKeyDown((e) => {
        if (active && e.keyCode === ctx.monaco.KeyCode.Escape) {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }
      }),
    );

    ctx.addDisposable({
      dispose() {
        if (active) toggle();
        indicator?.remove();
      },
    });
  },
};
