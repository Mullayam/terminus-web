/**
 * @module monaco-editor/plugins/bracket-pair-lines-plugin
 *
 * Draws subtle connecting lines between matching bracket pairs
 * using decorations (horizontal/vertical guides).
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "bracket-pair-lines-plugin-css";

const PAIR_COLORS = [
  "rgba(255, 215, 0, 0.15)",
  "rgba(218, 112, 214, 0.15)",
  "rgba(0, 191, 255, 0.15)",
  "rgba(50, 205, 50, 0.15)",
];

const BORDER_COLORS = [
  "rgba(255, 215, 0, 0.35)",
  "rgba(218, 112, 214, 0.35)",
  "rgba(0, 191, 255, 0.35)",
  "rgba(50, 205, 50, 0.35)",
];

function buildCSS(): string {
  let css = "";
  for (let i = 0; i < PAIR_COLORS.length; i++) {
    css += `.bpl-scope-${i} { border-left: 1px solid ${BORDER_COLORS[i]}; }\n`;
    css += `.bpl-highlight-${i} { background: ${PAIR_COLORS[i]}; }\n`;
  }
  return css;
}

const OPEN_BRACKETS = new Set(["(", "[", "{"]);
const CLOSE_BRACKETS = new Set([")", "]", "}"]);
const BRACKET_MAP: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

export const bracketPairLinesPlugin: MonacoPlugin = {
  id: "builtin-bracket-pair-lines",
  name: "Bracket Pair Lines",
  version: "1.0.0",
  description: "Draw guide lines between matching bracket pairs",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = buildCSS();
      document.head.appendChild(style);
    }

    let decorationIds: string[] = [];

    const update = () => {
      const pos = ctx.editor.getPosition();
      const model = ctx.editor.getModel();
      if (!pos || !model) {
        decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
        return;
      }

      const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = [];

      // Find brackets near cursor and highlight the scope between them
      const line = model.getLineContent(pos.lineNumber);
      const charBefore = line[pos.column - 2] ?? "";
      const charAt = line[pos.column - 1] ?? "";
      const bracketChar = OPEN_BRACKETS.has(charAt)
        ? charAt
        : OPEN_BRACKETS.has(charBefore)
          ? charBefore
          : CLOSE_BRACKETS.has(charAt)
            ? charAt
            : CLOSE_BRACKETS.has(charBefore)
              ? charBefore
              : "";

      if (!bracketChar) {
        decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
        return;
      }

      const isOpen = OPEN_BRACKETS.has(bracketChar);
      const col = charAt === bracketChar ? pos.column : pos.column - 1;

      // Use Monaco's built-in bracket matching
      const matchResult = (model as any).bracketPairs?.matchBracket?.({ lineNumber: pos.lineNumber, column: col });
      let startPos: { lineNumber: number; column: number } | null = null;
      let endPos: { lineNumber: number; column: number } | null = null;

      if (matchResult) {
        const [r1, r2] = matchResult;
        startPos = { lineNumber: r1.startLineNumber, column: r1.startColumn };
        endPos = { lineNumber: r2.startLineNumber, column: r2.startColumn };
      } else {
        // Fallback: manual bracket matching
        const matched = findMatchingBracket(model, pos.lineNumber, col, bracketChar, isOpen);
        if (!matched) {
          decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
          return;
        }
        if (isOpen) {
          startPos = { lineNumber: pos.lineNumber, column: col };
          endPos = matched;
        } else {
          startPos = matched;
          endPos = { lineNumber: pos.lineNumber, column: col };
        }
      }

      if (!startPos || !endPos) {
        decorationIds = ctx.editor.deltaDecorations(decorationIds, []);
        return;
      }

      // Ensure start is before end
      if (startPos.lineNumber > endPos.lineNumber) {
        [startPos, endPos] = [endPos, startPos];
      }

      const depth = 0; // Could nest depth detection but keep it simple
      const colorIdx = depth % PAIR_COLORS.length;

      // Highlight the opening and closing bracket characters
      decorations.push({
        range: new ctx.monaco.Range(startPos.lineNumber, startPos.column, startPos.lineNumber, startPos.column + 1),
        options: { className: `bpl-highlight-${colorIdx}`, stickiness: ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
      });
      decorations.push({
        range: new ctx.monaco.Range(endPos.lineNumber, endPos.column, endPos.lineNumber, endPos.column + 1),
        options: { className: `bpl-highlight-${colorIdx}`, stickiness: ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
      });

      // Draw vertical indent guide between the lines
      if (endPos.lineNumber - startPos.lineNumber > 1) {
        for (let l = startPos.lineNumber + 1; l < endPos.lineNumber; l++) {
          decorations.push({
            range: new ctx.monaco.Range(l, 1, l, 1),
            options: {
              linesDecorationsClassName: `bpl-scope-${colorIdx}`,
              stickiness: ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            },
          });
        }
      }

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
    };

    let timer: ReturnType<typeof setTimeout>;
    ctx.addDisposable(
      ctx.editor.onDidChangeCursorPosition(() => {
        clearTimeout(timer);
        timer = setTimeout(update, 80);
      }),
    );

    update();
  },
};

function findMatchingBracket(
  model: import("monaco-editor").editor.ITextModel,
  line: number,
  col: number,
  bracket: string,
  isOpen: boolean,
): { lineNumber: number; column: number } | null {
  const target = isOpen ? ({ "(": ")", "[": "]", "{": "}" } as Record<string, string>)[bracket] : BRACKET_MAP[bracket];
  const direction = isOpen ? 1 : -1;
  let depth = 0;
  let ln = line;
  const lineCount = model.getLineCount();

  while (ln >= 1 && ln <= lineCount) {
    const content = model.getLineContent(ln);
    const startCol = ln === line ? (isOpen ? col : col - 2) : (isOpen ? 0 : content.length - 1);

    for (let c = startCol; c >= 0 && c < content.length; c += direction) {
      const ch = content[c];
      if (ch === bracket) depth++;
      else if (ch === target) {
        if (depth === 0) return { lineNumber: ln, column: c + 1 };
        depth--;
      }
    }
    ln += direction;
  }

  return null;
}
