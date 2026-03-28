/**
 * @module monaco-editor/plugins/code-actions-lightbulb-plugin
 *
 * Enhanced code-action lightbulb that surfaces quick-fixes,
 * refactorings, and AI-suggested fixes via a menu.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "lightbulb-plugin-css";
const CSS = `
.lightbulb-widget {
  position: absolute;
  width: 18px;
  height: 18px;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: background 0.1s;
}
.lightbulb-widget:hover {
  background: var(--vscode-editorLightBulb-foreground, #DDB100)22;
}
.lightbulb-widget svg {
  width: 14px;
  height: 14px;
  fill: var(--vscode-editorLightBulb-foreground, #DDB100);
}
.lightbulb-menu {
  position: fixed;
  min-width: 220px;
  max-width: 400px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--vscode-menu-background, #252526);
  border: 1px solid var(--vscode-menu-border, #454545);
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 10001;
  padding: 4px 0;
  font-size: 12px;
  font-family: var(--vscode-font-family, system-ui);
  color: var(--vscode-menu-foreground, #cccccc);
}
.lightbulb-menu-item {
  padding: 4px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.lightbulb-menu-item:hover {
  background: var(--vscode-menu-selectionBackground, #04395e);
  color: var(--vscode-menu-selectionForeground, #ffffff);
}
.lightbulb-menu-sep {
  height: 1px;
  margin: 4px 8px;
  background: var(--vscode-menu-separatorBackground, #3c3c3c);
}
.lightbulb-menu-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.lightbulb-menu-kind { font-size: 10px; opacity: 0.55; }
`;

const BULB_SVG = `<svg viewBox="0 0 16 16"><path d="M8 1a4.5 4.5 0 0 0-1.7 8.67V12h3.4V9.67A4.5 4.5 0 0 0 8 1zm0 1a3.5 3.5 0 0 1 1.33 6.73l-.33.13V11H7V8.86l-.33-.13A3.5 3.5 0 0 1 8 2zM6.5 13h3v1h-3v-1z"/></svg>`;

export const codeActionsLightbulbPlugin: MonacoPlugin = {
  id: "builtin-code-actions-lightbulb",
  name: "Code Actions Lightbulb",
  version: "1.0.0",
  description: "Enhanced lightbulb for quick-fixes and code actions",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let bulbEl: HTMLElement | null = null;
    let menuEl: HTMLElement | null = null;
    let currentActions: import("monaco-editor").languages.CodeAction[] = [];

    const removeBulb = () => {
      bulbEl?.remove();
      bulbEl = null;
    };
    const removeMenu = () => {
      menuEl?.remove();
      menuEl = null;
    };

    const showMenu = (actions: import("monaco-editor").languages.CodeAction[]) => {
      removeMenu();
      if (!bulbEl || !actions.length) return;

      menuEl = document.createElement("div");
      menuEl.className = "lightbulb-menu";

      // Group by kind
      const quickFixes = actions.filter((a) => !a.kind || a.kind.startsWith("quickfix"));
      const refactors = actions.filter((a) => a.kind?.startsWith("refactor"));
      const others = actions.filter((a) => a.kind && !a.kind.startsWith("quickfix") && !a.kind.startsWith("refactor"));

      const addGroup = (group: import("monaco-editor").languages.CodeAction[], kindLabel: string) => {
        if (!group.length) return;
        group.forEach((action) => {
          const item = document.createElement("div");
          item.className = "lightbulb-menu-item";

          const label = document.createElement("span");
          label.className = "lightbulb-menu-label";
          label.textContent = action.title;
          item.appendChild(label);

          if (kindLabel) {
            const kind = document.createElement("span");
            kind.className = "lightbulb-menu-kind";
            kind.textContent = kindLabel;
            item.appendChild(kind);
          }

          item.addEventListener("click", () => {
            removeMenu();
            applyAction(action);
          });

          menuEl!.appendChild(item);
        });
      };

      addGroup(quickFixes, "Quick Fix");
      if (quickFixes.length && (refactors.length || others.length)) {
        const sep = document.createElement("div");
        sep.className = "lightbulb-menu-sep";
        menuEl.appendChild(sep);
      }
      addGroup(refactors, "Refactor");
      addGroup(others, "");

      document.body.appendChild(menuEl);
      const rect = bulbEl.getBoundingClientRect();
      menuEl.style.left = `${rect.left}px`;
      menuEl.style.top = `${rect.bottom + 2}px`;

      // Clamp to viewport
      requestAnimationFrame(() => {
        if (!menuEl) return;
        const mr = menuEl.getBoundingClientRect();
        if (mr.right > window.innerWidth) menuEl.style.left = `${window.innerWidth - mr.width - 4}px`;
        if (mr.bottom > window.innerHeight) menuEl.style.top = `${rect.top - mr.height - 2}px`;
      });
    };

    const applyAction = (action: import("monaco-editor").languages.CodeAction) => {
      if (action.edit?.edits) {
        for (const edit of action.edit.edits) {
          const textEdits = (edit as any).edits ?? (edit as any).textEdit ? [(edit as any).textEdit] : [];
          const monacoEdits = textEdits.map((te: any) => ({
            range: te.range,
            text: te.newText ?? te.text ?? "",
          }));
          if (monacoEdits.length) {
            ctx.editor.executeEdits("code-actions", monacoEdits);
          }
        }
      }
      if (action.command) {
        ctx.editor.trigger("code-actions-lightbulb", action.command.id, action.command.arguments);
      }
    };

    const checkActions = async () => {
      removeBulb();
      removeMenu();

      const model = ctx.editor.getModel();
      const pos = ctx.editor.getPosition();
      if (!model || !pos) return;

      // Check for markers on current line
      const markers = ctx.monaco.editor.getModelMarkers({ resource: model.uri })
        .filter((m) => pos.lineNumber >= m.startLineNumber && pos.lineNumber <= m.endLineNumber);

      if (!markers.length) return;

      // Request code actions
      try {
        const range = new ctx.monaco.Range(pos.lineNumber, 1, pos.lineNumber, model.getLineMaxColumn(pos.lineNumber));
        const actions = await (ctx.monaco.editor as any).getCodeActions?.(model, range, { type: 1 /* Auto */ }) ??
          { actions: [], dispose() {} };

        currentActions = actions.actions ?? [];

        if (!currentActions.length) {
          actions.dispose?.();
          return;
        }

        // Show the bulb
        const editorDom = ctx.editor.getDomNode();
        if (!editorDom) return;

        bulbEl = document.createElement("div");
        bulbEl.className = "lightbulb-widget";
        bulbEl.innerHTML = BULB_SVG;
        bulbEl.title = `${currentActions.length} code action(s) available`;

        // Position next to line number
        const lineTop = ctx.editor.getTopForLineNumber(pos.lineNumber);
        const scrollTop = ctx.editor.getScrollTop();
        const editorRect = editorDom.getBoundingClientRect();

        bulbEl.style.top = `${lineTop - scrollTop}px`;
        bulbEl.style.left = `2px`;

        editorDom.style.position = "relative";
        editorDom.appendChild(bulbEl);

        bulbEl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (menuEl) removeMenu();
          else showMenu(currentActions);
        });

        void editorRect;
      } catch {
        // Code actions API not available
      }
    };

    let timer: ReturnType<typeof setTimeout>;
    ctx.addDisposable(
      ctx.editor.onDidChangeCursorPosition(() => {
        clearTimeout(timer);
        timer = setTimeout(checkActions, 400);
      }),
    );

    // Close menu on click outside
    const onDocClick = (e: MouseEvent) => {
      if (menuEl && !menuEl.contains(e.target as Node) && e.target !== bulbEl) {
        removeMenu();
      }
    };
    document.addEventListener("mousedown", onDocClick, true);

    /* Ctrl+. — standard VS Code shortcut for code actions */
    ctx.addAction({
      id: "lightbulb.trigger",
      label: "Quick Fix...",
      keybindings: [ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.Period],
      run: () => {
        if (currentActions.length) showMenu(currentActions);
        else checkActions();
      },
    });

    ctx.addDisposable({
      dispose() {
        removeBulb();
        removeMenu();
        document.removeEventListener("mousedown", onDocClick, true);
      },
    });
  },
};
