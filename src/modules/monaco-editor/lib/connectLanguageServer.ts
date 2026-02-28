/**
 * @module lib/monaco/connectLanguageServer
 *
 * Connects Monaco to a Language Server via WebSocket using
 * the custom LSP client (`lib/lsp/client.ts`) and provider bridge
 * (`lib/lsp/providers.ts`).
 *
 * The backend must expose a WebSocket endpoint that speaks the
 * LSP JSON-RPC protocol, e.g.:
 *   ws://localhost:3000/lsp?languageId=typescript
 *   ws://localhost:3000/lsp?languageId=go
 *
 * ```ts
 * import { connectLanguageServer } from "@/modules/monaco-editor";
 *
 * const connection = await connectLanguageServer({
 *   languageId: "typescript",
 *   wsUrl: "ws://localhost:3000/lsp?languageId=typescript",
 *   documentUri: "file:///project/src/app.tsx",
 *   monaco,
 *   editor,
 * });
 *
 * // later: connection.dispose();
 * ```
 */

import type * as monacoNs from "monaco-editor";
import { createLSPClient, type LSPClient, type LSPShowMessageParams, LSPMessageType } from "./lsp/client";
import { registerLSPProviders, type LSPProviderRegistration } from "./lsp/providers";
import { toMonacoMarkers, setMonacoRef } from "./lsp/converters";

type Monaco = typeof monacoNs;

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
  /** Monaco namespace (required for provider registration) */
  monaco?: Monaco;
  /** Editor instance (required for provider registration) */
  editor?: monacoNs.editor.ICodeEditor;
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
  /** Callback for LSP window/showMessage and window/logMessage notifications */
  onServerMessage?: (message: string, severity: "error" | "warning" | "info" | "log" | "debug", languageId: string) => void;
}

export interface LSPConnection {
  /** The underlying LSP client */
  client: LSPClient;
  /** Provider registrations (completion, hover, etc.) */
  providers: LSPProviderRegistration | null;
  /** Dispose the connection and clean up */
  dispose: () => void;
  /** Whether the connection is currently active */
  isConnected: () => boolean;
}

/* ── Known LSP-supported languages ─────────────────────────── */

/** Languages that typically have LSP server support */
export const LSP_LANGUAGES: Record<string, { name: string; wsPath: string }> = {
  // JavaScript / TypeScript family
  typescript: { name: "TypeScript Language Server", wsPath: "typescript" },
  javascript: { name: "TypeScript Language Server", wsPath: "typescript" },
  typescriptreact: { name: "TypeScript Language Server", wsPath: "typescript" },
  javascriptreact: { name: "TypeScript Language Server", wsPath: "typescript" },
  // Systems languages
  go: { name: "gopls", wsPath: "go" },
  rust: { name: "rust-analyzer", wsPath: "rust" },
  c: { name: "clangd", wsPath: "c" },
  cpp: { name: "clangd", wsPath: "cpp" },
  objective_c: { name: "clangd", wsPath: "objective-c" },
  // JVM languages
  java: { name: "Eclipse JDT.LS", wsPath: "java" },
  kotlin: { name: "kotlin-language-server", wsPath: "kotlin" },
  scala: { name: "Metals", wsPath: "scala" },
  groovy: { name: "groovy-language-server", wsPath: "groovy" },
  // .NET / Microsoft
  csharp: { name: "OmniSharp", wsPath: "csharp" },
  fsharp: { name: "FsAutoComplete", wsPath: "fsharp" },
  vb: { name: "VB Language Server", wsPath: "vb" },
  powershell: { name: "PowerShell Editor Services", wsPath: "powershell" },
  // Scripting languages
  python: { name: "Pylsp", wsPath: "python" },
  ruby: { name: "Solargraph", wsPath: "ruby" },
  php: { name: "phpactor", wsPath: "php" },
  perl: { name: "Perl Navigator", wsPath: "perl" },
  lua: { name: "lua-language-server", wsPath: "lua" },
  r: { name: "languageserver", wsPath: "r" },
  julia: { name: "LanguageServer.jl", wsPath: "julia" },
  elixir: { name: "ElixirLS", wsPath: "elixir" },
  erlang: { name: "erlang_ls", wsPath: "erlang" },
  dart: { name: "Dart Analysis Server", wsPath: "dart" },
  // Shell / scripting
  shellscript: { name: "bash-language-server", wsPath: "shellscript" },
  shell: { name: "bash-language-server", wsPath: "shellscript" },
  bash: { name: "bash-language-server", wsPath: "shellscript" },
  sh: { name: "bash-language-server", wsPath: "shellscript" },
  zsh: { name: "bash-language-server", wsPath: "shellscript" },
  fish: { name: "bash-language-server", wsPath: "shellscript" },
  bat: { name: "bash-language-server", wsPath: "bat" },
  // Web / markup / style
  html: { name: "vscode-html-languageservice", wsPath: "html" },
  css: { name: "vscode-css-languageservice", wsPath: "css" },
  scss: { name: "vscode-css-languageservice", wsPath: "scss" },
  less: { name: "vscode-css-languageservice", wsPath: "less" },
  vue: { name: "Volar", wsPath: "vue" },
  svelte: { name: "svelte-language-server", wsPath: "svelte" },
  astro: { name: "astro-ls", wsPath: "astro" },
  // Data / config formats
  json: { name: "vscode-json-languageservice", wsPath: "json" },
  jsonc: { name: "vscode-json-languageservice", wsPath: "json" },
  yaml: { name: "yaml-language-server", wsPath: "yaml" },
  yml: { name: "yaml-language-server", wsPath: "yaml" },
  toml: { name: "taplo", wsPath: "toml" },
  xml: { name: "lemminx", wsPath: "xml" },
  // Infrastructure / DevOps
  dockerfile: { name: "dockerfile-language-server", wsPath: "dockerfile" },
  docker: { name: "dockerfile-language-server", wsPath: "dockerfile" },
  dockercompose: { name: "docker-compose-language-service", wsPath: "dockercompose" },
  terraform: { name: "terraform-ls", wsPath: "terraform" },
  hcl: { name: "terraform-ls", wsPath: "hcl" },
  bicep: { name: "Bicep Language Server", wsPath: "bicep" },
  ansible: { name: "ansible-language-server", wsPath: "ansible" },
  puppet: { name: "puppet-languageserver", wsPath: "puppet" },
  nix: { name: "nil", wsPath: "nix" },
  // Database / query
  sql: { name: "sql-language-server", wsPath: "sql" },
  mysql: { name: "sql-language-server", wsPath: "mysql" },
  pgsql: { name: "sql-language-server", wsPath: "pgsql" },
  graphql: { name: "graphql-language-service", wsPath: "graphql" },
  prisma: { name: "prisma-language-server", wsPath: "prisma" },
  // Functional languages
  haskell: { name: "haskell-language-server", wsPath: "haskell" },
  ocaml: { name: "ocamllsp", wsPath: "ocaml" },
  clojure: { name: "clojure-lsp", wsPath: "clojure" },
  // Compiled / modern languages
  swift: { name: "sourcekit-lsp", wsPath: "swift" },
  zig: { name: "zls", wsPath: "zig" },
  nim: { name: "nimlsp", wsPath: "nim" },
  v: { name: "v-analyzer", wsPath: "v" },
  // Documentation / text
  markdown: { name: "marksman", wsPath: "markdown" },
  latex: { name: "texlab", wsPath: "latex" },
  tex: { name: "texlab", wsPath: "latex" },
  restructuredtext: { name: "esbonio", wsPath: "restructuredtext" },
  // Other
  proto3: { name: "pbls", wsPath: "proto3" },
  protobuf: { name: "pbls", wsPath: "protobuf" },
  cmake: { name: "cmake-language-server", wsPath: "cmake" },
  makefile: { name: "make-lsp", wsPath: "makefile" },
  ini: { name: "ini-language-server", wsPath: "ini" },
  nginx: { name: "nginx-language-server", wsPath: "nginx" },
  solidity: { name: "solidity-language-server", wsPath: "solidity" },
  wgsl: { name: "wgsl-analyzer", wsPath: "wgsl" },
  glsl: { name: "glsl-lsp", wsPath: "glsl" },
};

/**
 * Check if a language has known LSP support.
 */
export function hasLSPSupport(languageId: string): boolean {
  return languageId in LSP_LANGUAGES;
}

/**
 * Build the WebSocket URL for a language server.
 *
 * Produces URLs like: `ws://localhost:3000/lsp?languageId=typescript`
 *
 * @param baseUrl  Base URL (e.g., "ws://localhost:3000" or from config)
 * @param langId   Monaco language ID
 * @returns Full WebSocket URL or null if language isn't supported
 */
export function buildLSPWebSocketUrl(baseUrl: string, langId: string): string | null {
  const lspInfo = LSP_LANGUAGES[langId];
  if (!lspInfo) return null;

  // Convert http(s) to ws(s)
  const wsBase = baseUrl.replace(/^http/, "ws").replace(/\/$/, "");

  // Use query parameter format: /lsp?languageId=typescript
  return `${wsBase}/lsp?languageId=${encodeURIComponent(lspInfo.wsPath)}`;
}

/**
 * Connect to a Language Server over WebSocket.
 *
 * - Creates the LSP client (WebSocket + JSON-RPC + initialize handshake)
 * - Registers Monaco language providers (completion, hover, definition, etc.)
 * - Sends textDocument/didOpen for the current document
 * - Sets up diagnostics → Monaco markers bridge
 * - Handles auto-reconnect on WebSocket close
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
    monaco,
    editor,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 3000,
    onConnected,
    onDisconnected,
    onError,
    onServerMessage,
  } = options;

  /** Map LSP MessageType number → severity string */
  function lspMessageTypeToSeverity(type: number): "error" | "warning" | "info" | "log" | "debug" {
    switch (type) {
      case LSPMessageType.Error:   return "error";
      case LSPMessageType.Warning: return "warning";
      case LSPMessageType.Info:    return "info";
      case LSPMessageType.Log:     return "log";
      case LSPMessageType.Debug:   return "debug";
      default:                     return "info";
    }
  }

  let lspClient: LSPClient | null = null;
  let providerReg: LSPProviderRegistration | null = null;
  let reconnectAttempts = 0;
  let disposed = false;
  let connected = false;

  // Document version counter (incremented on each change)
  let docVersion = 1;

  // Resolve document URI
  const resolvedDocUri = documentUri ?? `file:///untitled-${Date.now()}.${languageId}`;

  async function connect(): Promise<void> {
    if (disposed) throw new Error("Connection disposed");

    lspClient = await createLSPClient({
      wsUrl,
      languageId,
      documentUri: resolvedDocUri,
      rootUri,
      onDiagnostics: (uri, diagnostics) => {
        // Bridge LSP diagnostics → Monaco markers
        if (monaco && editor) {
          setMonacoRef(monaco);
          const model = editor.getModel();
          if (model && model.uri.toString() === uri) {
            const markers = toMonacoMarkers(monaco, diagnostics);
            monaco.editor.setModelMarkers(model, `lsp-${languageId}`, markers);
          }
        }
      },
      onConnected: () => {
        connected = true;
        reconnectAttempts = 0;
        onConnected?.();

        // Register Monaco providers if monaco + editor are available
        if (monaco && lspClient) {
          providerReg?.dispose();
          providerReg = registerLSPProviders(monaco, languageId, lspClient, resolvedDocUri);
        }

        // Send didOpen for the current document
        if (lspClient && editor) {
          const model = editor.getModel();
          if (model) {
            lspClient.didOpen(
              resolvedDocUri,
              languageId,
              docVersion,
              model.getValue(),
            );

            // Listen for content changes → didChange
            const changeDisposable = model.onDidChangeContent(() => {
              if (lspClient?.isConnected()) {
                docVersion++;
                lspClient.didChange(resolvedDocUri, docVersion, model.getValue());
              }
            });
            // Store disposable for cleanup
            if (providerReg) {
              providerReg.disposables.push(changeDisposable);
            }
          }
        }
      },
      onDisconnected: () => {
        connected = false;
        providerReg?.dispose();
        providerReg = null;
        onDisconnected?.();

        // Auto-reconnect
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
      },
      onError: (error) => {
        onError?.(error);
      },
      onShowMessage: (params: LSPShowMessageParams) => {
        const severity = lspMessageTypeToSeverity(params.type);
        console.log(`[LSP:${languageId}] showMessage (${severity}):`, params.message);
        onServerMessage?.(params.message, severity, languageId);
      },
      onLogMessage: (params: LSPShowMessageParams) => {
        const severity = lspMessageTypeToSeverity(params.type);
        console.log(`[LSP:${languageId}] logMessage (${severity}):`, params.message);
        // Only surface errors/warnings as notifications; info/log/debug go to console only
        if (params.type <= LSPMessageType.Warning) {
          onServerMessage?.(params.message, severity, languageId);
        }
      },
    });
  }

  await connect();

  return {
    client: lspClient!,
    providers: providerReg,
    dispose: () => {
      disposed = true;
      connected = false;
      providerReg?.dispose();
      providerReg = null;
      lspClient?.dispose();
      lspClient = null;
    },
    isConnected: () => connected && !disposed,
  };
}
