/**
 * @module editor/plugins/builtin/markdown-preview
 *
 * Markdown preview pane plugin.
 * Registers a side panel that renders live Markdown preview using
 * a lightweight parser (no external deps – uses regex-based conversion).
 */
import { createElement } from "react";
import type { ExtendedEditorPlugin, ExtendedPluginAPI, PanelDescriptor } from "../types";

// ── Lightweight Markdown → HTML converter ────────────────────

function markdownToHtml(md: string): string {
    let html = md;

    // Escape HTML
    html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Code blocks (```...```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
        return `<pre class="md-code-block" data-lang="${lang}"><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Headers
    html = html.replace(/^######\s+(.+)$/gm, '<h6 class="md-h6">$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');

    // Bold & Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
    html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
    html = html.replace(/_(.+?)_/g, "<em>$1</em>");

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

    // Blockquotes
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr class="md-hr" />');

    // Unordered lists
    html = html.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li class="md-li">$1</li>');
    html = html.replace(/((?:<li class="md-li">.*<\/li>\n?)+)/g, '<ul class="md-ul">$1</ul>');

    // Ordered lists
    html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="md-oli">$1</li>');
    html = html.replace(/((?:<li class="md-oli">.*<\/li>\n?)+)/g, '<ol class="md-ol">$1</ol>');

    // Links & Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="md-img" alt="$1" src="$2" />');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener">$1</a>');

    // Task lists
    html = html.replace(/<li class="md-li">\[x\]\s*/gi, '<li class="md-li md-task md-task-done">&#9745; ');
    html = html.replace(/<li class="md-li">\[\s?\]\s*/gi, '<li class="md-li md-task">&#9744; ');

    // Tables (simple)
    html = html.replace(/^(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)+)/gm, (_m, header, _sep, body) => {
        const headers = (header as string).split("|").filter(Boolean).map((h: string) => `<th>${h.trim()}</th>`).join("");
        const rows = (body as string).trim().split("\n").map((row: string) => {
            const cells = row.split("|").filter(Boolean).map((c: string) => `<td>${c.trim()}</td>`).join("");
            return `<tr>${cells}</tr>`;
        }).join("");
        return `<table class="md-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    });

    // Paragraphs (lines that aren't already wrapped in block elements)
    html = html.replace(/^(?!<[a-z/])((?:(?!^$).)+)$/gm, "<p>$1</p>");

    // Clean up double-wrapped paragraphs
    html = html.replace(/<p><(h[1-6]|ul|ol|li|blockquote|pre|hr|table)/g, "<$1");
    html = html.replace(/<\/(h[1-6]|ul|ol|li|blockquote|pre|table)><\/p>/g, "</$1>");

    return html;
}

// ── Preview panel styles ─────────────────────────────────────

const PREVIEW_STYLES = `
.md-preview {
    padding: 16px 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: var(--editor-foreground, #f8f8f2);
    overflow-y: auto;
    height: 100%;
}
.md-preview h1 { font-size: 2em; font-weight: 700; margin: 0.67em 0; border-bottom: 1px solid var(--editor-border, #44475a); padding-bottom: 0.3em; }
.md-preview h2 { font-size: 1.5em; font-weight: 600; margin: 0.83em 0; border-bottom: 1px solid var(--editor-border, #44475a); padding-bottom: 0.3em; }
.md-preview h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0; }
.md-preview h4 { font-size: 1em; font-weight: 600; margin: 1em 0; }
.md-preview h5 { font-size: 0.875em; font-weight: 600; margin: 1em 0; }
.md-preview h6 { font-size: 0.85em; font-weight: 600; margin: 1em 0; color: var(--editor-muted, #6272a4); }
.md-preview p { margin: 0.5em 0; }
.md-preview strong { font-weight: 700; }
.md-preview em { font-style: italic; }
.md-preview del { text-decoration: line-through; opacity: 0.7; }
.md-preview a.md-link { color: var(--editor-accent, #8be9fd); text-decoration: underline; }
.md-preview img.md-img { max-width: 100%; border-radius: 4px; margin: 8px 0; }
.md-preview code.md-inline-code {
    background: var(--editor-input-bg, #44475a);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: var(--editor-font-family, monospace);
    font-size: 0.9em;
}
.md-preview pre.md-code-block {
    background: var(--editor-input-bg, #282a36);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
    border: 1px solid var(--editor-border, #44475a);
}
.md-preview pre.md-code-block code { font-family: var(--editor-font-family, monospace); font-size: 0.9em; }
.md-preview blockquote.md-blockquote {
    border-left: 4px solid var(--editor-accent, #6272a4);
    padding-left: 16px;
    margin: 8px 0;
    color: var(--editor-muted, #6272a4);
}
.md-preview .md-hr { border: none; border-top: 1px solid var(--editor-border, #44475a); margin: 16px 0; }
.md-preview ul.md-ul, .md-preview ol.md-ol { padding-left: 24px; margin: 8px 0; }
.md-preview li.md-li, .md-preview li.md-oli { margin: 4px 0; }
.md-preview li.md-task { list-style: none; margin-left: -20px; }
.md-preview li.md-task-done { opacity: 0.7; }
.md-preview table.md-table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.md-preview table.md-table th, .md-preview table.md-table td {
    border: 1px solid var(--editor-border, #44475a);
    padding: 6px 12px;
    text-align: left;
}
.md-preview table.md-table th { background: var(--editor-input-bg, #44475a); font-weight: 600; }
`;

// ── React component for preview ──────────────────────────────

function MarkdownPreviewPanel({ api }: { api: ExtendedPluginAPI }) {
    const content = api.getContent();
    const html = markdownToHtml(content);

    return createElement("div", { className: "md-preview-wrapper", style: { height: "100%", overflow: "hidden" } },
        createElement("style", null, PREVIEW_STYLES),
        createElement("div", {
            className: "md-preview",
            dangerouslySetInnerHTML: { __html: html },
        }),
    );
}

export function createMarkdownPreviewPlugin(): ExtendedEditorPlugin {
    return {
        id: "markdown-preview",
        name: "Markdown Preview",
        version: "1.0.0",
        description: "Live Markdown preview pane",
        category: "language",
        defaultEnabled: true,

        panels: [
            {
                id: "markdown-preview:panel",
                title: "Markdown Preview",
                position: "right",
                defaultSize: 400,
                render: (api) => createElement(MarkdownPreviewPanel, { api }),
            },
        ],

        onActivate(api) {
            // Auto-open preview when editing markdown files
            const { fileName } = api.getFileInfo();
            const ext = fileName.split(".").pop()?.toLowerCase();
            if (ext === "md" || ext === "markdown" || ext === "mdx") {
                api.togglePanel("markdown-preview:panel");
            }

            api.registerKeybinding({
                id: "markdown-preview:toggle",
                label: "Toggle Markdown Preview",
                keys: "Ctrl+Shift+M",
                handler: () => api.togglePanel("markdown-preview:panel"),
                when: "editor",
                category: "Markdown",
            });
        },

        onLanguageChange(language, api) {
            // Auto-toggle based on language
            const isMarkdown = language.toLowerCase().includes("markdown");
            const isOpen = api.isPanelOpen("markdown-preview:panel");
            if (isMarkdown && !isOpen) {
                api.togglePanel("markdown-preview:panel");
            } else if (!isMarkdown && isOpen) {
                api.togglePanel("markdown-preview:panel");
            }
        },
    };
}
