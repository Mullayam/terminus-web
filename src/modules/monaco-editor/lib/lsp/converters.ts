/**
 * @module monaco-editor/lib/lsp/converters
 *
 * Bidirectional converters between LSP protocol types and Monaco editor types.
 *
 * Design Pattern: Adapter — translates between two incompatible interfaces
 * (LSP ↔ Monaco) without coupling either side to the other.
 */

import type * as monacoNs from "monaco-editor";
import * as lsp from "vscode-languageserver-protocol";

type Monaco = typeof monacoNs;

/* ────────────────────────────────────────────────────────────
 * Position / Range / Location
 * ──────────────────────────────────────────────────────────── */

/** LSP Position (0-based) → Monaco IPosition (1-based) */
export function toMonacoPosition(pos: lsp.Position): monacoNs.IPosition {
  return { lineNumber: pos.line + 1, column: pos.character + 1 };
}

/** Monaco IPosition (1-based) → LSP Position (0-based) */
export function fromMonacoPosition(pos: monacoNs.IPosition): lsp.Position {
  return lsp.Position.create(pos.lineNumber - 1, pos.column - 1);
}

/** LSP Range → Monaco IRange */
export function toMonacoRange(range: lsp.Range): monacoNs.IRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

/** Monaco IRange → LSP Range */
export function fromMonacoRange(range: monacoNs.IRange): lsp.Range {
  return lsp.Range.create(
    range.startLineNumber - 1,
    range.startColumn - 1,
    range.endLineNumber - 1,
    range.endColumn - 1,
  );
}

/* ────────────────────────────────────────────────────────────
 * Completion
 * ──────────────────────────────────────────────────────────── */

const LSP_TO_MONACO_COMPLETION_KIND: Record<number, monacoNs.languages.CompletionItemKind> = {};

function initCompletionKindMap(monaco: Monaco) {
  if (Object.keys(LSP_TO_MONACO_COMPLETION_KIND).length > 0) return;
  const k = monaco.languages.CompletionItemKind;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Text] = k.Text;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Method] = k.Method;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Function] = k.Function;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Constructor] = k.Constructor;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Field] = k.Field;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Variable] = k.Variable;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Class] = k.Class;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Interface] = k.Interface;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Module] = k.Module;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Property] = k.Property;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Unit] = k.Unit;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Value] = k.Value;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Enum] = k.Enum;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Keyword] = k.Keyword;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Snippet] = k.Snippet;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Color] = k.Color;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.File] = k.File;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Reference] = k.Reference;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Folder] = k.Folder;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.EnumMember] = k.EnumMember;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Constant] = k.Constant;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Struct] = k.Struct;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Event] = k.Event;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.Operator] = k.Operator;
  LSP_TO_MONACO_COMPLETION_KIND[lsp.CompletionItemKind.TypeParameter] = k.TypeParameter;
}

/** Convert an LSP CompletionItem to a Monaco CompletionItem */
export function toMonacoCompletionItem(
  monaco: Monaco,
  item: lsp.CompletionItem,
  range: monacoNs.IRange | monacoNs.languages.CompletionItemRanges,
): monacoNs.languages.CompletionItem {
  initCompletionKindMap(monaco);

  const insertText = item.insertText ?? (typeof item.label === "string" ? item.label : String(item.label));
  const isSnippet =
    item.insertTextFormat === lsp.InsertTextFormat.Snippet;

  const label = typeof item.label === "string"
    ? item.label
    : (item.label as { label: string }).label ?? String(item.label);

  return {
    label,
    kind:
      LSP_TO_MONACO_COMPLETION_KIND[item.kind ?? lsp.CompletionItemKind.Text] ??
      monaco.languages.CompletionItemKind.Text,
    detail: item.detail,
    documentation: item.documentation
      ? typeof item.documentation === "string"
        ? item.documentation
        : { value: item.documentation.value }
      : undefined,
    insertText,
    insertTextRules: isSnippet
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    range,
    sortText: item.sortText,
    filterText: item.filterText,
    preselect: item.preselect,
    tags: item.tags as number[] | undefined,
  };
}

/* ────────────────────────────────────────────────────────────
 * Hover
 * ──────────────────────────────────────────────────────────── */

/** Convert an LSP Hover to Monaco Hover */
export function toMonacoHover(
  hover: lsp.Hover,
): monacoNs.languages.Hover {
  const contents: monacoNs.IMarkdownString[] = [];

  if (typeof hover.contents === "string") {
    contents.push({ value: hover.contents });
  } else if (Array.isArray(hover.contents)) {
    for (const c of hover.contents) {
      if (typeof c === "string") {
        contents.push({ value: c });
      } else {
        contents.push({ value: `\`\`\`${c.language}\n${c.value}\n\`\`\`` });
      }
    }
  } else if ("kind" in hover.contents) {
    // MarkupContent
    contents.push({ value: hover.contents.value });
  } else {
    // MarkedString object { language, value }
    contents.push({
      value: `\`\`\`${hover.contents.language}\n${hover.contents.value}\n\`\`\``,
    });
  }

  return {
    contents,
    range: hover.range ? toMonacoRange(hover.range) : undefined,
  };
}

/* ────────────────────────────────────────────────────────────
 * Diagnostics
 * ──────────────────────────────────────────────────────────── */

/** Convert LSP DiagnosticSeverity → Monaco MarkerSeverity */
export function toMonacoSeverity(
  monaco: Monaco,
  severity?: lsp.DiagnosticSeverity,
): monacoNs.MarkerSeverity {
  switch (severity) {
    case lsp.DiagnosticSeverity.Error:
      return monaco.MarkerSeverity.Error;
    case lsp.DiagnosticSeverity.Warning:
      return monaco.MarkerSeverity.Warning;
    case lsp.DiagnosticSeverity.Information:
      return monaco.MarkerSeverity.Info;
    case lsp.DiagnosticSeverity.Hint:
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Info;
  }
}

/** Convert LSP Diagnostic[] → Monaco IMarkerData[] */
export function toMonacoMarkers(
  monaco: Monaco,
  diagnostics: lsp.Diagnostic[],
): monacoNs.editor.IMarkerData[] {
  return diagnostics.map((d) => ({
    severity: toMonacoSeverity(monaco, d.severity),
    message: d.message,
    source: d.source,
    code: typeof d.code === "number" || typeof d.code === "string" ? String(d.code) : undefined,
    ...toMonacoRange(d.range) as {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    },
  }));
}

/* ────────────────────────────────────────────────────────────
 * Signature Help
 * ──────────────────────────────────────────────────────────── */

/** Convert LSP SignatureHelp → Monaco SignatureHelp */
export function toMonacoSignatureHelp(
  sh: lsp.SignatureHelp,
): monacoNs.languages.SignatureHelpResult {
  return {
    value: {
      signatures: sh.signatures.map((sig) => ({
        label: sig.label,
        documentation: sig.documentation
          ? typeof sig.documentation === "string"
            ? sig.documentation
            : { value: sig.documentation.value }
          : undefined,
        parameters: (sig.parameters ?? []).map((p) => ({
          label: p.label,
          documentation: p.documentation
            ? typeof p.documentation === "string"
              ? p.documentation
              : { value: p.documentation.value }
            : undefined,
        })),
      })),
      activeSignature: sh.activeSignature ?? 0,
      activeParameter: sh.activeParameter ?? 0,
    },
    dispose: () => {},
  };
}

/* ────────────────────────────────────────────────────────────
 * Definition / References
 * ──────────────────────────────────────────────────────────── */

/** Convert LSP Location | Location[] → Monaco LocationLink[] */
export function toMonacoDefinition(
  result: lsp.Definition | lsp.LocationLink[] | null,
): monacoNs.languages.Definition | null {
  if (!result) return null;

  if (Array.isArray(result)) {
    return result.map((item) => {
      if ("targetUri" in item) {
        // LocationLink
        return {
          uri: monacoUri(item.targetUri),
          range: toMonacoRange(item.targetRange),
          originSelectionRange: item.originSelectionRange
            ? toMonacoRange(item.originSelectionRange)
            : undefined,
          targetSelectionRange: item.targetSelectionRange
            ? toMonacoRange(item.targetSelectionRange)
            : undefined,
        } as monacoNs.languages.LocationLink;
      }
      // Location
      return {
        uri: monacoUri(item.uri),
        range: toMonacoRange(item.range),
      };
    });
  }

  // Single Location
  return {
    uri: monacoUri(result.uri),
    range: toMonacoRange(result.range),
  };
}

/* ────────────────────────────────────────────────────────────
 * Document Symbols
 * ──────────────────────────────────────────────────────────── */

const LSP_TO_MONACO_SYMBOL_KIND: Record<number, number> = {
  [lsp.SymbolKind.File]: 0,
  [lsp.SymbolKind.Module]: 1,
  [lsp.SymbolKind.Namespace]: 2,
  [lsp.SymbolKind.Package]: 3,
  [lsp.SymbolKind.Class]: 4,
  [lsp.SymbolKind.Method]: 5,
  [lsp.SymbolKind.Property]: 6,
  [lsp.SymbolKind.Field]: 7,
  [lsp.SymbolKind.Constructor]: 8,
  [lsp.SymbolKind.Enum]: 9,
  [lsp.SymbolKind.Interface]: 10,
  [lsp.SymbolKind.Function]: 11,
  [lsp.SymbolKind.Variable]: 12,
  [lsp.SymbolKind.Constant]: 13,
  [lsp.SymbolKind.String]: 14,
  [lsp.SymbolKind.Number]: 15,
  [lsp.SymbolKind.Boolean]: 16,
  [lsp.SymbolKind.Array]: 17,
  [lsp.SymbolKind.Object]: 18,
  [lsp.SymbolKind.Key]: 19,
  [lsp.SymbolKind.Null]: 20,
  [lsp.SymbolKind.EnumMember]: 21,
  [lsp.SymbolKind.Struct]: 22,
  [lsp.SymbolKind.Event]: 23,
  [lsp.SymbolKind.Operator]: 24,
  [lsp.SymbolKind.TypeParameter]: 25,
};

/** Convert LSP DocumentSymbol[] → Monaco DocumentSymbol[] */
export function toMonacoDocumentSymbols(
  symbols: lsp.DocumentSymbol[],
): monacoNs.languages.DocumentSymbol[] {
  return symbols.map((s) => ({
    name: s.name,
    detail: s.detail ?? "",
    kind: LSP_TO_MONACO_SYMBOL_KIND[s.kind] ?? 12,
    tags: (s.tags as number[]) ?? [],
    range: toMonacoRange(s.range),
    selectionRange: toMonacoRange(s.selectionRange),
    children: s.children ? toMonacoDocumentSymbols(s.children) : undefined,
  }));
}

/* ────────────────────────────────────────────────────────────
 * Code Actions
 * ──────────────────────────────────────────────────────────── */

/** Convert a single LSP TextEdit → Monaco ISingleEditOperation */
export function toMonacoTextEdit(
  edit: lsp.TextEdit,
): monacoNs.languages.TextEdit {
  return {
    range: toMonacoRange(edit.range),
    text: edit.newText,
  };
}

/* ────────────────────────────────────────────────────────────
 * Formatting
 * ──────────────────────────────────────────────────────────── */

export function toMonacoTextEdits(
  edits: lsp.TextEdit[] | null | undefined,
): monacoNs.languages.TextEdit[] {
  if (!edits) return [];
  return edits.map(toMonacoTextEdit);
}

/* ────────────────────────────────────────────────────────────
 * Monaco URI helper
 * ──────────────────────────────────────────────────────────── */

/** We need to lazily reference Monaco.Uri — pass it through globalThis trick */
let _monacoRef: Monaco | null = null;

export function setMonacoRef(monaco: Monaco) {
  _monacoRef = monaco;
}

function monacoUri(uriStr: string) {
  if (_monacoRef) {
    return _monacoRef.Uri.parse(uriStr);
  }
  // Fallback — shouldn't happen if setMonacoRef was called
  return { toString: () => uriStr } as unknown as monacoNs.Uri;
}
