/**
 * @module monaco-editor/plugins/file-metadata-plugin
 *
 * Displays file metadata (size, lines, language, encoding, indent style)
 * in the editor's status bar area via a DOM widget.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "file-metadata-plugin-css";

const CSS = `
.file-meta-widget {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0 10px;
  font-size: 11px;
  font-family: var(--vscode-font-family, system-ui);
  color: var(--vscode-statusBar-foreground, #acacac);
  height: 100%;
  white-space: nowrap;
  user-select: none;
}
.file-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  cursor: default;
}
.file-meta-item:hover {
  color: var(--vscode-statusBarItem-hoverForeground, #ffffff);
}
.file-meta-sep {
  width: 1px;
  height: 12px;
  background: var(--vscode-statusBar-foreground, #acacac);
  opacity: 0.25;
}
`;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const fileMetadataPlugin: MonacoPlugin = {
  id: "builtin-file-metadata",
  name: "File Metadata",
  version: "1.0.0",
  description: "Shows file size, lines, language, encoding, indent style",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    /* Try to find the status bar */
    const widget = document.createElement("div");
    widget.className = "file-meta-widget";

    let mounted = false;
    let disposed = false;

    const findStatusBar = (): HTMLElement | null => {
      const dom = ctx.editor.getDomNode();
      let el = dom?.parentElement;
      for (let i = 0; i < 10 && el; i++) {
        const bar = el.querySelector(".editor-statusbar, .status-bar, [data-status-bar]");
        if (bar) return bar as HTMLElement;
        el = el.parentElement;
      }
      return null;
    };

    const mountWidget = () => {
      if (mounted || disposed) return;
      const bar = findStatusBar();
      if (bar) {
        bar.appendChild(widget);
        mounted = true;
      }
    };

    const sep = () => {
      const s = document.createElement("span");
      s.className = "file-meta-sep";
      return s;
    };

    const item = (text: string, title?: string) => {
      const el = document.createElement("span");
      el.className = "file-meta-item";
      el.textContent = text;
      if (title) el.title = title;
      return el;
    };

    const update = () => {
      if (disposed) return;
      const model = ctx.editor.getModel();
      if (!model) return;

      const content = model.getValue();
      const lineCount = model.getLineCount();
      const size = new Blob([content]).size;
      const language = ctx.getLanguage();

      // Detect indent
      const opts = model.getOptions();
      const indentStyle = opts.insertSpaces
        ? `Spaces: ${opts.indentSize}`
        : `Tab Size: ${opts.tabSize}`;

      // Cursor info
      const pos = ctx.editor.getPosition();
      const cursorInfo = pos ? `Ln ${pos.lineNumber}, Col ${pos.column}` : "";

      widget.innerHTML = "";
      widget.appendChild(item(cursorInfo, "Cursor position"));
      widget.appendChild(sep());
      widget.appendChild(item(indentStyle, "Indentation"));
      widget.appendChild(sep());
      widget.appendChild(item(`UTF-8`, "File encoding"));
      widget.appendChild(sep());
      widget.appendChild(item(language, "Language mode"));
      widget.appendChild(sep());
      widget.appendChild(item(`${lineCount} lines`, "Line count"));
      widget.appendChild(sep());
      widget.appendChild(item(formatBytes(size), "File size"));
    };

    // Delayed mount to wait for status bar render
    setTimeout(mountWidget, 500);

    let debounce: ReturnType<typeof setTimeout>;
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        clearTimeout(debounce);
        debounce = setTimeout(update, 500);
      }),
    );

    ctx.addDisposable(
      ctx.editor.onDidChangeCursorPosition(() => {
        clearTimeout(debounce);
        debounce = setTimeout(update, 100);
      }),
    );

    update();

    ctx.addDisposable({
      dispose() {
        disposed = true;
        widget.remove();
      },
    });
  },

  onLanguageChange(_lang: string, ctx: PluginContext) {
    // Trigger a re-render; the update fn reads language from context
    ctx.editor.getModel() && ctx.emit("file-metadata-refresh");
  },
};
