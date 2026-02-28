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
  toMonacoCompletionItem,
  toMonacoHover,
  toMonacoSignatureHelp,
  toMonacoDefinition,
  toMonacoDocumentSymbols,
  toMonacoTextEdits,
  toMonacoMarkers,
  toMonacoRange,
  fromMonacoRange,
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

  // ── Completion Provider ──
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
    }),
  );

  // ── Hover Provider ──
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

  // ── Signature Help Provider ──
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

  // ── Definition Provider ──
  disposables.push(
    monaco.languages.registerDefinitionProvider(languageId, {
      async provideDefinition(_model, position) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.definition(documentUri, lspPos);
        return toMonacoDefinition(result);
      },
    }),
  );

  // ── References Provider ──
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

  // ── Document Symbol Provider ──
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

        // SymbolInformation[] → flat list
        return (result as lsp.SymbolInformation[]).map((si) => ({
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

  // ── Document Formatting Provider ──
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

  // ── Rename Provider ──
  disposables.push(
    monaco.languages.registerRenameProvider(languageId, {
      async provideRenameEdits(_model, position, newName) {
        const lspPos = fromMonacoPosition(position);
        const result = await client.rename(documentUri, lspPos, newName);
        if (!result || !result.changes) return { edits: [] };

        const edits: monacoNs.languages.IWorkspaceTextEdit[] = [];
        for (const [uri, textEdits] of Object.entries(result.changes)) {
          for (const te of textEdits) {
            edits.push({
              resource: monaco.Uri.parse(uri),
              textEdit: {
                range: toMonacoRange(te.range),
                text: te.newText,
              },
              versionId: undefined,
            });
          }
        }
        return { edits };
      },
    }),
  );

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
