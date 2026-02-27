/**
 * @module monaco-editor/plugins/todo-highlight-plugin
 *
 * Highlights TODO, FIXME, HACK, NOTE, and XXX comments
 * with colored decorations and optional diagnostics.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const TODO_PATTERNS = [
  { pattern: /\bTODO\b/g, severity: 1, color: "rgba(255, 200, 50, 0.25)", border: "rgba(255, 200, 50, 0.6)" },
  { pattern: /\bFIXME\b/g, severity: 2, color: "rgba(255, 80, 80, 0.25)", border: "rgba(255, 80, 80, 0.6)" },
  { pattern: /\bHACK\b/g, severity: 2, color: "rgba(255, 120, 50, 0.25)", border: "rgba(255, 120, 50, 0.6)" },
  { pattern: /\bNOTE\b/g, severity: 1, color: "rgba(80, 180, 255, 0.2)", border: "rgba(80, 180, 255, 0.5)" },
  { pattern: /\bXXX\b/g, severity: 3, color: "rgba(255, 50, 50, 0.3)", border: "rgba(255, 50, 50, 0.7)" },
] as const;

export const todoHighlightPlugin: MonacoPlugin = {
  id: "builtin-todo-highlight",
  name: "TODO Highlight",
  version: "1.0.0",
  description: "Highlights TODO/FIXME/HACK/NOTE/XXX comments",

  onMount(ctx: PluginContext) {
    let decorationIds: string[] = [];

    const update = () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      const text = model.getValue();
      const decorations: Parameters<typeof ctx.editor.deltaDecorations>[1] = [];
      const markers: Parameters<typeof ctx.setModelMarkers>[1] = [];

      for (const { pattern, severity, color, border } of TODO_PATTERNS) {
        const regex = new RegExp(pattern.source, "g");
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          const startPos = model.getPositionAt(match.index);
          const endPos = model.getPositionAt(match.index + match[0].length);

          decorations.push({
            range: new ctx.monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column,
            ),
            options: {
              inlineClassName: `todo-highlight-${match[0].toLowerCase()}`,
              overviewRuler: {
                color: border,
                position: ctx.monaco.editor.OverviewRulerLane.Right,
              },
              stickiness:
                ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              after: undefined,
            },
          });

          markers.push({
            severity:
              severity === 3
                ? ctx.monaco.MarkerSeverity.Error
                : severity === 2
                  ? ctx.monaco.MarkerSeverity.Warning
                  : ctx.monaco.MarkerSeverity.Info,
            message: `${match[0]} comment found`,
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
          });
        }
      }

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
      ctx.setModelMarkers("todo-highlight", markers);
    };

    // Initial scan
    update();

    // Re-scan on content change (throttled)
    let timer: ReturnType<typeof setTimeout> | null = null;
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(update, 500);
      }),
    );
  },
};
