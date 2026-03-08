/**
 * @module monaco-editor/lib/lsp/client
 *
 * Low-level LSP client over WebSocket using vscode-ws-jsonrpc.
 *
 * Design Pattern: Facade — wraps the complexity of WebSocket transport,
 * JSON-RPC messaging, and LSP lifecycle into a single `createLSPClient()` call.
 *
 * Uses the library's `listen()` helper which correctly handles:
 *  - WebSocket → IWebSocket conversion (toSocket)
 *  - Reader / Writer / MessageConnection creation (createWebSocketConnection)
 *  - Auto-disposal of connection on close
 *  - Console logger for JSON-RPC debugging
 *
 * NOTE: We use plain LSP method strings (e.g. "initialize", "textDocument/completion")
 * instead of typed `lsp.InitializeRequest.type` objects. This avoids type conflicts
 * between vscode-ws-jsonrpc's bundled vscode-jsonrpc@~8.2.1 and
 * vscode-languageserver-protocol's vscode-jsonrpc@8.2.0 (separate class instances,
 * incompatible private fields).
 */

import { listen } from "vscode-ws-jsonrpc";
import type { MessageConnection } from "vscode-jsonrpc";
import type * as lsp from "vscode-languageserver-protocol";

/**
 * LSP MessageType values (from the spec).
 * Used in window/showMessage and window/logMessage notifications.
 */
export const LSPMessageType = {
  Error: 1,
  Warning: 2,
  Info: 3,
  Log: 4,
  Debug: 5,
} as const;

export type LSPMessageTypeValue = (typeof LSPMessageType)[keyof typeof LSPMessageType];

export interface LSPShowMessageParams {
  type: LSPMessageTypeValue;
  message: string;
}

export interface LSPClientOptions {
  wsUrl: string;
  languageId: string;
  documentUri: string;
  rootUri?: string;
  onDiagnostics?: (uri: string, diagnostics: lsp.Diagnostic[]) => void;
  /** Called when the server sends window/showMessage */
  onShowMessage?: (params: LSPShowMessageParams) => void;
  /** Called when the server sends window/logMessage */
  onLogMessage?: (params: LSPShowMessageParams) => void;
  onConnected?: (client: LSPClient) => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export interface LSPClient {
  /** The JSON-RPC message connection */
  connection: MessageConnection;
  /** Dispose the client and close WebSocket */
  dispose: () => void;
  /** Whether the connection is live */
  isConnected: () => boolean;
  /** Send textDocument/didOpen */
  didOpen: (uri: string, languageId: string, version: number, text: string) => void;
  /** Send textDocument/didChange (full sync) */
  didChange: (uri: string, version: number, text: string) => void;
  /** Send textDocument/didClose */
  didClose: (uri: string) => void;
  /** Request textDocument/completion */
  completion: (uri: string, position: lsp.Position) => Promise<lsp.CompletionList | lsp.CompletionItem[] | null>;
  /** Request textDocument/hover */
  hover: (uri: string, position: lsp.Position) => Promise<lsp.Hover | null>;
  /** Request textDocument/signatureHelp */
  signatureHelp: (uri: string, position: lsp.Position) => Promise<lsp.SignatureHelp | null>;
  /** Request textDocument/definition */
  definition: (uri: string, position: lsp.Position) => Promise<lsp.Definition | lsp.LocationLink[] | null>;
  /** Request textDocument/references */
  references: (uri: string, position: lsp.Position) => Promise<lsp.Location[] | null>;
  /** Request textDocument/documentSymbol */
  documentSymbol: (uri: string) => Promise<lsp.DocumentSymbol[] | lsp.SymbolInformation[] | null>;
  /** Request textDocument/formatting */
  formatting: (uri: string, options: lsp.FormattingOptions) => Promise<lsp.TextEdit[] | null>;
  /** Request textDocument/rename */
  rename: (uri: string, position: lsp.Position, newName: string) => Promise<lsp.WorkspaceEdit | null>;
  /** Request textDocument/declaration */
  declaration: (uri: string, position: lsp.Position) => Promise<lsp.Declaration | lsp.LocationLink[] | null>;
  /** Request textDocument/typeDefinition */
  typeDefinition: (uri: string, position: lsp.Position) => Promise<lsp.Definition | lsp.LocationLink[] | null>;
  /** Request textDocument/implementation */
  implementation: (uri: string, position: lsp.Position) => Promise<lsp.Definition | lsp.LocationLink[] | null>;
  /** Request textDocument/documentHighlight */
  documentHighlight: (uri: string, position: lsp.Position) => Promise<lsp.DocumentHighlight[] | null>;
  /** Request textDocument/codeAction */
  codeAction: (uri: string, range: lsp.Range, context: lsp.CodeActionContext) => Promise<(lsp.Command | lsp.CodeAction)[] | null>;
  /** Request textDocument/codeLens */
  codeLens: (uri: string) => Promise<lsp.CodeLens[] | null>;
  /** Request codeLens/resolve */
  codeLensResolve: (lens: lsp.CodeLens) => Promise<lsp.CodeLens>;
  /** Request textDocument/documentLink */
  documentLink: (uri: string) => Promise<lsp.DocumentLink[] | null>;
  /** Request documentLink/resolve */
  documentLinkResolve: (link: lsp.DocumentLink) => Promise<lsp.DocumentLink>;
  /** Request textDocument/documentColor */
  documentColor: (uri: string) => Promise<lsp.ColorInformation[] | null>;
  /** Request textDocument/colorPresentation */
  colorPresentation: (uri: string, color: lsp.Color, range: lsp.Range) => Promise<lsp.ColorPresentation[] | null>;
  /** Request textDocument/rangeFormatting */
  rangeFormatting: (uri: string, range: lsp.Range, options: lsp.FormattingOptions) => Promise<lsp.TextEdit[] | null>;
  /** Request textDocument/onTypeFormatting */
  onTypeFormatting: (uri: string, position: lsp.Position, ch: string, options: lsp.FormattingOptions) => Promise<lsp.TextEdit[] | null>;
  /** Request textDocument/prepareRename */
  prepareRename: (uri: string, position: lsp.Position) => Promise<lsp.Range | { range: lsp.Range; placeholder: string } | null>;
  /** Request textDocument/foldingRange */
  foldingRange: (uri: string) => Promise<lsp.FoldingRange[] | null>;
  /** Request textDocument/selectionRange */
  selectionRange: (uri: string, positions: lsp.Position[]) => Promise<lsp.SelectionRange[] | null>;
  /** Request textDocument/linkedEditingRange */
  linkedEditingRange: (uri: string, position: lsp.Position) => Promise<lsp.LinkedEditingRanges | null>;
  /** Request textDocument/inlayHint */
  inlayHint: (uri: string, range: lsp.Range) => Promise<lsp.InlayHint[] | null>;
  /** Request inlayHint/resolve */
  inlayHintResolve: (hint: lsp.InlayHint) => Promise<lsp.InlayHint>;
  /** Request textDocument/semanticTokens/full */
  semanticTokensFull: (uri: string) => Promise<lsp.SemanticTokens | null>;
  /** Request textDocument/semanticTokens/range */
  semanticTokensRange: (uri: string, range: lsp.Range) => Promise<lsp.SemanticTokens | null>;
  /** Request completionItem/resolve */
  completionItemResolve: (item: lsp.CompletionItem) => Promise<lsp.CompletionItem>;
  /** Server capabilities returned from initialize */
  serverCapabilities: Record<string, any>;
}

/**
 * Create an LSP client connected over WebSocket.
 *
 * Uses `vscode-ws-jsonrpc`'s `listen()` helper for correct WebSocket lifecycle:
 *  - `toSocket()` wraps the raw WebSocket into an IWebSocket
 *  - `createWebSocketConnection()` creates Reader/Writer/MessageConnection with
 *    auto-disposal on close and a ConsoleLogger for JSON-RPC debugging
 *
 * Sequence: WebSocket open → listen() → onConnection → initialize → initialized → resolve
 */
export function createLSPClient(opts: LSPClientOptions): Promise<LSPClient> {
  return new Promise((resolve, reject) => {
    let connected = false;
    let disposed = false;
    let connection: MessageConnection;

    let ws: WebSocket;
    try {
      ws = new WebSocket(opts.wsUrl);
    } catch (err) {
      reject(new Error(`Failed to create WebSocket: ${err}`));
      return;
    }

    // Handle pre-connection failures.
    // These handlers are active until `listen()`'s `onopen` fires, at which
    // point `toSocket()` replaces them with the library's own handlers.
    ws.onerror = () => {
      if (!connected) {
        const error = new Error(`WebSocket connection failed for ${opts.languageId}`);
        opts.onError?.(error);
        reject(error);
      }
    };

    ws.onclose = () => {
      if (!connected) {
        reject(new Error(`WebSocket closed before LSP init for ${opts.languageId}`));
      }
    };

    // Use the library's `listen()` helper — this properly sequences:
    //  1. Sets ws.onopen
    //  2. Inside onopen: toSocket(ws) → createWebSocketConnection(socket, logger)
    //  3. createWebSocketConnection adds: connection.onClose(() => connection.dispose())
    //  4. Calls our onConnection callback with the ready MessageConnection
    listen({
      webSocket: ws,
      onConnection: async (conn) => {
        // Cast needed: vscode-ws-jsonrpc bundles its own vscode-jsonrpc copy whose
        // MessageConnection type has identical structure but separate private fields.
        connection = conn as unknown as MessageConnection;

        try {
          // ── Register notification handlers ──

          connection.onNotification(
            "textDocument/publishDiagnostics",
            (params: { uri: string; diagnostics: lsp.Diagnostic[] }) => {
              opts.onDiagnostics?.(params.uri, params.diagnostics);
            },
          );

          connection.onNotification(
            "window/showMessage",
            (params: LSPShowMessageParams) => {
              opts.onShowMessage?.(params);
            },
          );

          connection.onNotification(
            "window/logMessage",
            (params: LSPShowMessageParams) => {
              opts.onLogMessage?.(params);
            },
          );

          // Handle window/showMessageRequest (server → client request)
          connection.onRequest(
            "window/showMessageRequest",
            (params: LSPShowMessageParams & { actions?: Array<{ title: string }> }) => {
              opts.onShowMessage?.(params);
              return null;
            },
          );

          connection.onClose(() => {
            connected = false;
            opts.onDisconnected?.();
          });

          connection.onError((err) => {
            const error = Array.isArray(err) ? err[0] : err;
            // Suppress "Error during socket reconnect" errors from the reader's
            // onClose handler — these are expected on disconnect and already
            // handled by the onDisconnected callback.
            if (error?.message?.includes("socket reconnect")) return;
            opts.onError?.(error);
          });

          // The connection is already listening (createWebSocketConnection calls listen())
          // but we need to ensure our handlers are registered first.
          // vscode-ws-jsonrpc v3's createWebSocketConnection does NOT call connection.listen()
          // automatically — we must do it ourselves.
          connection.listen();

          // ── LSP Initialize ──
          const initResult = await connection.sendRequest("initialize", {
            processId: null,
            rootUri: opts.rootUri ?? null,
            capabilities: {
              textDocument: {
                synchronization: {
                  dynamicRegistration: false,
                  willSave: false,
                  willSaveWaitUntil: false,
                  didSave: true,
                },
                completion: {
                  dynamicRegistration: false,
                  completionItem: {
                    snippetSupport: true,
                    documentationFormat: ["markdown", "plaintext"],
                    resolveSupport: { properties: ["documentation", "detail"] },
                  },
                  contextSupport: true,
                },
                hover: {
                  dynamicRegistration: false,
                  contentFormat: ["markdown", "plaintext"],
                },
                signatureHelp: {
                  dynamicRegistration: false,
                  signatureInformation: {
                    documentationFormat: ["markdown", "plaintext"],
                    parameterInformation: { labelOffsetSupport: true },
                  },
                },
                definition: { dynamicRegistration: false },
                references: { dynamicRegistration: false },
                documentSymbol: {
                  dynamicRegistration: false,
                  hierarchicalDocumentSymbolSupport: true,
                },
                formatting: { dynamicRegistration: false },
                rename: { dynamicRegistration: false, prepareSupport: true },
                publishDiagnostics: {
                  relatedInformation: true,
                  tagSupport: { valueSet: [1, 2] },
                },
                codeAction: {
                  dynamicRegistration: false,
                  codeActionLiteralSupport: {
                    codeActionKind: {
                      valueSet: ["quickfix", "refactor", "source"],
                    },
                  },
                  resolveSupport: { properties: ["edit"] },
                },
                declaration: { dynamicRegistration: false },
                typeDefinition: { dynamicRegistration: false },
                implementation: { dynamicRegistration: false },
                documentHighlight: { dynamicRegistration: false },
                codeLens: { dynamicRegistration: false },
                documentLink: { dynamicRegistration: false },
                colorProvider: { dynamicRegistration: false },
                rangeFormatting: { dynamicRegistration: false },
                onTypeFormatting: { dynamicRegistration: false },
                foldingRange: {
                  dynamicRegistration: false,
                  rangeLimit: 5000,
                },
                selectionRange: { dynamicRegistration: false },
                linkedEditingRange: { dynamicRegistration: false },
                inlayHint: { dynamicRegistration: false },
                semanticTokens: {
                  dynamicRegistration: false,
                  tokenTypes: [
                    "namespace", "type", "class", "enum", "interface",
                    "struct", "typeParameter", "parameter", "variable",
                    "property", "enumMember", "event", "function",
                    "method", "macro", "keyword", "modifier", "comment",
                    "string", "number", "regexp", "operator", "decorator",
                  ],
                  tokenModifiers: [
                    "declaration", "definition", "readonly", "static",
                    "deprecated", "abstract", "async", "modification",
                    "documentation", "defaultLibrary",
                  ],
                  formats: ["relative"],
                  requests: { full: true, range: true },
                  multilineTokenSupport: false,
                  overlappingTokenSupport: false,
                },
              },
              workspace: {
                workspaceFolders: false,
                configuration: false,
              },
            },
          });

          const serverCaps = (initResult as any)?.capabilities ?? {};

          // ── LSP Initialized notification ──
          connection.sendNotification("initialized", {});

          connected = true;

          // Build the client facade BEFORE firing onConnected
          // so the callback receives the ready client instance.
          const client: LSPClient = {
            connection,
            serverCapabilities: serverCaps,
            isConnected: () => connected && !disposed,
            dispose: () => {
              if (disposed) return;
              disposed = true;
              connected = false;
              try {
                connection.sendNotification("exit");
              } catch { /* connection may already be closed */ }
              try {
                connection.dispose();
              } catch { /* ignore */ }
              try {
                ws.close();
              } catch { /* ignore */ }
            },

            didOpen(uri, langId, version, text) {
              if (!connected) return;
              connection.sendNotification("textDocument/didOpen", {
                textDocument: { uri, languageId: langId, version, text },
              });
            },

            didChange(uri, version, text) {
              if (!connected) return;
              connection.sendNotification("textDocument/didChange", {
                textDocument: { uri, version },
                contentChanges: [{ text }],
              });
            },

            didClose(uri) {
              if (!connected) return;
              connection.sendNotification("textDocument/didClose", {
                textDocument: { uri },
              });
            },

            async completion(uri, position) {
              try {
                return await connection.sendRequest("textDocument/completion", {
                  textDocument: { uri },
                  position,
                });
              } catch { return null; }
            },

            async hover(uri, position) {
              try {
                return await connection.sendRequest("textDocument/hover", {
                  textDocument: { uri },
                  position,
                });
              } catch { return null; }
            },

            async signatureHelp(uri, position) {
              try {
                return await connection.sendRequest("textDocument/signatureHelp", {
                  textDocument: { uri },
                  position,
                  context: { triggerKind: 1 /* Invoked */, isRetrigger: false },
                });
              } catch { return null; }
            },

            async definition(uri, position) {
              try {
                return await connection.sendRequest("textDocument/definition", {
                  textDocument: { uri },
                  position,
                });
              } catch { return null; }
            },

            async references(uri, position) {
              try {
                return await connection.sendRequest("textDocument/references", {
                  textDocument: { uri },
                  position,
                  context: { includeDeclaration: true },
                });
              } catch { return null; }
            },

            async documentSymbol(uri) {
              try {
                return await connection.sendRequest("textDocument/documentSymbol", {
                  textDocument: { uri },
                });
              } catch { return null; }
            },

            async formatting(uri, options) {
              try {
                return await connection.sendRequest("textDocument/formatting", {
                  textDocument: { uri },
                  options,
                });
              } catch { return null; }
            },

            async rename(uri, position, newName) {
              try {
                return await connection.sendRequest("textDocument/rename", {
                  textDocument: { uri },
                  position,
                  newName,
                });
              } catch { return null; }
            },

            async declaration(uri, position) {
              try {
                return await connection.sendRequest("textDocument/declaration", {
                  textDocument: { uri },
                  position,
                });
              } catch { return null; }
            },

            async typeDefinition(uri, position) {
              try {
                return await connection.sendRequest("textDocument/typeDefinition", {
                  textDocument: { uri },
                  position,
                });
              } catch { return null; }
            },

            async implementation(uri, position) {
              try {
                return await connection.sendRequest("textDocument/implementation", {
                  textDocument: { uri },
                  position,
                });
              } catch { return null; }
            },

            async documentHighlight(uri, position) {
              try {
                return await connection.sendRequest("textDocument/documentHighlight", {
                  textDocument: { uri },
                  position,
                });
              } catch { return null; }
            },

            async codeAction(uri, range, context) {
              try {
                return await connection.sendRequest("textDocument/codeAction", {
                  textDocument: { uri },
                  range,
                  context,
                });
              } catch { return null; }
            },

            async codeLens(uri) {
              try {
                return await connection.sendRequest("textDocument/codeLens", {
                  textDocument: { uri },
                });
              } catch { return null; }
            },

            async codeLensResolve(lens) {
              try {
                return await connection.sendRequest("codeLens/resolve", lens);
              } catch { return lens; }
            },

            async documentLink(uri) {
              try {
                return await connection.sendRequest("textDocument/documentLink", {
                  textDocument: { uri },
                });
              } catch { return null; }
            },

            async documentLinkResolve(link) {
              try {
                return await connection.sendRequest("documentLink/resolve", link);
              } catch { return link; }
            },

            async documentColor(uri) {
              try {
                return await connection.sendRequest("textDocument/documentColor", {
                  textDocument: { uri },
                });
              } catch { return null; }
            },

            async colorPresentation(uri, color, range) {
              try {
                return await connection.sendRequest("textDocument/colorPresentation", {
                  textDocument: { uri },
                  color,
                  range,
                });
              } catch { return null; }
            },

            async rangeFormatting(uri, range, options) {
              try {
                return await connection.sendRequest("textDocument/rangeFormatting", {
                  textDocument: { uri },
                  range,
                  options,
                });
              } catch { return null; }
            },

            async onTypeFormatting(uri, position, ch, options) {
              try {
                return await connection.sendRequest("textDocument/onTypeFormatting", {
                  textDocument: { uri },
                  position,
                  ch,
                  options,
                });
              } catch { return null; }
            },

            async prepareRename(uri, position) {
              try {
                return await connection.sendRequest("textDocument/prepareRename", {
                  textDocument: { uri },
                  position,
                });
              } catch { return null; }
            },

            async foldingRange(uri) {
              try {
                return await connection.sendRequest("textDocument/foldingRange", {
                  textDocument: { uri },
                });
              } catch { return null; }
            },

            async selectionRange(uri, positions) {
              try {
                return await connection.sendRequest("textDocument/selectionRange", {
                  textDocument: { uri },
                  positions,
                });
              } catch { return null; }
            },

            async linkedEditingRange(uri, position) {
              try {
                return await connection.sendRequest("textDocument/linkedEditingRange", {
                  textDocument: { uri },
                  position,
                });
              } catch { return null; }
            },

            async inlayHint(uri, range) {
              try {
                return await connection.sendRequest("textDocument/inlayHint", {
                  textDocument: { uri },
                  range,
                });
              } catch { return null; }
            },

            async inlayHintResolve(hint) {
              try {
                return await connection.sendRequest("inlayHint/resolve", hint);
              } catch { return hint; }
            },

            async semanticTokensFull(uri) {
              try {
                return await connection.sendRequest("textDocument/semanticTokens/full", {
                  textDocument: { uri },
                });
              } catch { return null; }
            },

            async semanticTokensRange(uri, range) {
              try {
                return await connection.sendRequest("textDocument/semanticTokens/range", {
                  textDocument: { uri },
                  range,
                });
              } catch { return null; }
            },

            async completionItemResolve(item) {
              try {
                return await connection.sendRequest("completionItem/resolve", item);
              } catch { return item; }
            },
          };

          opts.onConnected?.(client);
          resolve(client);
        } catch (err) {
          reject(err);
        }
      },
    });
  });
}
