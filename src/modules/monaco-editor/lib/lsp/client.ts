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
  onConnected?: () => void;
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
          await connection.sendRequest("initialize", {
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
                },
              },
              workspace: {
                workspaceFolders: false,
                configuration: false,
              },
            },
          });

          // ── LSP Initialized notification ──
          connection.sendNotification("initialized", {});

          connected = true;
          opts.onConnected?.();

          // Build the client facade
          const client: LSPClient = {
            connection,
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
          };

          resolve(client);
        } catch (err) {
          reject(err);
        }
      },
    });
  });
}
