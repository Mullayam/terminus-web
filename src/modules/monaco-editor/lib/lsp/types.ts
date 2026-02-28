/**
 * @module monaco-editor/lib/lsp/types
 *
 * Shared types for the LSP subsystem.
 */

import type * as monacoNs from "monaco-editor";

export type Monaco = typeof monacoNs;
export type MonacoEditor = monacoNs.editor.IStandaloneCodeEditor;

export interface LSPConnectionOptions {
  /** Monaco language ID */
  languageId: string;
  /** WebSocket URL for the LSP server */
  wsUrl: string;
  /** Document URI (e.g. "file:///home/user/project/main.ts") */
  documentUri?: string;
  /** Workspace root URI */
  rootUri?: string;
  /** Reconnect on close? */
  autoReconnect?: boolean;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
  /** Callback when connected */
  onConnected?: () => void;
  /** Callback when disconnected */
  onDisconnected?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface LSPConnection {
  /** Dispose the connection and all providers */
  dispose: () => void;
  /** Whether the connection is currently active */
  isConnected: () => boolean;
}
