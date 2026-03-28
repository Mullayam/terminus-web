/**
 * @module monaco-editor/plugins/comment-anchors-plugin
 *
 * Highlight TODO, FIXME, HACK, NOTE, BUG, WARN, PERF anchors
 * with colored backgrounds, gutter icons, and a list-all action.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "comment-anchors-plugin-css";

interface AnchorDef {
  tag: string;
  color: string;       // text color
  bg: string;          // background
  glyph: string;       // gutter glyph color
  icon: string;        // glyph character
}

const ANCHORS: AnchorDef[] = [
  { tag: "TODO",    color: "#f0a500", bg: "rgba(240,165,0,0.12)",   glyph: "#f0a500", icon: "☐" },
  { tag: "FIXME",   color: "#e74c3c", bg: "rgba(231,76,60,0.12)",   glyph: "#e74c3c", icon: "⚠" },
  { tag: "HACK",    color: "#9b59b6", bg: "rgba(155,89,182,0.12)",  glyph: "#9b59b6", icon: "⚡" },
  { tag: "NOTE",    color: "#3498db", bg: "rgba(52,152,219,0.12)",  glyph: "#3498db", icon: "📝" },
  { tag: "BUG",     color: "#e74c3c", bg: "rgba(231,76,60,0.15)",   glyph: "#e74c3c", icon: "🐛" },
  { tag: "WARN",    color: "#e67e22", bg: "rgba(230,126,34,0.12)",  glyph: "#e67e22", icon: "⚠" },
  { tag: "PERF",    color: "#2ecc71", bg: "rgba(46,204,113,0.12)",  glyph: "#2ecc71", icon: "⏱" },
  { tag: "REVIEW",  color: "#1abc9c", bg: "rgba(26,188,156,0.12)",  glyph: "#1abc9c", icon: "👀" },
];

function buildCSS(): string {
  let css = "";
  for (const a of ANCHORS) {
    const tag = a.tag.toLowerCase();
    css += `
.anchor-line-${tag} {
  background: ${a.bg};
}
.anchor-glyph-${tag} {
  color: ${a.glyph};
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.anchor-inline-${tag} {
  color: ${a.color} !important;
  font-weight: 600;
}
`;
  }
  return css;
}

interface AnchorMatch {
  line: number;
  column: number;
  endColumn: number;
  tag: string;
  text: string;
}

function findAnchors(content: string): AnchorMatch[] {
  const results: AnchorMatch[] = [];
  const lines = content.split("\n");
  // Build a combined regex for all tags
  const tagPattern = ANCHORS.map((a) => a.tag).join("|");
  const re = new RegExp(`\\b(${tagPattern})\\b[:\\s]?(.*)`, "gi");

  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(lines[i])) !== null) {
      const tag = match[1].toUpperCase();
      results.push({
        line: i + 1,
        column: match.index + 1,
        endColumn: match.index + 1 + match[1].length,
        tag,
        text: match[2]?.trim() || "",
      });
    }
  }
  return results;
}

export const commentAnchorsPlugin: MonacoPlugin = {
  id: "builtin-comment-anchors",
  name: "Comment Anchors",
  version: "1.0.0",
  description: "Highlight TODO, FIXME, HACK, NOTE, BUG anchors with gutter icons",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = buildCSS();
      document.head.appendChild(style);
    }

    let decorationIds: string[] = [];

    const updateDecorations = () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      const content = model.getValue();
      const anchors = findAnchors(content);

      const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = [];

      for (const anchor of anchors) {
        const def = ANCHORS.find((a) => a.tag === anchor.tag);
        if (!def) continue;
        const tag = def.tag.toLowerCase();

        // Whole line background
        decorations.push({
          range: new ctx.monaco.Range(anchor.line, 1, anchor.line, 1),
          options: {
            isWholeLine: true,
            className: `anchor-line-${tag}`,
            glyphMarginClassName: `anchor-glyph-${tag}`,
            glyphMarginHoverMessage: { value: `**${def.tag}**: ${anchor.text}` },
            overviewRuler: {
              color: def.glyph,
              position: ctx.monaco.editor.OverviewRulerLane.Right,
            },
            minimap: {
              color: def.glyph,
              position: ctx.monaco.editor.MinimapPosition.Inline,
            },
          },
        });

        // Inline tag highlight
        decorations.push({
          range: new ctx.monaco.Range(anchor.line, anchor.column, anchor.line, anchor.endColumn),
          options: {
            inlineClassName: `anchor-inline-${tag}`,
          },
        });
      }

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
    };

    // Initial scan
    updateDecorations();

    // Re-scan on content change (debounced)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateDecorations, 300);
      }),
    );

    // Re-scan on model change
    ctx.addDisposable(
      ctx.editor.onDidChangeModel(() => {
        decorationIds = [];
        updateDecorations();
      }),
    );

    // ── List All Anchors action ──
    ctx.addAction({
      id: "commentAnchors.listAll",
      label: "Comment Anchors: List All",
      run(editor) {
        const model = editor.getModel();
        if (!model) return;
        const anchors = findAnchors(model.getValue());

        if (anchors.length === 0) {
          ctx.notify("No comment anchors found", "info");
          return;
        }

        // Group by tag
        const groups: Record<string, AnchorMatch[]> = {};
        for (const a of anchors) {
          (groups[a.tag] ??= []).push(a);
        }

        const lines: string[] = [];
        for (const tag of Object.keys(groups).sort()) {
          lines.push(`**${tag}** (${groups[tag].length}):`);
          for (const m of groups[tag]) {
            lines.push(`  Line ${m.line}: ${m.text || "(no description)"}`);
          }
        }

        ctx.notify(lines.join("\n"), "info");
      },
    });

    // ── Jump to next anchor ──
    ctx.addAction({
      id: "commentAnchors.next",
      label: "Comment Anchors: Jump to Next",
      keybindings: [ctx.monaco.KeyMod.Alt | ctx.monaco.KeyCode.F3],
      run(editor) {
        const model = editor.getModel();
        if (!model) return;
        const anchors = findAnchors(model.getValue());
        if (!anchors.length) return;

        const line = editor.getPosition()?.lineNumber ?? 0;
        const next = anchors.find((a) => a.line > line) ?? anchors[0];
        editor.setPosition({ lineNumber: next.line, column: next.column });
        editor.revealLineInCenter(next.line);
      },
    });

    // ── Jump to previous anchor ──
    ctx.addAction({
      id: "commentAnchors.prev",
      label: "Comment Anchors: Jump to Previous",
      keybindings: [ctx.monaco.KeyMod.Alt | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.F3],
      run(editor) {
        const model = editor.getModel();
        if (!model) return;
        const anchors = findAnchors(model.getValue());
        if (!anchors.length) return;

        const line = editor.getPosition()?.lineNumber ?? Infinity;
        const prev = [...anchors].reverse().find((a) => a.line < line) ?? anchors[anchors.length - 1];
        editor.setPosition({ lineNumber: prev.line, column: prev.column });
        editor.revealLineInCenter(prev.line);
      },
    });
  },
};
