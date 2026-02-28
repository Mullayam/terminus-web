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

/* ── Helpers ───────────────────────────────────────────────── */

let _msgCounter = 0;
function generateId(): string {
  return `msg-${Date.now()}-${++_msgCounter}`;
}

function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  /** Error message (if any) */
  error: string | null;

  /* ── Actions ───────────────────────────────────────────── */

  /** Set the base URL for API calls */
  setBaseUrl: (url: string) => void;
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
  error: null,

  setBaseUrl: (url) => set({ baseUrl: url }),

  loadProviders: async () => {
    const { baseUrl } = get();
    if (!baseUrl) return;

    set({ loadingProviders: true, error: null });
    try {
      const providers = await fetchProviders(baseUrl);
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
          }
        },
        abortController.signal,
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
