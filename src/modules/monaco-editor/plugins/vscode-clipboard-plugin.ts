/**
 * @module monaco-editor/plugins/vscode-clipboard-plugin
 *
 * VS Code-style Ctrl+C / Ctrl+X behavior:
 * - If there's a selection → copy/cut the selection (default behavior)
 * - If cursor is on a line with NO selection → copy/cut the entire line
 *
 * Usage:
 *   import { vscodeClipboardPlugin } from "@/modules/monaco-editor";
 *   <MonacoEditor plugins={[vscodeClipboardPlugin]} />
 */

import type { MonacoPlugin, PluginContext } from "../types";

export const vscodeClipboardPlugin: MonacoPlugin = {
  id: "builtin-vscode-clipboard",
  name: "VS Code Clipboard",
  version: "1.0.0",
  description: "Ctrl+C copies line when no selection, Ctrl+X cuts line when no selection",
  priority: 10,

  onMount(ctx: PluginContext) {
    const { editor, monaco } = ctx;

    // ── Ctrl+C: Copy line if no selection ──
    ctx.addDisposable(
      editor.addAction({
        id: "vscode-clipboard.copy-line",
        label: "Copy Line (when no selection)",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC],
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection || selection.isEmpty()) {
            // No selection → copy entire line
            const position = ed.getPosition();
            if (!position) return;
            const model = ed.getModel();
            if (!model) return;

            const lineNumber = position.lineNumber;
            const lineContent = model.getLineContent(lineNumber);
            // Copy with newline (so pasting inserts a full line)
            navigator.clipboard.writeText(lineContent + "\n").catch(() => {});
          } else {
            // Has selection → use default copy behavior
            const model = ed.getModel();
            if (!model) return;
            const selectedText = model.getValueInRange(selection);
            navigator.clipboard.writeText(selectedText).catch(() => {});
          }
        },
      }),
    );

    // ── Ctrl+X: Cut line if no selection ──
    ctx.addDisposable(
      editor.addAction({
        id: "vscode-clipboard.cut-line",
        label: "Cut Line (when no selection)",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX],
        run: (ed) => {
          const selection = ed.getSelection();
          if (!selection || selection.isEmpty()) {
            // No selection → cut entire line
            const position = ed.getPosition();
            if (!position) return;
            const model = ed.getModel();
            if (!model) return;

            const lineNumber = position.lineNumber;
            const lineContent = model.getLineContent(lineNumber);
            const lineCount = model.getLineCount();

            // Copy line content with newline
            navigator.clipboard.writeText(lineContent + "\n").catch(() => {});

            // Delete the entire line
            let range: InstanceType<typeof monaco.Range>;
            if (lineCount === 1) {
              // Only line → clear it
              range = new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1);
            } else if (lineNumber === lineCount) {
              // Last line → delete from end of previous line to end of this line
              const prevLineLength = model.getLineContent(lineNumber - 1).length;
              range = new monaco.Range(lineNumber - 1, prevLineLength + 1, lineNumber, lineContent.length + 1);
            } else {
              // Normal line → delete from start to start of next line
              range = new monaco.Range(lineNumber, 1, lineNumber + 1, 1);
            }

            ed.executeEdits("vscode-clipboard", [
              { range, text: "", forceMoveMarkers: true },
            ]);
          } else {
            // Has selection → use default cut behavior
            const model = ed.getModel();
            if (!model) return;
            const selectedText = model.getValueInRange(selection);
            navigator.clipboard.writeText(selectedText).catch(() => {});
            ed.executeEdits("vscode-clipboard", [
              { range: selection, text: "", forceMoveMarkers: true },
            ]);
          }
        },
      }),
    );
  },
};
