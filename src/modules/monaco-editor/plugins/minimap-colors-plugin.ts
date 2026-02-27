/**
 * @module monaco-editor/plugins/minimap-colors-plugin
 *
 * Adds contextual highlights to the minimap: errors in red,
 * warnings in yellow, search matches in orange.
 */

import type { MonacoPlugin, PluginContext } from "../types";

export const minimapColorsPlugin: MonacoPlugin = {
  id: "builtin-minimap-colors",
  name: "Minimap Colors",
  version: "1.0.0",
  description: "Adds colored indicators to the minimap for markers",

  onMount(ctx: PluginContext) {
    let decorationIds: string[] = [];

    const refresh = () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      const markers = ctx.monaco.editor.getModelMarkers({ resource: model.uri });

      const decorations = markers.map((marker) => ({
        range: new ctx.monaco.Range(
          marker.startLineNumber,
          marker.startColumn,
          marker.endLineNumber,
          marker.endColumn,
        ),
        options: {
          minimap: {
            color:
              marker.severity === ctx.monaco.MarkerSeverity.Error
                ? "rgba(255, 80, 80, 0.8)"
                : marker.severity === ctx.monaco.MarkerSeverity.Warning
                  ? "rgba(255, 200, 50, 0.8)"
                  : "rgba(80, 180, 255, 0.6)",
            position: ctx.monaco.editor.MinimapPosition.Inline,
          },
          overviewRuler: {
            color:
              marker.severity === ctx.monaco.MarkerSeverity.Error
                ? "rgba(255, 80, 80, 0.8)"
                : marker.severity === ctx.monaco.MarkerSeverity.Warning
                  ? "rgba(255, 200, 50, 0.8)"
                  : "rgba(80, 180, 255, 0.6)",
            position: ctx.monaco.editor.OverviewRulerLane.Right,
          },
          stickiness:
            ctx.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      }));

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
    };

    // Refresh on marker changes
    ctx.addDisposable(ctx.monaco.editor.onDidChangeMarkers(() => refresh()));
    refresh();
  },
};
