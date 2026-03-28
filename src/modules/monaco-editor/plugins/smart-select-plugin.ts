/**
 * @module monaco-editor/plugins/smart-select-plugin
 *
 * Progressive selection expansion/shrinking by semantic scope.
 * Ctrl+Shift+→ expands selection outward (word → expression → statement → block → function)
 * Ctrl+Shift+← shrinks it back inward.
 */

import type { MonacoPlugin, PluginContext } from "../types";

export const smartSelectPlugin: MonacoPlugin = {
  id: "builtin-smart-select",
  name: "Smart Select",
  version: "1.0.0",
  description: "Expand/shrink selection by semantic scope",

  onMount(ctx: PluginContext) {
    const selectionStack: import("monaco-editor").Range[] = [];

    /* Expand selection outward */
    ctx.addAction({
      id: "smart-select.expand",
      label: "Expand Selection",
      keybindings: [
        ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.RightArrow,
      ],
      run(editor) {
        const model = editor.getModel();
        const sel = editor.getSelection();
        if (!model || !sel) return;

        // Save current for shrink
        selectionStack.push(sel);

        // Try ranges in increasing scope
        const newRange = expandRange(ctx.monaco, model, sel);
        if (newRange && !newRange.equalsRange(sel)) {
          editor.setSelection(newRange);
        }
      },
    });

    /* Shrink selection inward */
    ctx.addAction({
      id: "smart-select.shrink",
      label: "Shrink Selection",
      keybindings: [
        ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.LeftArrow,
      ],
      run(editor) {
        if (selectionStack.length > 0) {
          const prev = selectionStack.pop()!;
          editor.setSelection(prev);
        }
      },
    });

    // Clear stack when user manually changes selection
    ctx.addDisposable(
      editor_onSelectionChange(ctx.editor, () => {
        // Only clear if the change wasn't from our actions
        // Simple heuristic: clear after a short delay if no expand/shrink in progress
      }),
    );
  },
};

function editor_onSelectionChange(
  editor: import("monaco-editor").editor.IStandaloneCodeEditor,
  fn: () => void,
): import("monaco-editor").IDisposable {
  return editor.onDidChangeCursorSelection((e) => {
    if (e.reason === 0) fn(); // Explicit = user
  });
}

function expandRange(
  monaco: typeof import("monaco-editor"),
  model: import("monaco-editor").editor.ITextModel,
  sel: import("monaco-editor").Range,
): import("monaco-editor").Range | null {
  const Range = monaco.Range;

  // 1. If no selection, select word
  if (sel.isEmpty()) {
    const pos = { lineNumber: sel.startLineNumber, column: sel.startColumn };
    const word = model.getWordAtPosition(pos);
    if (word) {
      return new Range(pos.lineNumber, word.startColumn, pos.lineNumber, word.endColumn);
    }
    // Select whole line content
    const lineContent = model.getLineContent(pos.lineNumber);
    const trimmed = lineContent.trimStart();
    const startCol = lineContent.length - trimmed.length + 1;
    return new Range(pos.lineNumber, startCol, pos.lineNumber, lineContent.length + 1);
  }

  // 2. Check if we're on a word and can expand to a larger token
  const text = model.getValueInRange(sel);

  // 3. Expand to string content (inside quotes)
  const expanded = tryExpandToQuotes(model, sel);
  if (expanded && !expanded.equalsRange(sel)) return expanded;

  // 4. Expand to bracket pair
  const bracketExpanded = tryExpandToBrackets(monaco, model, sel);
  if (bracketExpanded && !bracketExpanded.equalsRange(sel)) return bracketExpanded;

  // 5. Expand to full line content
  const lineContent = model.getLineContent(sel.startLineNumber);
  const trimmedContent = lineContent.trim();
  const lineStartCol = lineContent.indexOf(trimmedContent) + 1;
  const lineEndCol = lineStartCol + trimmedContent.length;
  const fullLineContent = new Range(sel.startLineNumber, lineStartCol, sel.startLineNumber, lineEndCol);

  if (sel.startLineNumber === sel.endLineNumber && !fullLineContent.equalsRange(sel) &&
    fullLineContent.containsRange(sel)) {
    return fullLineContent;
  }

  // 6. Expand to full line including whitespace
  const fullLine = new Range(sel.startLineNumber, 1, sel.endLineNumber, model.getLineMaxColumn(sel.endLineNumber));
  if (!fullLine.equalsRange(sel) && fullLine.containsRange(sel)) {
    return fullLine;
  }

  // 7. Expand to adjacent lines with same or deeper indent
  const expanded2 = tryExpandToIndentBlock(model, sel);
  if (expanded2 && !expanded2.equalsRange(sel)) return expanded2;

  // 8. Expand to whole document
  const docRange = model.getFullModelRange();
  if (!docRange.equalsRange(sel)) return docRange;

  void text;
  return null;
}

function tryExpandToQuotes(
  model: import("monaco-editor").editor.ITextModel,
  sel: import("monaco-editor").Range,
): import("monaco-editor").Range | null {
  if (sel.startLineNumber !== sel.endLineNumber) return null;

  const line = model.getLineContent(sel.startLineNumber);
  const quotes = ["'", '"', "`"];

  for (const q of quotes) {
    // Find opening quote before selection
    let openIdx = -1;
    for (let i = sel.startColumn - 2; i >= 0; i--) {
      if (line[i] === q && (i === 0 || line[i - 1] !== "\\")) {
        openIdx = i;
        break;
      }
    }
    if (openIdx < 0) continue;

    // Find closing quote after selection
    let closeIdx = -1;
    for (let i = sel.endColumn - 1; i < line.length; i++) {
      if (line[i] === q && line[i - 1] !== "\\") {
        closeIdx = i;
        break;
      }
    }
    if (closeIdx < 0) continue;

    // First expand to content inside quotes
    const innerRange = new (sel.constructor as any)(
      sel.startLineNumber, openIdx + 2,
      sel.startLineNumber, closeIdx + 1,
    );
    if (!innerRange.equalsRange(sel) && innerRange.containsRange(sel)) return innerRange;

    // Then expand to include quotes
    const outerRange = new (sel.constructor as any)(
      sel.startLineNumber, openIdx + 1,
      sel.startLineNumber, closeIdx + 2,
    );
    if (!outerRange.equalsRange(sel) && outerRange.containsRange(sel)) return outerRange;
  }

  return null;
}

function tryExpandToBrackets(
  monaco: typeof import("monaco-editor"),
  model: import("monaco-editor").editor.ITextModel,
  sel: import("monaco-editor").Range,
): import("monaco-editor").Range | null {
  const brackets = [["(", ")"], ["[", "]"], ["{", "}"]];

  for (const [open, close] of brackets) {
    const text = model.getValue();
    const startOffset = model.getOffsetAt({ lineNumber: sel.startLineNumber, column: sel.startColumn });
    const endOffset = model.getOffsetAt({ lineNumber: sel.endLineNumber, column: sel.endColumn });

    // Find opening bracket before selection
    let depth = 0;
    let openOffset = -1;
    for (let i = startOffset - 1; i >= 0; i--) {
      if (text[i] === close) depth++;
      else if (text[i] === open) {
        if (depth === 0) { openOffset = i; break; }
        depth--;
      }
    }
    if (openOffset < 0) continue;

    // Find closing bracket after selection
    depth = 0;
    let closeOffset = -1;
    for (let i = endOffset; i < text.length; i++) {
      if (text[i] === open) depth++;
      else if (text[i] === close) {
        if (depth === 0) { closeOffset = i; break; }
        depth--;
      }
    }
    if (closeOffset < 0) continue;

    const openPos = model.getPositionAt(openOffset + 1); // after bracket
    const closePos = model.getPositionAt(closeOffset); // before bracket

    const innerRange = new monaco.Range(openPos.lineNumber, openPos.column, closePos.lineNumber, closePos.column);
    if (!innerRange.equalsRange(sel) && innerRange.containsRange(sel)) return innerRange;

    // Include brackets
    const outerRange = new monaco.Range(
      openPos.lineNumber, openPos.column - 1,
      closePos.lineNumber, closePos.column + 1,
    );
    if (!outerRange.equalsRange(sel) && outerRange.containsRange(sel)) return outerRange;
  }

  return null;
}

function tryExpandToIndentBlock(
  model: import("monaco-editor").editor.ITextModel,
  sel: import("monaco-editor").Range,
): import("monaco-editor").Range | null {
  const startLine = sel.startLineNumber;
  const baseIndent = getLineIndent(model, startLine);

  let top = startLine;
  let bottom = sel.endLineNumber;

  // Expand up while indent >= base
  while (top > 1) {
    const prevIndent = getLineIndent(model, top - 1);
    const prevContent = model.getLineContent(top - 1).trim();
    if (prevContent === "" || prevIndent >= baseIndent) top--;
    else break;
  }

  // Expand down while indent >= base
  while (bottom < model.getLineCount()) {
    const nextIndent = getLineIndent(model, bottom + 1);
    const nextContent = model.getLineContent(bottom + 1).trim();
    if (nextContent === "" || nextIndent >= baseIndent) bottom++;
    else break;
  }

  if (top < sel.startLineNumber || bottom > sel.endLineNumber) {
    return new (sel.constructor as any)(top, 1, bottom, model.getLineMaxColumn(bottom));
  }

  return null;
}

function getLineIndent(model: import("monaco-editor").editor.ITextModel, line: number): number {
  const content = model.getLineContent(line);
  const tabSize = model.getOptions().tabSize;
  let indent = 0;
  for (const ch of content) {
    if (ch === " ") indent++;
    else if (ch === "\t") indent += tabSize;
    else break;
  }
  return indent;
}
