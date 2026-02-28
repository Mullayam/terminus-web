/**
 * @module monaco-editor/lib/lsp
 *
 * LSP subsystem — lightweight Language Server Protocol client for Monaco.
 *
 * Architecture:
 *   client.ts     — WebSocket + JSON-RPC transport (vscode-ws-jsonrpc)
 *   converters.ts — LSP ↔ Monaco type adapters
 *   providers.ts  — Monaco language provider registrations
 *   types.ts      — Shared types
 */

export { createLSPClient } from "./client";
export type { LSPClient, LSPClientOptions } from "./client";

export { registerLSPProviders } from "./providers";
export type { LSPProviderRegistration } from "./providers";

export {
  toMonacoPosition,
  fromMonacoPosition,
  toMonacoRange,
  fromMonacoRange,
  toMonacoHover,
  toMonacoCompletionItem,
  toMonacoSignatureHelp,
  toMonacoDefinition,
  toMonacoMarkers,
  toMonacoSeverity,
  toMonacoDocumentSymbols,
  toMonacoTextEdits,
  setMonacoRef,
} from "./converters";

export type { LSPConnectionOptions, LSPConnection } from "./types";
