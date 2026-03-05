/**
 * @module monaco-editor/lib/remote-providers/adapters
 *
 * Adapter functions that convert JSON data → Monaco provider registrations.
 *
 * Each function:
 *  1. Takes the Monaco namespace, a language ID, and typed JSON data
 *  2. Creates a Monaco provider object from the data
 *  3. Registers it via the corresponding `monaco.languages.register*` function
 *  4. Returns an `IDisposable` for cleanup
 *
 * These can be used standalone (manual mode) or via `registerRemoteProviders` (auto-fetch mode).
 */

import type * as monacoNs from "monaco-editor";
import type {
  CompletionData,
  DefinitionData,
  HoverData,
  CodeActionData,
  DocumentHighlightData,
  DocumentSymbolData,
  LinkData,
  TypeDefinitionData,
  ReferenceData,
  ImplementationData,
  InlineCompletionData,
  FormattingData,
  CodeLensData,
  ColorData,
  DeclarationData,
  InlayHintData,
  SignatureHelpData,
  LinkedEditingRangeData,
  RangeFormattingData,
  OnTypeFormattingData,
  FoldingRangeData,
  RenameData,
  NewSymbolNamesData,
  SelectionRangeData,
  SemanticTokensData,
  RangeSemanticTokensData,
  JsonLocation,
} from "./types";

type Monaco = typeof monacoNs;

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveCompletionKind(
  monaco: Monaco,
  kind?: number,
): monacoNs.languages.CompletionItemKind {
  if (kind !== undefined && kind >= 0 && kind <= 28) {
    return kind as monacoNs.languages.CompletionItemKind;
  }
  return monaco.languages.CompletionItemKind.Text;
}

function resolveHighlightKind(
  monaco: Monaco,
  kind?: "text" | "read" | "write",
): monacoNs.languages.DocumentHighlightKind {
  switch (kind) {
    case "read":
      return monaco.languages.DocumentHighlightKind.Read;
    case "write":
      return monaco.languages.DocumentHighlightKind.Write;
    default:
      return monaco.languages.DocumentHighlightKind.Text;
  }
}

/**
 * Convert a JsonLocation (or array) into a Monaco Location (or array).
 * Falls back to the current model URI when `loc.uri` is omitted.
 */
function toLocation(
  monaco: Monaco,
  modelUri: monacoNs.Uri,
  loc: JsonLocation,
): monacoNs.languages.Location {
  return {
    uri: loc.uri ? monaco.Uri.parse(loc.uri) : modelUri,
    range: loc.range,
  };
}

function toLocations(
  monaco: Monaco,
  modelUri: monacoNs.Uri,
  entry: JsonLocation | JsonLocation[],
): monacoNs.languages.Location | monacoNs.languages.Location[] {
  if (Array.isArray(entry)) {
    return entry.map((loc) => toLocation(monaco, modelUri, loc));
  }
  return toLocation(monaco, modelUri, entry);
}

/**
 * Shared word-lookup for location-based providers
 * (definition, typeDefinition, declaration, implementation).
 */
function createLocationLookup(
  monaco: Monaco,
  entries: Record<string, JsonLocation | JsonLocation[]>,
) {
  return (
    model: monacoNs.editor.ITextModel,
    position: monacoNs.Position,
  ): monacoNs.languages.Location | monacoNs.languages.Location[] | null => {
    const wordInfo = model.getWordAtPosition(position);
    if (!wordInfo) return null;

    const entry = entries[wordInfo.word];
    if (!entry) return null;

    return toLocations(monaco, model.uri, entry);
  };
}

// ═══════════════════════════════════════════════════════════════
//  Color parsing helpers
// ═══════════════════════════════════════════════════════════════

function hexToByte(hex: string): number {
  return parseInt(hex, 16);
}

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, "0");
}

function parseHexColor(value: string): monacoNs.languages.IColor | null {
  let hex = value.replace(/^#/, "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length === 4) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  if (hex.length === 6) hex += "ff";
  if (hex.length !== 8) return null;

  return {
    red: hexToByte(hex.substring(0, 2)) / 255,
    green: hexToByte(hex.substring(2, 4)) / 255,
    blue: hexToByte(hex.substring(4, 6)) / 255,
    alpha: hexToByte(hex.substring(6, 8)) / 255,
  };
}

function parseRgbColor(value: string): monacoNs.languages.IColor | null {
  const m = value.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  );
  if (!m) return null;
  return {
    red: parseInt(m[1]) / 255,
    green: parseInt(m[2]) / 255,
    blue: parseInt(m[3]) / 255,
    alpha: m[4] !== undefined ? parseFloat(m[4]) : 1,
  };
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
): { red: number; green: number; blue: number } {
  if (s === 0) return { red: l, green: l, blue: l };
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    red: hue2rgb(p, q, h + 1 / 3),
    green: hue2rgb(p, q, h),
    blue: hue2rgb(p, q, h - 1 / 3),
  };
}

function parseHslColor(value: string): monacoNs.languages.IColor | null {
  const m = value.match(
    /hsla?\(\s*(\d+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*([\d.]+)\s*)?\)/,
  );
  if (!m) return null;
  const { red, green, blue } = hslToRgb(
    parseInt(m[1]) / 360,
    parseFloat(m[2]) / 100,
    parseFloat(m[3]) / 100,
  );
  return { red, green, blue, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
}

function parseColor(
  value: string,
  format: "hex" | "rgb" | "hsl",
): monacoNs.languages.IColor | null {
  switch (format) {
    case "hex":
      return parseHexColor(value);
    case "rgb":
      return parseRgbColor(value);
    case "hsl":
      return parseHslColor(value);
  }
}

// ═══════════════════════════════════════════════════════════════
//  1. COMPLETION
// ═══════════════════════════════════════════════════════════════

export function createCompletionProvider(
  monaco: Monaco,
  langId: string,
  data: CompletionData,
): monacoNs.IDisposable {
  return monaco.languages.registerCompletionItemProvider(langId, {
    triggerCharacters: data.triggerCharacters,
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range: monacoNs.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: monacoNs.languages.CompletionItem[] = data.items.map(
        (item) => {
          const doc =
            typeof item.documentation === "string"
              ? item.documentation
              : item.documentation
                ? { value: item.documentation.value, isTrusted: item.documentation.isTrusted ?? true }
                : undefined;

          return {
            label: item.label,
            kind: resolveCompletionKind(monaco, item.kind),
            tags: item.tags as monacoNs.languages.CompletionItemTag[] | undefined,
            detail: item.detail,
            documentation: doc,
            sortText: item.sortText,
            filterText: item.filterText,
            preselect: item.preselect,
            insertText: item.insertText,
            insertTextRules: item.insertTextRules as
              | monacoNs.languages.CompletionItemInsertTextRule
              | undefined,
            commitCharacters: item.commitCharacters,
            command: item.command,
            range,
          } as monacoNs.languages.CompletionItem;
        },
      );

      return { suggestions };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  2. DEFINITION
// ═══════════════════════════════════════════════════════════════

export function createDefinitionProvider(
  monaco: Monaco,
  langId: string,
  data: DefinitionData,
): monacoNs.IDisposable {
  const lookup = createLocationLookup(monaco, data.entries);
  return monaco.languages.registerDefinitionProvider(langId, {
    provideDefinition: lookup,
  });
}

// ═══════════════════════════════════════════════════════════════
//  3. HOVER
// ═══════════════════════════════════════════════════════════════

export function createHoverProvider(
  monaco: Monaco,
  langId: string,
  data: HoverData,
): monacoNs.IDisposable {
  return monaco.languages.registerHoverProvider(langId, {
    provideHover(model, position) {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return null;

      const entry = data.entries[wordInfo.word];
      if (!entry?.contents?.length) return null;

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn,
        },
        contents: entry.contents.map((c) => ({
          value: c.value,
          isTrusted: c.isTrusted ?? true,
        })),
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  4. CODE ACTIONS
// ═══════════════════════════════════════════════════════════════

export function createCodeActionProvider(
  monaco: Monaco,
  langId: string,
  data: CodeActionData,
): monacoNs.IDisposable {
  return monaco.languages.registerCodeActionProvider(langId, {
    provideCodeActions(model, range, context) {
      const actions: monacoNs.languages.CodeAction[] = [];

      for (const item of data.actions) {
        // Filter by requested kind
        if (context.only && item.kind && !item.kind.startsWith(context.only)) {
          continue;
        }

        // Filter by diagnostic match
        if (item.diagnosticSource || item.diagnosticCode) {
          const hasMatch = context.markers.some(
            (m) =>
              (!item.diagnosticSource || m.source === item.diagnosticSource) &&
              (!item.diagnosticCode || String(m.code) === String(item.diagnosticCode)),
          );
          if (!hasMatch) continue;
        }

        const action: monacoNs.languages.CodeAction = {
          title: item.title,
          kind: item.kind,
          isPreferred: item.isPreferred,
          command: item.command,
        };

        if (item.edit?.changes?.length) {
          action.edit = {
            edits: item.edit.changes.map((c) => ({
              resource: model.uri,
              textEdit: {
                range: c.range ?? {
                  startLineNumber: range.startLineNumber,
                  startColumn: range.startColumn,
                  endLineNumber: range.endLineNumber,
                  endColumn: range.endColumn,
                },
                text: c.text,
              },
              versionId: model.getVersionId(),
            })),
          };
        }

        actions.push(action);
      }

      return { actions, dispose() {} };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  5. DOCUMENT HIGHLIGHT
// ═══════════════════════════════════════════════════════════════

export function createDocumentHighlightProvider(
  monaco: Monaco,
  langId: string,
  data: DocumentHighlightData,
): monacoNs.IDisposable {
  return monaco.languages.registerDocumentHighlightProvider(langId, {
    provideDocumentHighlights(model, position) {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return null;

      const entry = data.entries[wordInfo.word];
      if (!entry) return null;

      const kind = resolveHighlightKind(monaco, entry.kind);

      // Find all occurrences of this word in the document
      const matches = model.findMatches(
        `\\b${escapeRegex(wordInfo.word)}\\b`,
        true, // searchOnlyEditableRange = whole model
        true, // isRegex
        true, // matchCase
        null, // wordSeparators
        false, // captureMatches
      );

      return matches.map((m) => ({ range: m.range, kind }));
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  6. DOCUMENT SYMBOL
// ═══════════════════════════════════════════════════════════════

export function createDocumentSymbolProvider(
  monaco: Monaco,
  langId: string,
  data: DocumentSymbolData,
): monacoNs.IDisposable {
  return monaco.languages.registerDocumentSymbolProvider(langId, {
    provideDocumentSymbols(model) {
      const symbols: monacoNs.languages.DocumentSymbol[] = [];
      const lineCount = model.getLineCount();

      for (const pat of data.symbols) {
        const regex = new RegExp(pat.pattern);

        for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
          const line = model.getLineContent(lineNum);
          const match = regex.exec(line);
          if (!match) continue;

          const name = match[1] ?? match[0];
          const startCol = match.index + 1;
          const endCol = startCol + match[0].length;

          symbols.push({
            name,
            detail: pat.detail ?? "",
            kind: pat.kind as monacoNs.languages.SymbolKind,
            tags: [],
            range: {
              startLineNumber: lineNum,
              startColumn: 1,
              endLineNumber: lineNum,
              endColumn: line.length + 1,
            },
            selectionRange: {
              startLineNumber: lineNum,
              startColumn: startCol,
              endLineNumber: lineNum,
              endColumn: endCol,
            },
            containerName: pat.containerName,
          });
        }
      }

      return symbols;
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  7. LINKS
// ═══════════════════════════════════════════════════════════════

export function createLinkProvider(
  monaco: Monaco,
  langId: string,
  data: LinkData,
): monacoNs.IDisposable {
  return monaco.languages.registerLinkProvider(langId, {
    provideLinks(model) {
      const links: monacoNs.languages.ILink[] = [];
      const lineCount = model.getLineCount();

      for (const pat of data.patterns) {
        for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
          const line = model.getLineContent(lineNum);
          const regex = new RegExp(pat.pattern, "g");
          let match: RegExpExecArray | null;

          while ((match = regex.exec(line)) !== null) {
            const startCol = match.index + 1;
            const endCol = startCol + match[0].length;

            let url: string;
            if (pat.url) {
              url = pat.url.replace(/\$(\d)/g, (_, i) => match![Number(i)] ?? "");
            } else {
              url = match[0];
            }

            links.push({
              range: {
                startLineNumber: lineNum,
                startColumn: startCol,
                endLineNumber: lineNum,
                endColumn: endCol,
              },
              url,
              tooltip: pat.tooltip,
            });
          }
        }
      }

      return { links };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  8. TYPE DEFINITION
// ═══════════════════════════════════════════════════════════════

export function createTypeDefinitionProvider(
  monaco: Monaco,
  langId: string,
  data: TypeDefinitionData,
): monacoNs.IDisposable {
  const lookup = createLocationLookup(monaco, data.entries);
  return monaco.languages.registerTypeDefinitionProvider(langId, {
    provideTypeDefinition: lookup,
  });
}

// ═══════════════════════════════════════════════════════════════
//  9. REFERENCES
// ═══════════════════════════════════════════════════════════════

export function createReferenceProvider(
  monaco: Monaco,
  langId: string,
  data: ReferenceData,
): monacoNs.IDisposable {
  return monaco.languages.registerReferenceProvider(langId, {
    provideReferences(model, position) {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return null;

      const entry = data.entries[wordInfo.word];
      if (!entry?.length) return null;

      return entry.map((loc) => toLocation(monaco, model.uri, loc));
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  10. IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════

export function createImplementationProvider(
  monaco: Monaco,
  langId: string,
  data: ImplementationData,
): monacoNs.IDisposable {
  const lookup = createLocationLookup(monaco, data.entries);
  return monaco.languages.registerImplementationProvider(langId, {
    provideImplementation: lookup,
  });
}

// ═══════════════════════════════════════════════════════════════
//  11. INLINE COMPLETIONS
// ═══════════════════════════════════════════════════════════════

export function createInlineCompletionsProvider(
  monaco: Monaco,
  langId: string,
  data: InlineCompletionData,
): monacoNs.IDisposable {
  return monaco.languages.registerInlineCompletionsProvider(langId, {
    provideInlineCompletions(model, position) {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      const items: monacoNs.languages.InlineCompletion[] = [];

      for (const item of data.items) {
        if (item.triggerPattern) {
          const regex = new RegExp(item.triggerPattern);
          if (!regex.test(textBeforeCursor)) continue;
        }

        if (item.filterWord) {
          const wordInfo = model.getWordAtPosition(position);
          if (!wordInfo || !wordInfo.word.startsWith(item.filterWord)) continue;
        }

        items.push({
          insertText: item.insertText,
          command: item.command,
        });
      }

      return { items };
    },
    disposeInlineCompletions() {
      // No-op for static data
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  12. FORMATTING
// ═══════════════════════════════════════════════════════════════

export function createFormattingProvider(
  monaco: Monaco,
  langId: string,
  data: FormattingData,
): monacoNs.IDisposable {
  return monaco.languages.registerDocumentFormattingEditProvider(langId, {
    displayName: data.displayName,
    provideDocumentFormattingEdits(model) {
      const edits: monacoNs.languages.TextEdit[] = [];

      for (const rule of data.rules) {
        if (rule.scope === "line") {
          const lineCount = model.getLineCount();
          for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
            const lineContent = model.getLineContent(lineNum);
            const regex = new RegExp(rule.pattern, "g");
            const replaced = lineContent.replace(regex, rule.replacement);
            if (replaced !== lineContent) {
              edits.push({
                range: {
                  startLineNumber: lineNum,
                  startColumn: 1,
                  endLineNumber: lineNum,
                  endColumn: lineContent.length + 1,
                },
                text: replaced,
              });
            }
          }
        } else {
          // Whole-document scope
          const fullText = model.getValue();
          const regex = new RegExp(rule.pattern, "gm");
          const replaced = fullText.replace(regex, rule.replacement);
          if (replaced !== fullText) {
            const lastLine = model.getLineCount();
            const lastCol = model.getLineMaxColumn(lastLine);
            edits.push({
              range: {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: lastLine,
                endColumn: lastCol,
              },
              text: replaced,
            });
            break; // A single full-document edit is sufficient
          }
        }
      }

      return edits;
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  13. CODE LENS
// ═══════════════════════════════════════════════════════════════

export function createCodeLensProvider(
  monaco: Monaco,
  langId: string,
  data: CodeLensData,
): monacoNs.IDisposable {
  return monaco.languages.registerCodeLensProvider(langId, {
    provideCodeLenses(model) {
      const lenses: monacoNs.languages.CodeLens[] = [];
      const lineCount = model.getLineCount();

      for (const lens of data.lenses) {
        const regex = new RegExp(lens.pattern);

        for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
          const line = model.getLineContent(lineNum);
          if (regex.test(line)) {
            lenses.push({
              range: {
                startLineNumber: lineNum,
                startColumn: 1,
                endLineNumber: lineNum,
                endColumn: 1,
              },
              command: lens.command,
            });
          }
        }
      }

      return { lenses, dispose() {} };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  14. COLOR
// ═══════════════════════════════════════════════════════════════

export function createColorProvider(
  monaco: Monaco,
  langId: string,
  data: ColorData,
): monacoNs.IDisposable {
  return monaco.languages.registerColorProvider(langId, {
    provideDocumentColors(model) {
      const colors: monacoNs.languages.IColorInformation[] = [];
      const lineCount = model.getLineCount();

      for (const pat of data.patterns) {
        for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
          const line = model.getLineContent(lineNum);
          const regex = new RegExp(pat.pattern, "g");
          let match: RegExpExecArray | null;

          while ((match = regex.exec(line)) !== null) {
            const color = parseColor(match[0], pat.format);
            if (color) {
              colors.push({
                range: {
                  startLineNumber: lineNum,
                  startColumn: match.index + 1,
                  endLineNumber: lineNum,
                  endColumn: match.index + 1 + match[0].length,
                },
                color,
              });
            }
          }
        }
      }

      return colors;
    },

    provideColorPresentations(_model, colorInfo) {
      const { red, green, blue, alpha } = colorInfo.color;
      const r = Math.round(red * 255);
      const g = Math.round(green * 255);
      const b = Math.round(blue * 255);

      const presentations: monacoNs.languages.IColorPresentation[] = [];

      // Hex representation
      if (alpha === 1) {
        presentations.push({ label: `#${toHex(r)}${toHex(g)}${toHex(b)}` });
      } else {
        presentations.push({
          label: `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(Math.round(alpha * 255))}`,
        });
      }

      // RGB representation
      if (alpha === 1) {
        presentations.push({ label: `rgb(${r}, ${g}, ${b})` });
      } else {
        presentations.push({
          label: `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`,
        });
      }

      return presentations;
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  15. DECLARATION
// ═══════════════════════════════════════════════════════════════

export function createDeclarationProvider(
  monaco: Monaco,
  langId: string,
  data: DeclarationData,
): monacoNs.IDisposable {
  const lookup = createLocationLookup(monaco, data.entries);
  return monaco.languages.registerDeclarationProvider(langId, {
    provideDeclaration: lookup,
  });
}

// ═══════════════════════════════════════════════════════════════
//  16. INLAY HINTS
// ═══════════════════════════════════════════════════════════════

export function createInlayHintsProvider(
  monaco: Monaco,
  langId: string,
  data: InlayHintData,
): monacoNs.IDisposable {
  return monaco.languages.registerInlayHintsProvider(langId, {
    provideInlayHints(model, range) {
      const hints: monacoNs.languages.InlayHint[] = [];

      for (
        let lineNum = range.startLineNumber;
        lineNum <= range.endLineNumber;
        lineNum++
      ) {
        const line = model.getLineContent(lineNum);

        for (const hint of data.hints) {
          const regex = new RegExp(hint.pattern, "g");
          let match: RegExpExecArray | null;

          while ((match = regex.exec(line)) !== null) {
            const label = hint.label.replace(
              /\$(\d)/g,
              (_, i) => match![Number(i)] ?? "",
            );
            const col =
              hint.position === "before"
                ? match.index + 1
                : match.index + 1 + match[0].length;

            hints.push({
              label,
              position: { lineNumber: lineNum, column: col },
              kind: hint.kind as monacoNs.languages.InlayHintKind | undefined,
              tooltip: hint.tooltip,
              paddingLeft: hint.paddingLeft,
              paddingRight: hint.paddingRight,
            });
          }
        }
      }

      return { hints, dispose() {} };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  17. SIGNATURE HELP
// ═══════════════════════════════════════════════════════════════

export function createSignatureHelpProvider(
  monaco: Monaco,
  langId: string,
  data: SignatureHelpData,
): monacoNs.IDisposable {
  return monaco.languages.registerSignatureHelpProvider(langId, {
    signatureHelpTriggerCharacters: data.triggerCharacters,
    signatureHelpRetriggerCharacters: data.retriggerCharacters,
    provideSignatureHelp(model, position) {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      for (const sig of data.signatures) {
        if (sig.triggerPattern) {
          const regex = new RegExp(sig.triggerPattern);
          if (!regex.test(textBeforeCursor)) continue;
        }

        const doc =
          typeof sig.documentation === "string"
            ? sig.documentation
            : sig.documentation
              ? { value: sig.documentation.value, isTrusted: sig.documentation.isTrusted ?? true }
              : undefined;

        const parameters: monacoNs.languages.ParameterInformation[] =
          sig.parameters.map((p) => {
            const pDoc =
              typeof p.documentation === "string"
                ? p.documentation
                : p.documentation
                  ? { value: p.documentation.value, isTrusted: p.documentation.isTrusted ?? true }
                  : undefined;
            return { label: p.label, documentation: pDoc };
          });

        // Count commas to determine active parameter
        const openParen = textBeforeCursor.lastIndexOf("(");
        let activeParameter = sig.activeParameter ?? 0;
        if (openParen !== -1) {
          const args = textBeforeCursor.substring(openParen + 1);
          activeParameter = (args.match(/,/g) ?? []).length;
        }

        return {
          value: {
            signatures: [
              {
                label: sig.label,
                documentation: doc,
                parameters,
                activeParameter,
              },
            ],
            activeSignature: 0,
            activeParameter,
          },
          dispose() {},
        };
      }

      return undefined;
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  18. LINKED EDITING RANGE
// ═══════════════════════════════════════════════════════════════

export function createLinkedEditingRangeProvider(
  monaco: Monaco,
  langId: string,
  data: LinkedEditingRangeData,
): monacoNs.IDisposable {
  return monaco.languages.registerLinkedEditingRangeProvider(langId, {
    provideLinkedEditingRanges(model, position) {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return null;

      const entry = data.entries[wordInfo.word];
      if (!entry) return null;

      // Find all occurrences of this word in the document
      const matches = model.findMatches(
        `\\b${escapeRegex(wordInfo.word)}\\b`,
        true,
        true,
        true,
        null,
        false,
      );

      if (matches.length < 2) return null;

      return {
        ranges: matches.map((m) => m.range),
        wordPattern: entry.wordPattern
          ? new RegExp(entry.wordPattern)
          : undefined,
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  19. RANGE FORMATTING
// ═══════════════════════════════════════════════════════════════

export function createRangeFormattingProvider(
  monaco: Monaco,
  langId: string,
  data: RangeFormattingData,
): monacoNs.IDisposable {
  return monaco.languages.registerDocumentRangeFormattingEditProvider(langId, {
    displayName: data.displayName,
    provideDocumentRangeFormattingEdits(model, range) {
      const edits: monacoNs.languages.TextEdit[] = [];

      for (const rule of data.rules) {
        if (rule.scope === "line") {
          for (
            let lineNum = range.startLineNumber;
            lineNum <= range.endLineNumber;
            lineNum++
          ) {
            const lineContent = model.getLineContent(lineNum);
            const regex = new RegExp(rule.pattern, "g");
            const replaced = lineContent.replace(regex, rule.replacement);
            if (replaced !== lineContent) {
              edits.push({
                range: {
                  startLineNumber: lineNum,
                  startColumn: 1,
                  endLineNumber: lineNum,
                  endColumn: lineContent.length + 1,
                },
                text: replaced,
              });
            }
          }
        } else {
          const rangeText = model.getValueInRange(range);
          const regex = new RegExp(rule.pattern, "gm");
          const replaced = rangeText.replace(regex, rule.replacement);
          if (replaced !== rangeText) {
            edits.push({ range, text: replaced });
            break;
          }
        }
      }

      return edits;
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  20. ON TYPE FORMATTING
// ═══════════════════════════════════════════════════════════════

export function createOnTypeFormattingProvider(
  monaco: Monaco,
  langId: string,
  data: OnTypeFormattingData,
): monacoNs.IDisposable {
  return monaco.languages.registerOnTypeFormattingEditProvider(langId, {
    autoFormatTriggerCharacters: data.triggerCharacters,
    provideOnTypeFormattingEdits(model, position, ch) {
      const edits: monacoNs.languages.TextEdit[] = [];
      const lineContent = model.getLineContent(position.lineNumber);

      for (const rule of data.rules) {
        if (rule.triggerCharacter !== ch) continue;
        const regex = new RegExp(rule.pattern, "g");
        const replaced = lineContent.replace(regex, rule.replacement);
        if (replaced !== lineContent) {
          edits.push({
            range: {
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: lineContent.length + 1,
            },
            text: replaced,
          });
        }
      }

      return edits;
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  21. FOLDING RANGE
// ═══════════════════════════════════════════════════════════════

function resolveFoldingKind(
  monaco: Monaco,
  kind?: "comment" | "imports" | "region",
): monacoNs.languages.FoldingRangeKind | undefined {
  if (!kind) return undefined;
  return monaco.languages.FoldingRangeKind.fromValue(kind);
}

export function createFoldingRangeProvider(
  monaco: Monaco,
  langId: string,
  data: FoldingRangeData,
): monacoNs.IDisposable {
  return monaco.languages.registerFoldingRangeProvider(langId, {
    provideFoldingRanges(model) {
      const ranges: monacoNs.languages.FoldingRange[] = [];
      const lineCount = model.getLineCount();

      for (const pat of data.patterns) {
        const startRegex = new RegExp(pat.startPattern);
        const endRegex = new RegExp(pat.endPattern);
        const stack: number[] = [];

        for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
          const line = model.getLineContent(lineNum);
          if (startRegex.test(line)) {
            stack.push(lineNum);
          } else if (endRegex.test(line) && stack.length > 0) {
            const start = stack.pop()!;
            ranges.push({
              start,
              end: lineNum,
              kind: resolveFoldingKind(monaco, pat.kind),
            });
          }
        }
      }

      return ranges;
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  22. RENAME
// ═══════════════════════════════════════════════════════════════

export function createRenameProvider(
  monaco: Monaco,
  langId: string,
  data: RenameData,
): monacoNs.IDisposable {
  return monaco.languages.registerRenameProvider(langId, {
    provideRenameEdits(model, position, newName) {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return { edits: [] };

      const oldName = wordInfo.word;

      // Verify it matches the symbol pattern
      const symbolRegex = new RegExp(data.symbolPattern);
      if (!symbolRegex.test(oldName)) {
        return { edits: [] };
      }

      // Find all occurrences as whole-word matches
      const matches = model.findMatches(
        `\\b${escapeRegex(oldName)}\\b`,
        true,
        true,
        true,
        null,
        false,
      );

      return {
        edits: matches.map((m) => ({
          resource: model.uri,
          textEdit: {
            range: m.range,
            text: newName,
          },
          versionId: model.getVersionId(),
        })),
      };
    },

    resolveRenameLocation(model, position) {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return { rejectReason: "No symbol found at position", text: "", range: { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 } };

      const symbolRegex = new RegExp(data.symbolPattern);
      if (!symbolRegex.test(wordInfo.word)) {
        return { rejectReason: "Not a renameable symbol", text: "", range: { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 } };
      }

      return {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: wordInfo.endColumn,
        },
        text: wordInfo.word,
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  23. NEW SYMBOL NAMES
// ═══════════════════════════════════════════════════════════════

export function createNewSymbolNamesProvider(
  monaco: Monaco,
  langId: string,
  data: NewSymbolNamesData,
): monacoNs.IDisposable {
  return monaco.languages.registerNewSymbolNameProvider(langId, {
    provideNewSymbolNames(model, range) {
      const text = model.getValueInRange(range).trim();
      const entry = data.entries[text];
      if (!entry?.length) return null;

      return entry.map((s) => ({
        newSymbolName: s.newSymbolName,
        tags: s.tags as monacoNs.languages.NewSymbolNameTag[] | undefined,
      }));
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  24. SELECTION RANGE
// ═══════════════════════════════════════════════════════════════

export function createSelectionRangeProvider(
  monaco: Monaco,
  langId: string,
  data: SelectionRangeData,
): monacoNs.IDisposable {
  return monaco.languages.registerSelectionRangeProvider(langId, {
    provideSelectionRanges(model, positions) {
      return positions.map((pos) => {
        const ranges: monacoNs.languages.SelectionRange[] = [];

        // Start with the word at position
        const wordInfo = model.getWordAtPosition(pos);
        if (wordInfo) {
          ranges.push({
            range: {
              startLineNumber: pos.lineNumber,
              startColumn: wordInfo.startColumn,
              endLineNumber: pos.lineNumber,
              endColumn: wordInfo.endColumn,
            },
          });
        }

        // Then expand using bracket/scope patterns
        for (const pat of data.patterns) {
          const openRegex = new RegExp(pat.open);
          const closeRegex = new RegExp(pat.close);

          // Search backward for opener
          let openLine = pos.lineNumber;
          let openCol = -1;
          while (openLine >= 1) {
            const line = model.getLineContent(openLine);
            const match = openRegex.exec(line);
            if (match && (openLine < pos.lineNumber || match.index + 1 < pos.column)) {
              openCol = match.index + 1;
              break;
            }
            openLine--;
          }

          // Search forward for closer
          let closeLine = pos.lineNumber;
          let closeCol = -1;
          const lineCount = model.getLineCount();
          while (closeLine <= lineCount) {
            const line = model.getLineContent(closeLine);
            const match = closeRegex.exec(line);
            if (match && (closeLine > pos.lineNumber || match.index + 1 + match[0].length > pos.column)) {
              closeCol = match.index + 1 + match[0].length;
              break;
            }
            closeLine++;
          }

          if (openCol !== -1 && closeCol !== -1) {
            ranges.push({
              range: {
                startLineNumber: openLine,
                startColumn: openCol,
                endLineNumber: closeLine,
                endColumn: closeCol,
              },
            });
          }
        }

        // Current line as fallback
        const lineContent = model.getLineContent(pos.lineNumber);
        ranges.push({
          range: {
            startLineNumber: pos.lineNumber,
            startColumn: 1,
            endLineNumber: pos.lineNumber,
            endColumn: lineContent.length + 1,
          },
        });

        // Full document
        const lastLine = model.getLineCount();
        ranges.push({
          range: {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: lastLine,
            endColumn: model.getLineMaxColumn(lastLine),
          },
        });

        return ranges;
      });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  25. SEMANTIC TOKENS
// ═══════════════════════════════════════════════════════════════

function buildSemanticTokens(
  model: monacoNs.editor.ITextModel,
  patterns: { pattern: string; tokenType: number; tokenModifiers?: number }[],
  startLine: number,
  endLine: number,
): Uint32Array {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = model.getLineContent(lineNum);

    for (const pat of patterns) {
      const regex = new RegExp(pat.pattern, "g");
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const deltaLine = lineNum - 1 - prevLine;
        const deltaStartChar = deltaLine === 0 ? match.index - prevChar : match.index;
        const length = match[0].length;

        data.push(
          deltaLine,
          deltaStartChar,
          length,
          pat.tokenType,
          pat.tokenModifiers ?? 0,
        );

        prevLine = lineNum - 1;
        prevChar = match.index;
      }
    }
  }

  return new Uint32Array(data);
}

export function createSemanticTokensProvider(
  monaco: Monaco,
  langId: string,
  data: SemanticTokensData,
): monacoNs.IDisposable {
  return monaco.languages.registerDocumentSemanticTokensProvider(langId, {
    getLegend() {
      return data.legend;
    },
    provideDocumentSemanticTokens(model) {
      const tokens = buildSemanticTokens(
        model,
        data.patterns,
        1,
        model.getLineCount(),
      );
      return { data: tokens };
    },
    releaseDocumentSemanticTokens() {
      // No-op for static data
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  26. RANGE SEMANTIC TOKENS
// ═══════════════════════════════════════════════════════════════

export function createRangeSemanticTokensProvider(
  monaco: Monaco,
  langId: string,
  data: RangeSemanticTokensData,
): monacoNs.IDisposable {
  return monaco.languages.registerDocumentRangeSemanticTokensProvider(langId, {
    getLegend() {
      return data.legend;
    },
    provideDocumentRangeSemanticTokens(model, range) {
      const tokens = buildSemanticTokens(
        model,
        data.patterns,
        range.startLineNumber,
        range.endLineNumber,
      );
      return { data: tokens };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  ADAPTER REGISTRY (maps ProviderKey → adapter function)
// ═══════════════════════════════════════════════════════════════

import type { ProviderKey, ProviderDataMap } from "./types";

/**
 * Lookup table: provider key → adapter function.
 * Used by `registerRemoteProviders` to dispatch data to the right adapter.
 */
export const ADAPTERS: {
  [K in ProviderKey]: (
    monaco: Monaco,
    langId: string,
    data: ProviderDataMap[K],
  ) => monacoNs.IDisposable;
} = {
  completion: createCompletionProvider,
  definition: createDefinitionProvider,
  hover: createHoverProvider,
  codeActions: createCodeActionProvider,
  documentHighlight: createDocumentHighlightProvider,
  documentSymbol: createDocumentSymbolProvider,
  links: createLinkProvider,
  typeDefinition: createTypeDefinitionProvider,
  references: createReferenceProvider,
  implementation: createImplementationProvider,
  inlineCompletions: createInlineCompletionsProvider,
  formatting: createFormattingProvider,
  codeLens: createCodeLensProvider,
  color: createColorProvider,
  declaration: createDeclarationProvider,
  inlayHints: createInlayHintsProvider,
  signatureHelp: createSignatureHelpProvider,
  linkedEditingRange: createLinkedEditingRangeProvider,
  rangeFormatting: createRangeFormattingProvider,
  onTypeFormatting: createOnTypeFormattingProvider,
  foldingRange: createFoldingRangeProvider,
  rename: createRenameProvider,
  newSymbolNames: createNewSymbolNamesProvider,
  selectionRange: createSelectionRangeProvider,
  semanticTokens: createSemanticTokensProvider,
  rangeSemanticTokens: createRangeSemanticTokensProvider,
};
