/**
 * @module lib/monaco/connectLanguageServer
 *
 * Connects Monaco to a Language Server via WebSocket using
 * `monaco-languageclient` and `vscode-ws-jsonrpc`.
 *
 * The backend must expose a WebSocket endpoint that speaks the
 * LSP JSON-RPC protocol, e.g.:
 *   ws://localhost:7145/lsp/typescript
 *   ws://localhost:7145/lsp/go
 *
 * ```ts
 * import { connectLanguageServer } from "@/modules/monaco-editor";
 *
 * const connection = await connectLanguageServer({
 *   languageId: "typescript",
 *   wsUrl: "ws://localhost:7145/lsp/typescript",
 *   documentUri: "file:///project/src/app.tsx",
 * });
 *
 * // later: connection.dispose();
 * ```
 */

import { MonacoLanguageClient } from "monaco-languageclient";
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from "vscode-ws-jsonrpc";
import type { MessageTransports } from "vscode-languageclient/browser.js";

/* ── Types ─────────────────────────────────────────────────── */

export interface LSPConnectionOptions {
  /** Monaco language ID */
  languageId: string;
  /** WebSocket URL for the LSP server */
  wsUrl: string;
  /** Document URI (used for LSP textDocument/didOpen) */
  documentUri?: string;
  /** Root URI of the workspace */
  rootUri?: string;
  /** Reconnect on close? (default: true) */
  autoReconnect?: boolean;
  /** Max reconnect attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number;
  /** Callback when connected */
  onConnected?: () => void;
  /** Callback when disconnected */
  onDisconnected?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface LSPConnection {
  /** The language client instance */
  client: MonacoLanguageClient;
  /** Dispose the connection and clean up */
  dispose: () => void;
  /** Whether the connection is currently active */
  isConnected: () => boolean;
}

/* ── Known LSP-supported languages ─────────────────────────── */

/** Languages that typically have LSP server support */
export const LSP_LANGUAGES: Record<string, { name: string; wsPath: string }> = {
  typescript: { name: "TypeScript Language Server", wsPath: "/lsp/typescript" },
  javascript: { name: "TypeScript Language Server", wsPath: "/lsp/typescript" },
  go: { name: "gopls", wsPath: "/lsp/go" },
  python: { name: "Pylsp", wsPath: "/lsp/python" },
  rust: { name: "rust-analyzer", wsPath: "/lsp/rust" },
  java: { name: "Eclipse JDT.LS", wsPath: "/lsp/java" },
  cpp: { name: "clangd", wsPath: "/lsp/cpp" },
  c: { name: "clangd", wsPath: "/lsp/c" },
  csharp: { name: "OmniSharp", wsPath: "/lsp/csharp" },
  lua: { name: "lua-language-server", wsPath: "/lsp/lua" },
  php: { name: "phpactor", wsPath: "/lsp/php" },
};

/**
 * Check if a language has known LSP support.
 */
export function hasLSPSupport(languageId: string): boolean {
  return languageId in LSP_LANGUAGES;
}

/**
 * Create WebSocket-based MessageTransports for LSP communication.
 */
function createWebSocketTransports(webSocket: WebSocket): MessageTransports {
  const socket = toSocket(webSocket);
  const reader = new WebSocketMessageReader(socket);
  const writer = new WebSocketMessageWriter(socket);
  return { reader, writer };
}

/**
 * Connect to a Language Server over WebSocket.
 *
 * @param options Connection configuration
 * @returns An LSPConnection object with dispose() method
 */
export async function connectLanguageServer(
  options: LSPConnectionOptions,
): Promise<LSPConnection> {
  const {
    languageId,
    wsUrl,
    documentUri,
    rootUri,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 3000,
    onConnected,
    onDisconnected,
    onError,
  } = options;

  let client: MonacoLanguageClient | null = null;
  let webSocket: WebSocket | null = null;
  let reconnectAttempts = 0;
  let disposed = false;
  let connected = false;

  function createClient(transports: MessageTransports): MonacoLanguageClient {
    return new MonacoLanguageClient({
      name: `${languageId} LSP Client`,
      clientOptions: {
        documentSelector: [{ language: languageId }],
        ...(rootUri ? { rootUri } : {}),
      },
      messageTransports: transports,
    });
  }

  async function connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (disposed) return reject(new Error("Connection disposed"));

      webSocket = new WebSocket(wsUrl);

      webSocket.onopen = async () => {
        try {
          const transports = createWebSocketTransports(webSocket!);
          client = createClient(transports);
          await client.start();
          connected = true;
          reconnectAttempts = 0;
          onConnected?.();
          resolve();
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          onError?.(error);
          reject(error);
        }
      };

      webSocket.onerror = (event) => {
        const error = new Error(`WebSocket error connecting to ${wsUrl}`);
        onError?.(error);
        reject(error);
      };

      webSocket.onclose = async () => {
        connected = false;
        onDisconnected?.();

        if (!disposed && autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(
            `[LSP] Reconnecting to ${languageId} (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`,
          );
          setTimeout(() => {
            connect().catch(() => {
              // Reconnect failed, will try again on next close
            });
          }, reconnectDelay);
        }
      };
    });
  }

  await connect();

  return {
    client: client!,
    dispose: () => {
      disposed = true;
      connected = false;
      try {
        client?.stop();
      } catch {
        // Swallow
      }
      try {
        webSocket?.close();
      } catch {
        // Swallow
      }
    },
    isConnected: () => connected,
  };
}

/**
 * Build the WebSocket URL for a language server.
 *
 * @param baseUrl  Base URL (e.g., "ws://localhost:7145" or from config)
 * @param langId   Monaco language ID
 * @returns Full WebSocket URL or null if language isn't supported
 */
export function buildLSPWebSocketUrl(baseUrl: string, langId: string): string | null {
  const lspInfo = LSP_LANGUAGES[langId];
  if (!lspInfo) return null;

  // Convert http(s) to ws(s)
  const wsBase = baseUrl.replace(/^http/, "ws");
  return `${wsBase}${lspInfo.wsPath}`;
}
