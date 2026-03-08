/**
 * @module monaco-editor/lib/lsp/providers
 *
 * Registers Monaco language providers that delegate to an LSP client.
 *
 * Design Pattern: Bridge — decouples the Monaco provider interface from
 * the LSP protocol implementation so either can change independently.
 *
 * Each provider converts Monaco → LSP request → LSP response → Monaco.
 */

import type * as monacoNs from "monaco-editor";
import * as lsp from "vscode-languageserver-protocol";
import type { LSPClient } from "./client";
import {
  fromMonacoPosition,
  fromMonacoRange,
  fromMonacoColor,
  toMonacoCompletionItem,
  toMonacoHover,
  toMonacoSignatureHelp,
  toMonacoDefinition,
  toMonacoDocumentSymbols,
  toMonacoTextEdits,
  toMonacoMarkers,
  toMonacoRange,
  toMonacoDocumentHighlights,
  toMonacoCodeActions,
  toMonacoCodeLens,
  toMonacoDocumentLink,
  toMonacoColorInformation,
  toMonacoColorPresentation,
  toMonacoFoldingRanges,
  flattenSelectionRange,
  toMonacoLinkedEditingRanges,
  toMonacoInlayHint,
  toMonacoSemanticTokens,
  toMonacoWorkspaceEdit,
  getSemanticTokensLegend,
  setMonacoRef,
} from "./converters";

type Monaco = typeof monacoNs;

export interface LSPProviderRegistration {
  disposables: monacoNs.IDisposable[];
  /** Dispose all registered providers */
  dispose: () => void;
}

/**
 * Register all Monaco language providers that delegate to the given LSP client.
 * Returns disposables so providers can be cleaned up when the connection drops.
 */
export function registerLSPProviders(
  monaco: Monaco,
  languageId: string,
  client: LSPClient,
  documentUri: string,
): LSPProviderRegistration {
  setMonacoRef(monaco);
  const disposables: monacoNs.IDisposable[] = [];

  // ── 1. Completion Provider ──
  disposables.push(
    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: [".", "/", "@", "<", '"', "'", "`", " "],
      async provideCompletionItems(model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.completion(documentUri, lspPos);
        if (!result) return { suggestions: [] };

        const word = model.getWordUntilPosition(position);
        const range: monacoNs.IRange = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        };

        const items = Array.isArray(result) ? result : result.items;
        return {
          suggestions: items.map((item) =>
            toMonacoCompletionItem(monaco, item, range),
          ),
          incomplete: !Array.isArray(result) && result.isIncomplete,
        };
      },
      async resolveCompletionItem(item) {
        try {
          const lspItem: any = {
            label: typeof item.label === "string" ? item.label : (item.label as any).label ?? String(item.label),
            kind: item.kind,
            data: (item as any).data,
          };
          const resolved = await client.completionItemResolve(lspItem);
          if (resolved.documentation) {
            item.documentation = typeof resolved.documentation === "string"
              ? resolved.documentation
              : { value: resolved.documentation.value };
          }
          if (resolved.detail) item.detail = resolved.detail;
        } catch { /* ignore */ }
        return item;
      },
    }),
  );

  // ── 2. Hover Provider ──
  disposables.push(
    monaco.languages.registerHoverProvider(languageId, {
      async provideHover(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.hover(documentUri, lspPos);
        if (!result) return null;
        return toMonacoHover(result);
      },
    }),
  );

  // ── 3. Signature Help Provider ──
  disposables.push(
    monaco.languages.registerSignatureHelpProvider(languageId, {
      signatureHelpTriggerCharacters: ["(", ","],
      signatureHelpRetriggerCharacters: [","],
      async provideSignatureHelp(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.signatureHelp(documentUri, lspPos);
        if (!result) return null;
        return toMonacoSignatureHelp(result);
      },
    }),
  );

  // ── 4. Definition Provider ──
  disposables.push(
    monaco.languages.registerDefinitionProvider(languageId, {
      async provideDefinition(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.definition(documentUri, lspPos);
        return toMonacoDefinition(result);
      },
    }),
  );

  // ── 5. Declaration Provider ──
  disposables.push(
    monaco.languages.registerDeclarationProvider(languageId, {
      async provideDeclaration(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.declaration(documentUri, lspPos);
        return toMonacoDefinition(result);
      },
    }),
  );

  // ── 6. Type Definition Provider ──
  disposables.push(
    monaco.languages.registerTypeDefinitionProvider(languageId, {
      async provideTypeDefinition(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.typeDefinition(documentUri, lspPos);
        return toMonacoDefinition(result);
      },
    }),
  );

  // ── 7. Implementation Provider ──
  disposables.push(
    monaco.languages.registerImplementationProvider(languageId, {
      async provideImplementation(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.implementation(documentUri, lspPos);
        return toMonacoDefinition(result);
      },
    }),
  );

  // ── 8. References Provider ──
  disposables.push(
    monaco.languages.registerReferenceProvider(languageId, {
      async provideReferences(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.references(documentUri, lspPos);
        if (!result) return [];
        return result.map((loc) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: toMonacoRange(loc.range),
        }));
      },
    }),
  );

  // ── 9. Document Highlight Provider ──
  disposables.push(
    monaco.languages.registerDocumentHighlightProvider(languageId, {
      async provideDocumentHighlights(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.documentHighlight(documentUri, lspPos);
        if (!result) return [];
        return toMonacoDocumentHighlights(result);
      },
    }),
  );

  // ── 10. Document Symbol Provider ──
  disposables.push(
    monaco.languages.registerDocumentSymbolProvider(languageId, {
      async provideDocumentSymbols() {
        const result = await client.documentSymbol(documentUri);
        if (!result || result.length === 0) return [];

        // Check if the result is DocumentSymbol[] or SymbolInformation[]
        const first = result[0];
        if ("range" in first && "selectionRange" in first) {
          return toMonacoDocumentSymbols(result as lsp.DocumentSymbol[]);
        }

        // SymbolInformation[] → flat list (skip malformed entries)
        return (result as lsp.SymbolInformation[])
          .filter((si) => si?.location?.range != null)
          .map((si) => ({
            name: si.name,
            detail: "",
            kind: si.kind as unknown as monacoNs.languages.SymbolKind,
            tags: [],
            range: toMonacoRange(si.location.range),
            selectionRange: toMonacoRange(si.location.range),
          }));
      },
    }),
  );

  // ── 11. Code Action Provider ──
  disposables.push(
    monaco.languages.registerCodeActionProvider(languageId, {
      async provideCodeActions(_model, range, context) {
        const lspRange = fromMonacoRange(range);
        const lspContext: lsp.CodeActionContext = {
          diagnostics: context.markers.map((m) => ({
            range: fromMonacoRange(m),
            message: m.message,
            severity: m.severity === monaco.MarkerSeverity.Error ? 1
              : m.severity === monaco.MarkerSeverity.Warning ? 2
              : m.severity === monaco.MarkerSeverity.Info ? 3 : 4,
            source: m.source,
            code: m.code ? (typeof m.code === "object" ? (m.code as any).value : m.code) : undefined,
          })),
        };
        if (context.only) {
          lspContext.only = [context.only];
        }
        const result = await client.codeAction(documentUri, lspRange, lspContext);
        if (!result) return { actions: [], dispose: () => {} };
        return toMonacoCodeActions(monaco, result);
      },
    }),
  );

  // ── 12. Code Lens Provider ──
  disposables.push(
    monaco.languages.registerCodeLensProvider(languageId, {
      async provideCodeLenses() {
        const result = await client.codeLens(documentUri);
        if (!result) return { lenses: [], dispose: () => {} };
        return {
          lenses: result.map(toMonacoCodeLens),
          dispose: () => {},
        };
      },
      async resolveCodeLens(_model, codeLens) {
        const lspLens: lsp.CodeLens = {
          range: fromMonacoRange(codeLens.range),
          data: (codeLens as any).data,
        };
        const resolved = await client.codeLensResolve(lspLens);
        if (resolved.command) {
          codeLens.command = {
            id: resolved.command.command,
            title: resolved.command.title,
            arguments: resolved.command.arguments,
          };
        }
        return codeLens;
      },
    }),
  );

  // ── 13. Document Link Provider ──
  disposables.push(
    monaco.languages.registerLinkProvider(languageId, {
      async provideLinks() {
        const result = await client.documentLink(documentUri);
        if (!result) return { links: [] };
        return { links: result.map(toMonacoDocumentLink) };
      },
      async resolveLink(link) {
        if (link.url) return link;
        const lspLink: lsp.DocumentLink = {
          range: fromMonacoRange(link.range),
          target: link.url != null ? String(link.url) : undefined,
          data: (link as any).data,
        };
        const resolved = await client.documentLinkResolve(lspLink);
        if (resolved.target) link.url = resolved.target;
        return link;
      },
    }),
  );

  // ── 14. Document Color Provider ──
  disposables.push(
    monaco.languages.registerColorProvider(languageId, {
      async provideDocumentColors() {
        const result = await client.documentColor(documentUri);
        if (!result) return [];
        return result.map(toMonacoColorInformation);
      },
      async provideColorPresentations(_model, colorInfo) {
        const lspColor = fromMonacoColor(colorInfo.color);
        const lspRange = fromMonacoRange(colorInfo.range);
        const result = await client.colorPresentation(documentUri, lspColor, lspRange);
        if (!result) return [];
        return result.map(toMonacoColorPresentation);
      },
    }),
  );

  // ── 15. Document Formatting Provider ──
  disposables.push(
    monaco.languages.registerDocumentFormattingEditProvider(languageId, {
      async provideDocumentFormattingEdits(model) {
        const result = await client.formatting(documentUri, {
          tabSize: model.getOptions().tabSize,
          insertSpaces: model.getOptions().insertSpaces,
        });
        return toMonacoTextEdits(result);
      },
    }),
  );

  // ── 16. Document Range Formatting Provider ──
  disposables.push(
    monaco.languages.registerDocumentRangeFormattingEditProvider(languageId, {
      async provideDocumentRangeFormattingEdits(model, range) {
        const result = await client.rangeFormatting(
          documentUri,
          fromMonacoRange(range),
          {
            tabSize: model.getOptions().tabSize,
            insertSpaces: model.getOptions().insertSpaces,
          },
        );
        return toMonacoTextEdits(result);
      },
    }),
  );

  // ── 17. On Type Formatting Provider ──
  disposables.push(
    monaco.languages.registerOnTypeFormattingEditProvider(languageId, {
      autoFormatTriggerCharacters: [";", "}", "\n"],
      async provideOnTypeFormattingEdits(model, position, ch) {
        const result = await client.onTypeFormatting(
          documentUri,
          fromMonacoPosition(position),
          ch,
          {
            tabSize: model.getOptions().tabSize,
            insertSpaces: model.getOptions().insertSpaces,
          },
        );
        return toMonacoTextEdits(result);
      },
    }),
  );

  // ── 18. Rename Provider ──
  disposables.push(
    monaco.languages.registerRenameProvider(languageId, {
      async provideRenameEdits(_model, position, newName) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.rename(documentUri, lspPos, newName);
        if (!result) return { edits: [] };
        return toMonacoWorkspaceEdit(result);
      },
      async resolveRenameLocation(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.prepareRename(documentUri, lspPos);
        if (!result) return { range: { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 }, text: "", rejectReason: "Rename not available" };
        if ("placeholder" in result) {
          return { range: toMonacoRange(result.range), text: result.placeholder };
        }
        return { range: toMonacoRange(result), text: "" };
      },
    }),
  );

  // ── 19. Folding Range Provider ──
  disposables.push(
    monaco.languages.registerFoldingRangeProvider(languageId, {
      async provideFoldingRanges() {
        const result = await client.foldingRange(documentUri);
        if (!result) return [];
        return toMonacoFoldingRanges(monaco, result);
      },
    }),
  );

  // ── 20. Selection Range Provider ──
  disposables.push(
    monaco.languages.registerSelectionRangeProvider(languageId, {
      async provideSelectionRanges(_model, positions) {
        const lspPositions = positions.map(fromMonacoPosition);
        const result = await client.selectionRange(documentUri, lspPositions);
        if (!result) return [];
        return result.map(flattenSelectionRange);
      },
    }),
  );

  // ── 21. Linked Editing Range Provider ──
  disposables.push(
    monaco.languages.registerLinkedEditingRangeProvider(languageId, {
      async provideLinkedEditingRanges(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.linkedEditingRange(documentUri, lspPos);
        if (!result) return null;
        return toMonacoLinkedEditingRanges(result);
      },
    }),
  );

  // ── 22. Inlay Hints Provider ──
  disposables.push(
    monaco.languages.registerInlayHintsProvider(languageId, {
      async provideInlayHints(_model, range) {
        const lspRange = fromMonacoRange(range);
        const result = await client.inlayHint(documentUri, lspRange);
        if (!result) return { hints: [], dispose: () => {} };
        return {
          hints: result.map(toMonacoInlayHint),
          dispose: () => {},
        };
      },
      async resolveInlayHint(hint) {
        try {
          const lspHint: any = {
            position: fromMonacoPosition(hint.position),
            label: hint.label,
            kind: hint.kind,
            data: (hint as any).data,
          };
          const resolved = await client.inlayHintResolve(lspHint);
          if (resolved.tooltip) {
            hint.tooltip = typeof resolved.tooltip === "string"
              ? resolved.tooltip
              : { value: resolved.tooltip.value };
          }
        } catch { /* ignore */ }
        return hint;
      },
    }),
  );

  // ── 23. Semantic Tokens Provider (Full) ──
  const semanticLegend = getSemanticTokensLegend(client.serverCapabilities);
  if (semanticLegend) {
    disposables.push(
      monaco.languages.registerDocumentSemanticTokensProvider(languageId, {
        getLegend() {
          return semanticLegend;
        },
        async provideDocumentSemanticTokens(_model, lastResultId) {
          const result = await client.semanticTokensFull(documentUri);
          if (!result) return null;
          return toMonacoSemanticTokens(result);
        },
        releaseDocumentSemanticTokens() { /* no-op */ },
      }),
    );

    // ── 24. Semantic Tokens Provider (Range) ──
    disposables.push(
      monaco.languages.registerDocumentRangeSemanticTokensProvider(languageId, {
        getLegend() {
          return semanticLegend;
        },
        async provideDocumentRangeSemanticTokens(_model, range) {
          const lspRange = fromMonacoRange(range);
          const result = await client.semanticTokensRange(documentUri, lspRange);
          if (!result) return null;
          return toMonacoSemanticTokens(result);
        },
      }),
    );
  }

  // ── Diagnostics (push from server) ──
  // The client's onDiagnostics callback is set up in connectLanguageServer.ts
  // to call monaco.editor.setModelMarkers(). We don't need a provider for that.

  return {
    disposables,
    dispose: () => {
      for (const d of disposables) {
        try { d.dispose(); } catch { /* ignore */ }
      }
      disposables.length = 0;
    },
  };
}
