/**
 * @module monaco-editor/chat/store
 *
 * Zustand store for AI Chat state management.
 *
 * Manages conversations, messages, streaming state,
 * providers, and selected model.
 */

import { create } from "zustand";
import type {
  ChatMessage,
  ChatProvider,
  ChatConversation,
  ChatRequest,
  ChatStreamChunk,
  CodeBlock,
} from "./types";
import { fetchProviders, streamChat, extractCodeBlocks } from "./api";
import {
  loadConversations,
  saveConversation,
  deleteStoredConversation,
  clearStoredConversations,
} from "./chatStorage";

/* ── Helpers ───────────────────────────────────────────────── */

let _msgCounter = 0;
function generateId(): string {
  return `msg-${Date.now()}-${++_msgCounter}`;
}

function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Debounced IDB persist for a single conversation */
const _persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
function debouncedPersist(
  conv: ChatConversation,
  hostId: string,
  filename: string,
  delay = 500,
) {
  const key = conv.id;
  const existing = _persistTimers.get(key);
  if (existing) clearTimeout(existing);
  _persistTimers.set(
    key,
    setTimeout(() => {
      _persistTimers.delete(key);
      saveConversation(conv, hostId, filename).catch(() => {});
    }, delay),
  );
}

/** Immediately persist a conversation to IDB */
function persistNow(conv: ChatConversation, hostId: string, filename: string) {
  const existing = _persistTimers.get(conv.id);
  if (existing) clearTimeout(existing);
  _persistTimers.delete(conv.id);
  saveConversation(conv, hostId, filename).catch(() => {});
}

/* ── Store State ───────────────────────────────────────────── */

export interface ChatState {
  /** Available AI providers */
  providers: ChatProvider[];
  /** Whether providers are being loaded */
  loadingProviders: boolean;
  /** Selected provider ID */
  selectedProviderId: string | null;
  /** Selected model ID */
  selectedModelId: string | null;
  /** All conversations */
  conversations: ChatConversation[];
  /** Current active conversation ID */
  activeConversationId: string | null;
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Abort controller for the current stream */
  abortController: AbortController | null;
  /** The base API URL */
  baseUrl: string;
  /** Host identifier (session / tab id) */
  hostId: string;
  /** Current filename for conversation scoping */
  filename: string;
  /** Whether conversations have been loaded from IDB */
  hydrated: boolean;
  /** Error message (if any) */
  error: string | null;

  /* ── Actions ───────────────────────────────────────────── */

  /** Set the base URL for API calls */
  setBaseUrl: (url: string) => void;
  /** Set host + filename context and load conversations from IDB */
  setContext: (hostId: string, filename: string) => Promise<void>;
  /** Fetch providers from backend */
  loadProviders: () => Promise<void>;
  /** Select a provider */
  selectProvider: (providerId: string) => void;
  /** Select a model */
  selectModel: (modelId: string) => void;
  /** Create a new conversation */
  newConversation: () => string;
  /** Set the active conversation */
  setActiveConversation: (id: string) => void;
  /** Send a message and stream the response */
  sendMessage: (params: {
    question: string;
    language: string;
    context: string;
    filename?: string;
    selection?: string;
    cursorPosition?: { lineNumber: number; column: number };
  }) => Promise<void>;
  /** Stop the current streaming response */
  stopStreaming: () => void;
  /** Clear a conversation */
  clearConversation: (id: string) => void;
  /** Delete a conversation */
  deleteConversation: (id: string) => void;
  /** Mark a code block as accepted/rejected */
  setCodeBlockAccepted: (messageId: string, blockIndex: number, accepted: boolean) => void;
  /** Clear error */
  clearError: () => void;
  /** Get the active conversation */
  getActiveConversation: () => ChatConversation | null;
  /** Get messages of the active conversation */
  getMessages: () => ChatMessage[];
}

/* ── Store ─────────────────────────────────────────────────── */

export const useChatStore = create<ChatState>((set, get) => ({
  providers: [],
  loadingProviders: false,
  selectedProviderId: null,
  selectedModelId: null,
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  abortController: null,
  baseUrl: "",
  hostId: "",
  filename: "",
  hydrated: false,
  error: null,

  setBaseUrl: (url) => set({ baseUrl: url }),

  setContext: async (hostId, filename) => {
    const prev = get();
    // Skip if context hasn't changed
    if (prev.hostId === hostId && prev.filename === filename && prev.hydrated) return;

    set({ hostId, filename, hydrated: false });
    try {
      const convs = await loadConversations(hostId, filename);
      set({
        conversations: convs,
        activeConversationId: convs[0]?.id ?? null,
        hydrated: true,
      });
    } catch {
      // If IDB fails, start fresh
      set({ conversations: [], activeConversationId: null, hydrated: true });
    }
  },

  loadProviders: async () => {
    const { baseUrl, hostId } = get();
    if (!baseUrl) return;

    set({ loadingProviders: true, error: null });
    try {
      const providers = await fetchProviders(baseUrl, hostId || undefined);
      const firstAvailable = providers.find((p) => p.available);
      set({
        providers,
        loadingProviders: false,
        selectedProviderId: firstAvailable?.id ?? null,
        selectedModelId: firstAvailable?.models?.[0]?.id ?? null,
      });
    } catch (err: any) {
      set({
        loadingProviders: false,
        error: err?.message ?? "Failed to load providers",
      });
    }
  },

  selectProvider: (providerId) => {
    const { providers } = get();
    const provider = providers.find((p) => p.id === providerId);
    set({
      selectedProviderId: providerId,
      selectedModelId: provider?.models?.[0]?.id ?? null,
    });
  },

  selectModel: (modelId) => set({ selectedModelId: modelId }),

  newConversation: () => {
    const id = generateConversationId();
    const conversation: ChatConversation = {
      id,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: id,
    }));
    // Persist to IDB
    const { hostId, filename } = get();
    if (hostId && filename) {
      saveConversation(conversation, hostId, filename).catch(() => {});
    }
    return id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  sendMessage: async ({ question, language, context, filename, selection, cursorPosition }) => {
    const state = get();
    let conversationId = state.activeConversationId;

    // Auto-create conversation if none active
    if (!conversationId) {
      conversationId = get().newConversation();
    }

    const conversation = get().conversations.find((c) => c.id === conversationId);
    if (!conversation) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: question,
      timestamp: Date.now(),
    };

    // Create placeholder assistant message
    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      streaming: true,
    };

    // Update title from first message
    const title = conversation.messages.length === 0
      ? question.slice(0, 50) + (question.length > 50 ? "…" : "")
      : conversation.title;

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              title,
              messages: [...c.messages, userMessage, assistantMessage],
              updatedAt: Date.now(),
            }
          : c,
      ),
      isStreaming: true,
      error: null,
    }));

    // Build request
    const history = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const request: ChatRequest = {
      question,
      language,
      context,
      filename,
      selection,
      cursorPosition,
      providerId: state.selectedProviderId ?? undefined,
      modelId: state.selectedModelId ?? undefined,
      history,
    };

    const abortController = new AbortController();
    set({ abortController });

    try {
      await streamChat(
        state.baseUrl,
        request,
        (chunk: ChatStreamChunk) => {
          if (chunk.error) {
            set((s) => ({
              conversations: s.conversations.map((c) =>
                c.id === conversationId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessage.id
                          ? { ...m, error: chunk.error, streaming: false }
                          : m,
                      ),
                    }
                  : c,
              ),
              isStreaming: false,
              abortController: null,
            }));
            return;
          }

          if (chunk.done) {
            // Finalize: extract code blocks, mark as not streaming
            const conv = get().conversations.find((c) => c.id === conversationId);
            const msg = conv?.messages.find((m) => m.id === assistantMessage.id);
            const finalContent = msg?.content ?? "";
            const codeBlocks: CodeBlock[] = extractCodeBlocks(finalContent).map((b) => ({
              ...b,
              accepted: undefined,
            }));

            set((s) => ({
              conversations: s.conversations.map((c) =>
                c.id === conversationId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessage.id
                          ? {
                              ...m,
                              streaming: false,
                              codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
                              model: chunk.model ?? m.model,
                            }
                          : m,
                      ),
                      updatedAt: Date.now(),
                    }
                  : c,
              ),
              isStreaming: false,
              abortController: null,
            }));
            // Persist completed conversation
            const { hostId: h, filename: f } = get();
            const updated = get().conversations.find((c) => c.id === conversationId);
            if (updated && h && f) persistNow(updated, h, f);
            return;
          }

          if (chunk.content) {
            set((s) => ({
              conversations: s.conversations.map((c) =>
                c.id === conversationId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessage.id
                          ? {
                              ...m,
                              content: m.content + chunk.content,
                              model: chunk.model ?? m.model,
                            }
                          : m,
                      ),
                    }
                  : c,
              ),
            }));
            // Debounced persist during streaming
            const { hostId: h2, filename: f2 } = get();
            const streaming = get().conversations.find((c) => c.id === conversationId);
            if (streaming && h2 && f2) debouncedPersist(streaming, h2, f2, 2000);
          }
        },
        abortController.signal,
        state.hostId || undefined,
      );
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // User cancelled — just mark as done
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, streaming: false }
                      : m,
                  ),
                }
              : c,
          ),
          isStreaming: false,
          abortController: null,
        }));
      } else {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, error: err?.message ?? "Request failed", streaming: false }
                      : m,
                  ),
                }
              : c,
          ),
          isStreaming: false,
          abortController: null,
          error: err?.message ?? "Request failed",
        }));
      }
      // Persist after error / abort
      const { hostId: eh, filename: ef } = get();
      const errConv = get().conversations.find((c) => c.id === conversationId);
      if (errConv && eh && ef) persistNow(errConv, eh, ef);
    }
  },

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isStreaming: false });
    }
  },

  clearConversation: (id) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, messages: [], updatedAt: Date.now() } : c,
      ),
    }));
    const { hostId, filename } = get();
    const conv = get().conversations.find((c) => c.id === id);
    if (conv && hostId && filename) persistNow(conv, hostId, filename);
  },

  deleteConversation: (id) => {
    set((s) => {
      const remaining = s.conversations.filter((c) => c.id !== id);
      return {
        conversations: remaining,
        activeConversationId:
          s.activeConversationId === id
            ? remaining[0]?.id ?? null
            : s.activeConversationId,
      };
    });
    deleteStoredConversation(id).catch(() => {});
  },

  setCodeBlockAccepted: (messageId, blockIndex, accepted) => {
    set((s) => ({
      conversations: s.conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) => {
          if (m.id !== messageId || !m.codeBlocks) return m;
          const blocks = [...m.codeBlocks];
          if (blocks[blockIndex]) {
            blocks[blockIndex] = { ...blocks[blockIndex], accepted };
          }
          return { ...m, codeBlocks: blocks };
        }),
      })),
    }));
    // Persist the conversation that owns this message
    const { hostId, filename, conversations } = get();
    if (hostId && filename) {
      const conv = conversations.find((c) =>
        c.messages.some((m) => m.id === messageId),
      );
      if (conv) debouncedPersist(conv, hostId, filename);
    }
  },

  clearError: () => set({ error: null }),

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  },

  getMessages: () => {
    const conv = get().getActiveConversation();
    return conv?.messages ?? [];
  },
}));
