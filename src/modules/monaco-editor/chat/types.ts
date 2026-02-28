/**
 * @module monaco-editor/chat/types
 *
 * Type definitions for the AI Chat feature.
 */

/* ── Provider Types ────────────────────────────────────────── */

/** A single AI provider returned from the `ai/providers` endpoint */
export interface ChatProvider {
  /** Unique provider ID (e.g. "openai", "ollama", "anthropic") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional icon URL or icon key */
  icon?: string;
  /** Available models for this provider */
  models: ChatModel[];
  /** Whether this provider is currently available / healthy */
  available: boolean;
}

/** A model within a provider */
export interface ChatModel {
  id: string;
  name: string;
  /** Max context tokens */
  maxTokens?: number;
}

/* ── Message Types ─────────────────────────────────────────── */

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  /** Unique message ID */
  id: string;
  /** Who sent this message */
  role: ChatRole;
  /** Raw message content (may include markdown / code blocks) */
  content: string;
  /** Timestamp */
  timestamp: number;
  /** Whether this message is still being streamed */
  streaming?: boolean;
  /** Extracted code blocks (for diff preview) */
  codeBlocks?: CodeBlock[];
  /** Provider + model used (for assistant messages) */
  model?: string;
  /** Error if the request failed */
  error?: string;
}

/** A code block extracted from an assistant message */
export interface CodeBlock {
  /** Language (from the fenced code block) */
  language: string;
  /** The code content */
  code: string;
  /** Whether the user accepted this suggestion */
  accepted?: boolean;
  /** Start line index in the original message content */
  startIndex: number;
}

/* ── Request / Response ────────────────────────────────────── */

/** POST body for `api/chat` */
export interface ChatRequest {
  /** The user's question / prompt */
  question: string;
  /** Programming language of the current file */
  language: string;
  /** Current file content (context) */
  context: string;
  /** Current filename */
  filename?: string;
  /** Selected text in the editor (if any) */
  selection?: string;
  /** Cursor position */
  cursorPosition?: { lineNumber: number; column: number };
  /** Provider ID to use */
  providerId?: string;
  /** Model ID to use */
  modelId?: string;
  /** Conversation history (for multi-turn) */
  history?: Array<{ role: ChatRole; content: string }>;
}

/** Single SSE chunk from the chat endpoint */
export interface ChatStreamChunk {
  /** Token / text delta */
  content?: string;
  /** Whether the stream is done */
  done?: boolean;
  /** Error message */
  error?: string;
  /** Model used */
  model?: string;
}

/* ── Conversation ──────────────────────────────────────────── */

export interface ChatConversation {
  /** Unique conversation ID */
  id: string;
  /** Conversation title (auto-generated from first message) */
  title: string;
  /** Messages in this conversation */
  messages: ChatMessage[];
  /** When was this conversation created */
  createdAt: number;
  /** When was this conversation last updated */
  updatedAt: number;
}
