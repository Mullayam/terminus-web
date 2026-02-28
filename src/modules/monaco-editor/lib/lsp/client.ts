/**
 * @module monaco-editor/lib/lsp/client
 *
 * Low-level LSP client over WebSocket using vscode-ws-jsonrpc.
 *
 * Design Pattern: Facade — wraps the complexity of WebSocket transport,
 * JSON-RPC messaging, and LSP lifecycle into a single `createLSPClient()` call.
 *
 * NOTE: We use plain LSP method strings (e.g. "initialize", "textDocument/completion")
 * instead of typed `lsp.InitializeRequest.type` objects. This avoids type conflicts
 * between vscode-ws-jsonrpc's bundled vscode-jsonrpc@~8.2.1 and
 * vscode-languageserver-protocol's vscode-jsonrpc@8.2.0 (separate class instances,
 * incompatible private fields).
 */

import {
  WebSocketMessageReader,
  WebSocketMessageWriter,
  toSocket,
} from "vscode-ws-jsonrpc";
import {
  createMessageConnection,
  type MessageConnection,
} from "vscode-jsonrpc/browser.js";
import type * as lsp from "vscode-languageserver-protocol";

export interface LSPClientOptions {
  wsUrl: string;
  languageId: string;
  documentUri: string;
  rootUri?: string;
  onDiagnostics?: (uri: string, diagnostics: lsp.Diagnostic[]) => void;
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
 * Handles: initialize → initialized → ready for requests.
 */
export function createLSPClient(opts: LSPClientOptions): Promise<LSPClient> {
  return new Promise((resolve, reject) => {
    let connected = false;
    let disposed = false;
    let ws: WebSocket;
    let connection: MessageConnection;

    try {
      ws = new WebSocket(opts.wsUrl);
    } catch (err) {
      reject(new Error(`Failed to create WebSocket: ${err}`));
      return;
    }

    ws.onerror = () => {
      const error = new Error(`WebSocket error for ${opts.languageId}`);
      opts.onError?.(error);
      if (!connected) reject(error);
    };

    ws.onopen = async () => {
      try {
        const socket = toSocket(ws);
        const reader = new WebSocketMessageReader(socket);
        const writer = new WebSocketMessageWriter(socket);
        connection = createMessageConnection(reader, writer);

        // Listen for diagnostics push (using method string to avoid type conflicts)
        connection.onNotification(
          "textDocument/publishDiagnostics",
          (params: { uri: string; diagnostics: lsp.Diagnostic[] }) => {
            opts.onDiagnostics?.(params.uri, params.diagnostics);
          },
        );

        connection.onClose(() => {
          connected = false;
          opts.onDisconnected?.();
        });

        connection.onError((err) => {
          opts.onError?.(Array.isArray(err) ? err[0] : err);
        });

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
                    valueSet: [
                      "quickfix",
                      "refactor",
                      "source",
                    ],
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
            } catch { /* ignore */ }
            try {
              connection.dispose();
            } catch { /* ignore */ }
            try {
              ws.close();
            } catch { /* ignore */ }
          },

          didOpen(uri, langId, version, text) {
            connection.sendNotification("textDocument/didOpen", {
              textDocument: { uri, languageId: langId, version, text },
            });
          },

          didChange(uri, version, text) {
            connection.sendNotification("textDocument/didChange", {
              textDocument: { uri, version },
              contentChanges: [{ text }],
            });
          },

          didClose(uri) {
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
    };

    ws.onclose = () => {
      if (!connected) {
        reject(new Error(`WebSocket closed before LSP init for ${opts.languageId}`));
      }
    };
  });
}
