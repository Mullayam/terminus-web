/**
 * @module monaco-editor/plugins/markdown-preview-plugin
 *
 * Renders a live Markdown preview in a side panel next to the editor
 * when a `.md` file is open. Toggle with Ctrl+Shift+V.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "markdown-preview-plugin-css";

const CSS = `
.md-preview-container {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 50%;
  overflow-y: auto;
  background: var(--vscode-editor-background, #1e1e1e);
  border-left: 1px solid var(--vscode-panel-border, #2d2d2d);
  z-index: 5;
  padding: 16px 24px;
  font-family: var(--vscode-markdown-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif);
  font-size: 14px;
  line-height: 1.6;
  color: var(--vscode-editor-foreground, #d4d4d4);
  box-sizing: border-box;
}
.md-preview-container h1,
.md-preview-container h2,
.md-preview-container h3,
.md-preview-container h4 {
  color: var(--vscode-editor-foreground, #e0e0e0);
  border-bottom: 1px solid var(--vscode-panel-border, #333);
  padding-bottom: 4px;
  margin-top: 20px;
}
.md-preview-container h1 { font-size: 1.8em; }
.md-preview-container h2 { font-size: 1.5em; }
.md-preview-container h3 { font-size: 1.25em; }
.md-preview-container code {
  background: var(--vscode-textCodeBlock-background, #2a2a2a);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
  font-size: 0.9em;
}
.md-preview-container pre {
  background: var(--vscode-textCodeBlock-background, #2a2a2a);
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
}
.md-preview-container pre code {
  background: none;
  padding: 0;
}
.md-preview-container blockquote {
  border-left: 3px solid var(--vscode-textBlockQuote-border, #555);
  margin: 8px 0;
  padding: 4px 12px;
  color: var(--vscode-textBlockQuote-foreground, #999);
}
.md-preview-container a { color: var(--vscode-textLink-foreground, #3794ff); }
.md-preview-container a:hover { color: var(--vscode-textLink-activeForeground, #4db8ff); }
.md-preview-container ul, .md-preview-container ol { padding-left: 24px; }
.md-preview-container li { margin: 4px 0; }
.md-preview-container table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}
.md-preview-container th, .md-preview-container td {
  border: 1px solid var(--vscode-panel-border, #444);
  padding: 6px 10px;
  text-align: left;
}
.md-preview-container th {
  background: var(--vscode-textCodeBlock-background, #2a2a2a);
}
.md-preview-container img { max-width: 100%; }
.md-preview-container hr {
  border: none;
  border-top: 1px solid var(--vscode-panel-border, #444);
  margin: 16px 0;
}
.md-preview-toolbar {
  position: absolute;
  top: 4px; right: 12px;
  z-index: 6;
}
.md-preview-toolbar button {
  background: var(--vscode-button-secondaryBackground, #3a3a3a);
  color: var(--vscode-button-secondaryForeground, #ccc);
  border: none;
  padding: 3px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}
.md-preview-toolbar button:hover {
  background: var(--vscode-button-secondaryHoverBackground, #454545);
}
`;

/**
 * Minimal Markdown → HTML converter (no external dependencies).
 * Handles: headings, bold, italic, inline code, code blocks,
 * links, images, lists, blockquotes, horizontal rules, tables.
 */
function renderMarkdown(md: string): string {
  let html = md;

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = escapeHtml(code.trimEnd());
    return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Headings
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Horizontal rule
  html = html.replace(/^---+$/gm, "<hr />");

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Tables
  html = html.replace(
    /^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm,
    (_m, header: string, _sep: string, body: string) => {
      const ths = header.split("|").filter(Boolean).map((c: string) => `<th>${c.trim()}</th>`).join("");
      const rows = body.trim().split("\n").map((row: string) => {
        const tds = row.split("|").filter(Boolean).map((c: string) => `<td>${c.trim()}</td>`).join("");
        return `<tr>${tds}</tr>`;
      }).join("");
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    },
  );

  // Unordered lists
  html = html.replace(/^[*-] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Paragraphs — wrap remaining lines
  html = html.replace(/^(?!<[a-z/])((?:.(?!<[a-z/]))+.)$/gm, "<p>$1</p>");

  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isMarkdownLang(lang: string): boolean {
  return /^markdown$/i.test(lang);
}

export const markdownPreviewPlugin: MonacoPlugin = {
  id: "builtin-markdown-preview",
  name: "Markdown Preview",
  version: "1.0.0",
  description: "Live side-by-side Markdown preview for .md files",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let previewEl: HTMLElement | null = null;
    let visible = false;
    let disposed = false;

    const getWrapper = (): HTMLElement | null => {
      const dom = ctx.editor.getDomNode();
      return dom?.parentElement ?? null;
    };

    const updatePreview = () => {
      if (!visible || !previewEl || disposed) return;
      const content = ctx.getContent();
      previewEl.innerHTML = renderMarkdown(content);
    };

    const show = () => {
      if (visible || disposed) return;
      const wrapper = getWrapper();
      if (!wrapper) return;

      wrapper.style.position = "relative";
      previewEl = document.createElement("div");
      previewEl.className = "md-preview-container";

      const toolbar = document.createElement("div");
      toolbar.className = "md-preview-toolbar";
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "✕ Close";
      closeBtn.addEventListener("click", hide);
      toolbar.appendChild(closeBtn);

      wrapper.appendChild(toolbar);
      wrapper.appendChild(previewEl);

      // Shrink editor to 50%
      ctx.editor.layout();
      visible = true;
      updatePreview();
    };

    const hide = () => {
      if (!visible) return;
      const wrapper = getWrapper();
      previewEl?.remove();
      wrapper?.querySelector(".md-preview-toolbar")?.remove();
      previewEl = null;
      visible = false;
      ctx.editor.layout();
    };

    const toggle = () => {
      if (!isMarkdownLang(ctx.getLanguage())) {
        ctx.notify("Markdown preview is only available for .md files", "info");
        return;
      }
      visible ? hide() : show();
    };

    /* Register toggle action */
    ctx.addAction({
      id: "markdown-preview.toggle",
      label: "Toggle Markdown Preview",
      keybindings: [
        ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.KeyV,
      ],
      run: toggle,
    });

    /* Update on content change when visible */
    let debounce: ReturnType<typeof setTimeout>;
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        clearTimeout(debounce);
        debounce = setTimeout(updatePreview, 300);
      }),
    );

    /* Auto-show for .md files */
    if (isMarkdownLang(ctx.getLanguage())) {
      // Don't auto-show, but let user know via action
    }

    ctx.addDisposable({
      dispose() {
        disposed = true;
        hide();
      },
    });
  },

  onLanguageChange(language: string) {
    // Could auto-close when switching away from markdown
    // But we let the user control it via toggle
    void language;
  },
};
