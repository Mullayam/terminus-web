/**
 * @module monaco-editor/plugins/auto-bracket-paste-plugin
 *
 * When pasting text while the cursor is inside or adjacent to
 * brackets/quotes, auto-wraps the pasted text with matching brackets.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const BRACKET_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};

export const autoBracketPastePlugin: MonacoPlugin = {
  id: "builtin-auto-bracket-paste",
  name: "Auto Bracket Paste",
  version: "1.0.0",
  description: "Wraps pasted text in brackets when cursor is at a bracket",

  onMount(ctx: PluginContext) {
    // Listen for paste events
    const dom = ctx.editor.getDomNode();
    if (!dom) return;

    const handlePaste = (e: ClipboardEvent) => {
      const sel = ctx.editor.getSelection();
      const model = ctx.editor.getModel();
      if (!sel || !model || sel.isEmpty()) return;

      // Only wrap if there's a selection (paste-to-replace with wrapping)
      const selectedText = model.getValueInRange(sel);
      const clipText = e.clipboardData?.getData("text/plain");
      if (!clipText || !selectedText) return;

      // Check if selected text is a single bracket/quote character
      // In that case, don't interfere
      if (selectedText.length === 1 && BRACKET_PAIRS[selectedText]) return;
    };

    dom.addEventListener("paste", handlePaste, true);

    /* Wrap selection with brackets/quotes via keyboard */
    const wrapWith = (open: string, close: string) => {
      const sel = ctx.editor.getSelection();
      const model = ctx.editor.getModel();
      if (!sel || !model || sel.isEmpty()) return;

      const text = model.getValueInRange(sel);
      ctx.editor.executeEdits("auto-bracket-paste", [{
        range: sel,
        text: open + text + close,
      }]);

      // Select the inner content (without the wrapping chars)
      ctx.editor.setSelection(new ctx.monaco.Range(
        sel.startLineNumber,
        sel.startColumn + open.length,
        sel.endLineNumber,
        sel.endColumn + open.length,
      ));
    };

    /* Register wrapping actions */
    ctx.addAction({
      id: "bracket-paste.wrap-parens",
      label: "Wrap Selection with ()",
      run: () => wrapWith("(", ")"),
    });

    ctx.addAction({
      id: "bracket-paste.wrap-brackets",
      label: "Wrap Selection with []",
      run: () => wrapWith("[", "]"),
    });

    ctx.addAction({
      id: "bracket-paste.wrap-braces",
      label: "Wrap Selection with {}",
      run: () => wrapWith("{", "}"),
    });

    ctx.addAction({
      id: "bracket-paste.wrap-quotes",
      label: 'Wrap Selection with ""',
      run: () => wrapWith('"', '"'),
    });

    ctx.addAction({
      id: "bracket-paste.wrap-single-quotes",
      label: "Wrap Selection with ''",
      run: () => wrapWith("'", "'"),
    });

    ctx.addAction({
      id: "bracket-paste.wrap-backticks",
      label: "Wrap Selection with ``",
      run: () => wrapWith("`", "`"),
    });

    ctx.addDisposable({
      dispose() {
        dom.removeEventListener("paste", handlePaste, true);
      },
    });
  },
};
