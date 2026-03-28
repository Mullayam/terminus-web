/**
 * @module monaco-editor/plugins/toggle-comment-style-plugin
 *
 * Switch between line comments (//) and block comments (/* *​/)
 * for the current selection or line. Supports language-specific
 * comment tokens for JS/TS, Python, HTML, CSS, etc.
 */

import type { MonacoPlugin, PluginContext } from "../types";

interface CommentTokens {
  line?: string;
  blockStart: string;
  blockEnd: string;
}

const COMMENT_MAP: Record<string, CommentTokens> = {
  javascript:  { line: "//", blockStart: "/*", blockEnd: "*/" },
  typescript:  { line: "//", blockStart: "/*", blockEnd: "*/" },
  javascriptreact: { line: "//", blockStart: "{/*", blockEnd: "*/}" },
  typescriptreact: { line: "//", blockStart: "{/*", blockEnd: "*/}" },
  java:        { line: "//", blockStart: "/*", blockEnd: "*/" },
  c:           { line: "//", blockStart: "/*", blockEnd: "*/" },
  cpp:         { line: "//", blockStart: "/*", blockEnd: "*/" },
  csharp:      { line: "//", blockStart: "/*", blockEnd: "*/" },
  go:          { line: "//", blockStart: "/*", blockEnd: "*/" },
  rust:        { line: "//", blockStart: "/*", blockEnd: "*/" },
  swift:       { line: "//", blockStart: "/*", blockEnd: "*/" },
  kotlin:      { line: "//", blockStart: "/*", blockEnd: "*/" },
  php:         { line: "//", blockStart: "/*", blockEnd: "*/" },
  scss:        { line: "//", blockStart: "/*", blockEnd: "*/" },
  less:        { line: "//", blockStart: "/*", blockEnd: "*/" },
  css:         { blockStart: "/*", blockEnd: "*/" },
  html:        { blockStart: "<!--", blockEnd: "-->" },
  xml:         { blockStart: "<!--", blockEnd: "-->" },
  svg:         { blockStart: "<!--", blockEnd: "-->" },
  python:      { line: "#", blockStart: '"""', blockEnd: '"""' },
  ruby:        { line: "#", blockStart: "=begin", blockEnd: "=end" },
  perl:        { line: "#", blockStart: "=pod", blockEnd: "=cut" },
  bash:        { line: "#", blockStart: ": '", blockEnd: "'" },
  shell:       { line: "#", blockStart: ": '", blockEnd: "'" },
  yaml:        { line: "#", blockStart: "#", blockEnd: "" },
  dockerfile:  { line: "#", blockStart: "#", blockEnd: "" },
  sql:         { line: "--", blockStart: "/*", blockEnd: "*/" },
  lua:         { line: "--", blockStart: "--[[", blockEnd: "]]" },
};

const DEFAULT_TOKENS: CommentTokens = { line: "//", blockStart: "/*", blockEnd: "*/" };

function getTokens(languageId: string): CommentTokens {
  return COMMENT_MAP[languageId] || DEFAULT_TOKENS;
}

function trimmedStartsWith(line: string, prefix: string): boolean {
  return line.trimStart().startsWith(prefix);
}

export const toggleCommentStylePlugin: MonacoPlugin = {
  id: "builtin-toggle-comment-style",
  name: "Toggle Comment Style",
  version: "1.0.0",
  description: "Switch between // line and /* */ block comment styles",

  onMount(ctx: PluginContext) {
    // ── Toggle: line ↔ block ──
    ctx.addAction({
      id: "toggleComment.lineToBlock",
      label: "Toggle Comment Style (Line ↔ Block)",
      keybindings: [
        ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Alt | ctx.monaco.KeyCode.Slash,
      ],
      run(editor) {
        const model = editor.getModel();
        if (!model) return;
        const lang = model.getLanguageId();
        const tokens = getTokens(lang);

        const selection = editor.getSelection();
        if (!selection) return;

        const startLine = selection.startLineNumber;
        const endLine = selection.endLineNumber;

        // Get the selected lines
        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
          lines.push(model.getLineContent(i));
        }

        const fullText = lines.join("\n");

        // Detect current comment style
        if (tokens.line && lines.every((l) => l.trim() === "" || trimmedStartsWith(l, tokens.line!))) {
          // Currently line-commented → convert to block
          const uncommented = lines.map((l) => {
            const trimmed = l.trimStart();
            if (trimmed === "") return l;
            const indent = l.slice(0, l.length - trimmed.length);
            const withoutComment = trimmed.startsWith(tokens.line! + " ")
              ? trimmed.slice(tokens.line!.length + 1)
              : trimmed.slice(tokens.line!.length);
            return indent + withoutComment;
          });

          const minIndent = uncommented
            .filter((l) => l.trim() !== "")
            .reduce((min, l) => {
              const indent = l.length - l.trimStart().length;
              return Math.min(min, indent);
            }, Infinity);

          const indentStr = " ".repeat(minIndent === Infinity ? 0 : minIndent);
          const blockText = `${indentStr}${tokens.blockStart}\n${uncommented.join("\n")}\n${indentStr}${tokens.blockEnd}`;

          const range = new ctx.monaco.Range(
            startLine, 1,
            endLine, model.getLineMaxColumn(endLine),
          );

          editor.executeEdits("toggle-comment-style", [{ range, text: blockText }]);
          ctx.notify(`Converted to block comment (${tokens.blockStart} ... ${tokens.blockEnd})`, "info");
        } else if (
          fullText.trimStart().startsWith(tokens.blockStart) &&
          fullText.trimEnd().endsWith(tokens.blockEnd)
        ) {
          // Currently block-commented → convert to line comments
          let inner = fullText.trim();
          inner = inner.slice(tokens.blockStart.length);
          inner = inner.slice(0, inner.length - tokens.blockEnd.length);

          // Remove leading/trailing blank lines from the inner content
          const innerLines = inner.split("\n");
          while (innerLines.length && innerLines[0].trim() === "") innerLines.shift();
          while (innerLines.length && innerLines[innerLines.length - 1].trim() === "") innerLines.pop();

          if (tokens.line) {
            const commented = innerLines.map((l) => {
              if (l.trim() === "") return l;
              const indent = l.length - l.trimStart().length;
              return l.slice(0, indent) + tokens.line + " " + l.trimStart();
            });

            const range = new ctx.monaco.Range(
              startLine, 1,
              endLine, model.getLineMaxColumn(endLine),
            );

            editor.executeEdits("toggle-comment-style", [{ range, text: commented.join("\n") }]);
            ctx.notify(`Converted to line comments (${tokens.line})`, "info");
          } else {
            ctx.notify(`${lang} does not support line comments`, "warning");
          }
        } else {
          // Not commented → apply line comment
          if (tokens.line) {
            const commented = lines.map((l) => {
              if (l.trim() === "") return l;
              const indent = l.length - l.trimStart().length;
              return l.slice(0, indent) + tokens.line + " " + l.trimStart();
            });

            const range = new ctx.monaco.Range(
              startLine, 1,
              endLine, model.getLineMaxColumn(endLine),
            );

            editor.executeEdits("toggle-comment-style", [{ range, text: commented.join("\n") }]);
          } else {
            // Language only has block comments
            const minIndent = lines
              .filter((l) => l.trim() !== "")
              .reduce((min, l) => Math.min(min, l.length - l.trimStart().length), Infinity);

            const indentStr = " ".repeat(minIndent === Infinity ? 0 : minIndent);
            const blockText = `${indentStr}${tokens.blockStart}\n${lines.join("\n")}\n${indentStr}${tokens.blockEnd}`;

            const range = new ctx.monaco.Range(
              startLine, 1,
              endLine, model.getLineMaxColumn(endLine),
            );

            editor.executeEdits("toggle-comment-style", [{ range, text: blockText }]);
          }
        }
      },
    });

    // ── Wrap selection in block comment ──
    ctx.addAction({
      id: "toggleComment.wrapBlock",
      label: "Wrap Selection in Block Comment",
      run(editor) {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (!model || !selection || selection.isEmpty()) {
          ctx.notify("Select text to wrap in block comment", "warning");
          return;
        }

        const lang = model.getLanguageId();
        const tokens = getTokens(lang);
        const text = model.getValueInRange(selection);

        editor.executeEdits("toggle-comment-style", [
          {
            range: selection,
            text: `${tokens.blockStart} ${text} ${tokens.blockEnd}`,
          },
        ]);
      },
    });

    // ── Remove all comments from selection ──
    ctx.addAction({
      id: "toggleComment.stripComments",
      label: "Strip Comments from Selection",
      run(editor) {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (!model || !selection || selection.isEmpty()) {
          ctx.notify("Select text to strip comments from", "warning");
          return;
        }

        const lang = model.getLanguageId();
        const tokens = getTokens(lang);
        let text = model.getValueInRange(selection);

        // Remove block comments
        if (tokens.blockStart && tokens.blockEnd) {
          const blockStartEsc = tokens.blockStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const blockEndEsc = tokens.blockEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          text = text.replace(new RegExp(`${blockStartEsc}[\\s\\S]*?${blockEndEsc}`, "g"), "");
        }

        // Remove line comments
        if (tokens.line) {
          const lineEsc = tokens.line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          text = text.replace(new RegExp(`${lineEsc}.*$`, "gm"), "");
        }

        editor.executeEdits("toggle-comment-style", [{ range: selection, text }]);
        ctx.notify("Comments stripped", "info");
      },
    });
  },
};
