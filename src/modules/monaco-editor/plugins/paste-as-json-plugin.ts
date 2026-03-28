/**
 * @module monaco-editor/plugins/paste-as-json-plugin
 *
 * Auto-detect and format JSON on paste, convert CSV to JSON,
 * pretty-print or minify JSON via command palette.
 */

import type { MonacoPlugin, PluginContext } from "../types";

function tryParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function csvToJson(csv: string): object[] | null {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return null;

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ""));

  // Need at least 2 columns to look like CSV
  if (headers.length < 2) return null;

  const rows: object[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ""));
    if (vals.length !== headers.length) continue;
    const row: Record<string, string | number> = {};
    for (let j = 0; j < headers.length; j++) {
      const num = Number(vals[j]);
      row[headers[j]] = !isNaN(num) && vals[j] !== "" ? num : vals[j];
    }
    rows.push(row);
  }

  return rows.length > 0 ? rows : null;
}

export const pasteAsJsonPlugin: MonacoPlugin = {
  id: "builtin-paste-as-json",
  name: "Paste as JSON",
  version: "1.0.0",
  description: "Auto-detect & format JSON on paste, CSV-to-JSON, pretty-print/minify",

  onMount(ctx: PluginContext) {
    // ── Pretty-print JSON ──
    ctx.addAction({
      id: "pasteJson.prettify",
      label: "JSON: Pretty Print",
      run(editor) {
        const model = editor.getModel();
        if (!model) return;

        const text = model.getValue();
        const parsed = tryParseJSON(text);
        if (parsed === null) {
          ctx.notify("Current content is not valid JSON", "warning");
          return;
        }

        const pretty = JSON.stringify(parsed, null, 2);
        editor.executeEdits("paste-as-json", [
          {
            range: model.getFullModelRange(),
            text: pretty,
          },
        ]);
        ctx.notify("JSON formatted", "success");
      },
    });

    // ── Minify JSON ──
    ctx.addAction({
      id: "pasteJson.minify",
      label: "JSON: Minify",
      run(editor) {
        const model = editor.getModel();
        if (!model) return;

        const text = model.getValue();
        const parsed = tryParseJSON(text);
        if (parsed === null) {
          ctx.notify("Current content is not valid JSON", "warning");
          return;
        }

        const mini = JSON.stringify(parsed);
        editor.executeEdits("paste-as-json", [
          {
            range: model.getFullModelRange(),
            text: mini,
          },
        ]);
        ctx.notify("JSON minified", "success");
      },
    });

    // ── Paste clipboard as formatted JSON ──
    ctx.addAction({
      id: "pasteJson.pasteFormatted",
      label: "Paste as Formatted JSON",
      keybindings: [
        ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.KeyV,
      ],
      run(editor) {
        navigator.clipboard.readText().then((clipText) => {
          if (!clipText.trim()) return;

          let result: string | null = null;

          // Try JSON
          const parsed = tryParseJSON(clipText);
          if (parsed !== null) {
            result = JSON.stringify(parsed, null, 2);
          }

          // Try CSV
          if (!result) {
            const csvResult = csvToJson(clipText);
            if (csvResult) {
              result = JSON.stringify(csvResult, null, 2);
            }
          }

          if (result) {
            const pos = editor.getPosition();
            if (!pos) return;
            editor.executeEdits("paste-as-json", [
              {
                range: new ctx.monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                text: result,
              },
            ]);
            ctx.notify("Pasted as formatted JSON", "success");
          } else {
            // Just paste as-is
            const pos = editor.getPosition();
            if (!pos) return;
            editor.executeEdits("paste-as-json", [
              {
                range: new ctx.monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                text: clipText,
              },
            ]);
          }
        }).catch(() => {
          ctx.notify("Cannot read clipboard", "error");
        });
      },
    });

    // ── Convert selection from CSV to JSON ──
    ctx.addAction({
      id: "pasteJson.csvToJson",
      label: "Convert CSV to JSON",
      run(editor) {
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) {
          ctx.notify("Select CSV text first", "warning");
          return;
        }

        const model = editor.getModel();
        if (!model) return;
        const text = model.getValueInRange(selection);
        const result = csvToJson(text);

        if (!result) {
          ctx.notify("Could not parse selection as CSV", "warning");
          return;
        }

        editor.executeEdits("paste-as-json", [
          {
            range: selection,
            text: JSON.stringify(result, null, 2),
          },
        ]);
        ctx.notify(`Converted ${result.length} rows to JSON`, "success");
      },
    });

    // ── Stringify selection (escape as JSON string) ──
    ctx.addAction({
      id: "pasteJson.stringify",
      label: "JSON: Stringify Selection",
      run(editor) {
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) {
          ctx.notify("Select text to stringify", "warning");
          return;
        }

        const model = editor.getModel();
        if (!model) return;
        const text = model.getValueInRange(selection);

        editor.executeEdits("paste-as-json", [
          {
            range: selection,
            text: JSON.stringify(text),
          },
        ]);
      },
    });

    // ── Parse JSON string (unescape) ──
    ctx.addAction({
      id: "pasteJson.parse",
      label: "JSON: Parse String (Unescape)",
      run(editor) {
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) {
          ctx.notify("Select a JSON string to parse", "warning");
          return;
        }

        const model = editor.getModel();
        if (!model) return;
        const text = model.getValueInRange(selection);

        try {
          const parsed = JSON.parse(text);
          const result = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
          editor.executeEdits("paste-as-json", [
            {
              range: selection,
              text: result,
            },
          ]);
        } catch {
          ctx.notify("Selection is not a valid JSON string", "warning");
        }
      },
    });
  },
};
