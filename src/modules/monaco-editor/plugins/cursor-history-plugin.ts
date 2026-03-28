/**
 * @module monaco-editor/plugins/cursor-history-plugin
 *
 * Navigate back/forward through cursor position history.
 * Alt+← goes back, Alt+→ goes forward (like VS Code).
 */

import type { MonacoPlugin, PluginContext } from "../types";

interface CursorEntry {
  lineNumber: number;
  column: number;
  timestamp: number;
}

const MAX_HISTORY = 100;
const MIN_DISTANCE = 5; // lines apart to count as a new entry

export const cursorHistoryPlugin: MonacoPlugin = {
  id: "builtin-cursor-history",
  name: "Cursor History",
  version: "1.0.0",
  description: "Navigate cursor position history with Alt+←/→",

  onMount(ctx: PluginContext) {
    const history: CursorEntry[] = [];
    let historyIdx = -1;
    let navigating = false;

    const pushEntry = (lineNumber: number, column: number) => {
      if (navigating) return;

      const last = history[historyIdx];
      if (last && Math.abs(last.lineNumber - lineNumber) < MIN_DISTANCE) {
        // Update in place for small movements
        last.lineNumber = lineNumber;
        last.column = column;
        last.timestamp = Date.now();
        return;
      }

      // Truncate forward history if we moved
      if (historyIdx < history.length - 1) {
        history.length = historyIdx + 1;
      }

      history.push({ lineNumber, column, timestamp: Date.now() });
      if (history.length > MAX_HISTORY) history.shift();
      historyIdx = history.length - 1;
    };

    let debounce: ReturnType<typeof setTimeout>;
    ctx.addDisposable(
      ctx.editor.onDidChangeCursorPosition((e) => {
        if (navigating) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          pushEntry(e.position.lineNumber, e.position.column);
        }, 300);
      }),
    );

    // Initialize with current position
    const pos = ctx.editor.getPosition();
    if (pos) pushEntry(pos.lineNumber, pos.column);

    /* Go back */
    ctx.addAction({
      id: "cursor-history.back",
      label: "Go Back",
      keybindings: [ctx.monaco.KeyMod.Alt | ctx.monaco.KeyCode.LeftArrow],
      run(editor) {
        if (historyIdx <= 0) return;
        navigating = true;
        historyIdx--;
        const entry = history[historyIdx];
        editor.setPosition({ lineNumber: entry.lineNumber, column: entry.column });
        editor.revealLineInCenter(entry.lineNumber);
        requestAnimationFrame(() => { navigating = false; });
      },
    });

    /* Go forward */
    ctx.addAction({
      id: "cursor-history.forward",
      label: "Go Forward",
      keybindings: [ctx.monaco.KeyMod.Alt | ctx.monaco.KeyCode.RightArrow],
      run(editor) {
        if (historyIdx >= history.length - 1) return;
        navigating = true;
        historyIdx++;
        const entry = history[historyIdx];
        editor.setPosition({ lineNumber: entry.lineNumber, column: entry.column });
        editor.revealLineInCenter(entry.lineNumber);
        requestAnimationFrame(() => { navigating = false; });
      },
    });
  },
};
