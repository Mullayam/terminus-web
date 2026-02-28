/**
 * @module monaco-editor/chat
 *
 * AI Chat module — GitHub Copilot Chat-style interface for the editor.
 *
 * Architecture:
 * - `types.ts`  — All type definitions (ChatMessage, ChatProvider, etc.)
 * - `api.ts`    — API functions (fetchProviders, streamChat)
 * - `store.ts`  — Zustand store for state management
 * - `components/ChatPanel.tsx`   — Main chat panel UI
 * - `components/ChatMessage.tsx` — Single message renderer
 * - `components/DiffPreview.tsx` — Diff editor for code suggestions
 */

// ── Types ───────────────────────────────────────────────────
export type {
  ChatProvider,
  ChatModel,
  ChatRole,
  ChatMessage,
  CodeBlock,
  ChatRequest,
  ChatStreamChunk,
  ChatConversation,
} from "./types";

// ── API ─────────────────────────────────────────────────────
export { fetchProviders, streamChat, extractCodeBlocks } from "./api";

// ── Store ───────────────────────────────────────────────────
export { useChatStore } from "./store";
export type { ChatState } from "./store";

// ── Components ──────────────────────────────────────────────
export { ChatPanel } from "./components/ChatPanel";
export type { ChatPanelProps } from "./components/ChatPanel";
export { ChatMessageView } from "./components/ChatMessage";
export type { ChatMessageProps } from "./components/ChatMessage";
export { DiffPreview } from "./components/DiffPreview";
export type { DiffPreviewProps } from "./components/DiffPreview";
