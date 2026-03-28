/**
 * @module monaco-editor/plugins/diagnostics-bridge-plugin
 *
 * Bridges Monaco editor markers (diagnostics) to external stores.
 * Emits events when marker counts change, allowing the host app
 * to sync error/warning counts to status bars or panels.
 */

import type { MonacoPlugin, PluginContext } from "../types";

export interface DiagnosticsSummary {
  errors: number;
  warnings: number;
  infos: number;
  hints: number;
  total: number;
  markers: Array<{
    severity: number;
    message: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
    source?: string;
  }>;
}

export const diagnosticsBridgePlugin: MonacoPlugin = {
  id: "builtin-diagnostics-bridge",
  name: "Diagnostics Bridge",
  version: "1.0.0",
  description: "Syncs Monaco markers to external stores via events",

  onMount(ctx: PluginContext) {
    let lastCounts = { errors: 0, warnings: 0 };

    const sync = () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      const markers = ctx.monaco.editor.getModelMarkers({ resource: model.uri });

      let errors = 0;
      let warnings = 0;
      let infos = 0;
      let hints = 0;

      const markerData = markers.map((m) => {
        if (m.severity === ctx.monaco.MarkerSeverity.Error) errors++;
        else if (m.severity === ctx.monaco.MarkerSeverity.Warning) warnings++;
        else if (m.severity === ctx.monaco.MarkerSeverity.Info) infos++;
        else hints++;

        return {
          severity: m.severity,
          message: m.message,
          startLineNumber: m.startLineNumber,
          startColumn: m.startColumn,
          endLineNumber: m.endLineNumber,
          endColumn: m.endColumn,
          source: m.source ?? undefined,
        };
      });

      const summary: DiagnosticsSummary = {
        errors,
        warnings,
        infos,
        hints,
        total: markers.length,
        markers: markerData,
      };

      // Only emit if counts changed
      if (errors !== lastCounts.errors || warnings !== lastCounts.warnings) {
        lastCounts = { errors, warnings };
        ctx.emit("diagnostics-changed", summary);
      }
    };

    // Listen for marker changes
    ctx.addDisposable(
      ctx.monaco.editor.onDidChangeMarkers((uris) => {
        const model = ctx.editor.getModel();
        if (!model) return;
        if (uris.some((uri) => uri.toString() === model.uri.toString())) {
          sync();
        }
      }),
    );

    // Also re-sync on language change
    ctx.addDisposable(
      ctx.editor.onDidChangeModelLanguage(() => {
        setTimeout(sync, 100);
      }),
    );

    // Initial sync
    setTimeout(sync, 500);

    /* Provide action to jump to next/previous error */
    ctx.addAction({
      id: "diagnostics-bridge.next-error",
      label: "Go to Next Error",
      keybindings: [ctx.monaco.KeyCode.F8],
      run(editor) {
        const model = editor.getModel();
        const pos = editor.getPosition();
        if (!model || !pos) return;

        const markers = ctx.monaco.editor.getModelMarkers({ resource: model.uri })
          .filter((m) => m.severity === ctx.monaco.MarkerSeverity.Error)
          .sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn);

        if (!markers.length) return;

        // Find next marker after cursor
        const next = markers.find(
          (m) => m.startLineNumber > pos.lineNumber ||
            (m.startLineNumber === pos.lineNumber && m.startColumn > pos.column),
        ) ?? markers[0]; // wrap around

        editor.revealLineInCenter(next.startLineNumber);
        editor.setPosition({
          lineNumber: next.startLineNumber,
          column: next.startColumn,
        });
      },
    });

    ctx.addAction({
      id: "diagnostics-bridge.prev-error",
      label: "Go to Previous Error",
      keybindings: [ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.F8],
      run(editor) {
        const model = editor.getModel();
        const pos = editor.getPosition();
        if (!model || !pos) return;

        const markers = ctx.monaco.editor.getModelMarkers({ resource: model.uri })
          .filter((m) => m.severity === ctx.monaco.MarkerSeverity.Error)
          .sort((a, b) => b.startLineNumber - a.startLineNumber || b.startColumn - a.startColumn);

        if (!markers.length) return;

        const prev = markers.find(
          (m) => m.startLineNumber < pos.lineNumber ||
            (m.startLineNumber === pos.lineNumber && m.startColumn < pos.column),
        ) ?? markers[0];

        editor.revealLineInCenter(prev.startLineNumber);
        editor.setPosition({
          lineNumber: prev.startLineNumber,
          column: prev.startColumn,
        });
      },
    });
  },
};
