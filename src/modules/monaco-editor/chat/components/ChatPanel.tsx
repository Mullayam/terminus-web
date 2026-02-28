/**
 * @module monaco-editor/chat/components/ChatPanel
 *
 * Main AI Chat panel component for the editor sidebar.
 *
 * Features:
 * - Provider / model selector
 * - Conversation list
 * - Message input with send / stop
 * - Streaming response display
 * - Code block apply/reject with diff preview
 * - Keyboard shortcut: Enter to send, Shift+Enter for newline
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  Square,
  Plus,
  Trash2,
  ChevronDown,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Loader2,
  Bot,
} from "lucide-react";
import { useChatStore } from "../store";
import { ChatMessageView } from "./ChatMessage";
import { DiffPreview } from "./DiffPreview";
import type { ChatProvider } from "../types";

/* ── Props ─────────────────────────────────────────────────── */

export interface ChatPanelProps {
  /** Base API URL */
  baseUrl: string;
  /** Current file language */
  language: string;
  /** Current file content */
  fileContent: string;
  /** Current filename */
  filename?: string;
  /** Current selected text */
  selectedText?: string;
  /** Cursor position */
  cursorPosition?: { lineNumber: number; column: number };
  /** Called when user accepts a code change */
  onApplyCode?: (code: string, language: string) => void;
}

/* ── Component ─────────────────────────────────────────────── */

export const ChatPanel: React.FC<ChatPanelProps> = ({
  baseUrl,
  language,
  fileContent,
  filename,
  selectedText,
  cursorPosition,
  onApplyCode,
}) => {
  const [input, setInput] = useState("");
  const [showConversations, setShowConversations] = useState(false);
  const [showDiff, setShowDiff] = useState<{
    original: string;
    modified: string;
    language: string;
    blockIndex: number;
    messageId: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Zustand store
  const {
    providers,
    loadingProviders,
    selectedProviderId,
    selectedModelId,
    conversations,
    activeConversationId,
    isStreaming,
    error,
    setBaseUrl,
    loadProviders,
    selectProvider,
    selectModel,
    newConversation,
    setActiveConversation,
    sendMessage,
    stopStreaming,
    deleteConversation,
    setCodeBlockAccepted,
    clearError,
    getActiveConversation,
    getMessages,
  } = useChatStore();

  // Initialize base URL and load providers
  useEffect(() => {
    setBaseUrl(baseUrl);
    loadProviders();
  }, [baseUrl, setBaseUrl, loadProviders]);

  // Auto-scroll to bottom on new messages
  const messages = getMessages();
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversationId]);

  // Get currently selected provider
  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  // ── Send message ──
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;

    sendMessage({
      question: text,
      language,
      context: fileContent,
      filename,
      selection: selectedText,
      cursorPosition,
    });

    setInput("");
  }, [input, isStreaming, sendMessage, language, fileContent, filename, selectedText, cursorPosition]);

  // ── Handle keydown ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Apply code from code block ──
  const handleApplyCode = useCallback(
    (code: string, codeLang: string, blockIndex: number, messageId: string) => {
      // Show diff preview
      setShowDiff({
        original: fileContent,
        modified: code,
        language: codeLang || language,
        blockIndex,
        messageId,
      });
    },
    [fileContent, language],
  );

  // ── Accept diff ──
  const handleAcceptDiff = useCallback(
    (modifiedContent: string) => {
      if (showDiff) {
        onApplyCode?.(modifiedContent, showDiff.language);
        setCodeBlockAccepted(showDiff.messageId, showDiff.blockIndex, true);
        setShowDiff(null);
      }
    },
    [showDiff, onApplyCode, setCodeBlockAccepted],
  );

  // ── Reject diff ──
  const handleRejectDiff = useCallback(() => {
    if (showDiff) {
      setCodeBlockAccepted(showDiff.messageId, showDiff.blockIndex, false);
      setShowDiff(null);
    }
  }, [showDiff, setCodeBlockAccepted]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header: Provider/Model selector ──────────────── */}
      <div className="px-3 py-2 border-b border-[#3c3c3c] shrink-0">
        {/* Provider selector */}
        {loadingProviders ? (
          <div className="flex items-center gap-2 text-gray-500 text-[11px]">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading providers…
          </div>
        ) : providers.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedProviderId ?? ""}
              onChange={(e) => selectProvider(e.target.value)}
              className="flex-1 bg-[#3c3c3c] text-gray-300 text-[11px] rounded px-2 py-1 border border-[#555] focus:border-[#007acc] focus:outline-none"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.available}>
                  {p.name} {!p.available ? "(unavailable)" : ""}
                </option>
              ))}
            </select>
            {selectedProvider && selectedProvider.models.length > 1 && (
              <select
                value={selectedModelId ?? ""}
                onChange={(e) => selectModel(e.target.value)}
                className="bg-[#3c3c3c] text-gray-300 text-[11px] rounded px-2 py-1 border border-[#555] focus:border-[#007acc] focus:outline-none max-w-[100px]"
              >
                {selectedProvider.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500 text-[11px]">
            <AlertCircle className="w-3 h-3" />
            No AI providers available
          </div>
        )}

        {/* Conversation switcher */}
        <div className="flex items-center gap-1 mt-1.5">
          <button
            onClick={() => setShowConversations((o) => !o)}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            {getActiveConversation()?.title ?? "New Chat"}
            <ChevronDown className={`w-3 h-3 transition-transform ${showConversations ? "rotate-180" : ""}`} />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => newConversation()}
            className="p-0.5 rounded hover:bg-[#404040] text-gray-500 hover:text-gray-300 transition-colors"
            title="New conversation"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Conversations dropdown */}
        {showConversations && conversations.length > 0 && (
          <div className="mt-1 rounded border border-[#3c3c3c] bg-[#1e1e1e] max-h-[120px] overflow-y-auto">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[#2a2d2e] ${
                  conv.id === activeConversationId ? "bg-[#37373d]" : ""
                }`}
              >
                <button
                  className="flex-1 text-left text-[11px] text-gray-300 truncate"
                  onClick={() => {
                    setActiveConversation(conv.id);
                    setShowConversations(false);
                  }}
                >
                  {conv.title}
                </button>
                <button
                  onClick={() => deleteConversation(conv.id)}
                  className="p-0.5 rounded hover:bg-[#404040] text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border-b border-red-500/30 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-[11px] text-red-300 flex-1 truncate">{error}</span>
          <button
            onClick={clearError}
            className="text-[10px] text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Diff preview overlay ─────────────────────────── */}
      {showDiff && (
        <div className="px-2 py-1 border-b border-[#3c3c3c] shrink-0">
          <DiffPreview
            original={showDiff.original}
            modified={showDiff.modified}
            language={showDiff.language}
            filename={filename}
            height={200}
            onAccept={handleAcceptDiff}
            onReject={handleRejectDiff}
          />
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden chat-scroll">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#6a4c93]/20 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-[#6a4c93]" />
            </div>
            <span className="text-[13px] text-gray-400 font-medium mb-1">
              AI Chat
            </span>
            <span className="text-[11px] text-gray-600 max-w-[200px]">
              Ask questions about your code, get explanations, or request changes.
            </span>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageView
              key={msg.id}
              message={msg}
              onApplyCode={
                msg.role === "assistant" && msg.codeBlocks
                  ? (code, lang, blockIdx) =>
                      handleApplyCode(code, lang, blockIdx, msg.id)
                  : undefined
              }
              onRejectCode={
                msg.role === "assistant" && msg.codeBlocks
                  ? (blockIdx) =>
                      setCodeBlockAccepted(msg.id, blockIdx, false)
                  : undefined
              }
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ───────────────────────────────────── */}
      <div className="px-3 py-2 border-t border-[#3c3c3c] shrink-0">
        {selectedText && (
          <div className="flex items-center gap-1 mb-1.5 px-2 py-1 rounded bg-[#007acc]/10 border border-[#007acc]/30">
            <span className="text-[10px] text-[#4fc1ff]">Selection context:</span>
            <span className="text-[10px] text-gray-400 truncate flex-1">
              {selectedText.slice(0, 60)}{selectedText.length > 60 ? "…" : ""}
            </span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              providers.length === 0
                ? "No AI providers configured…"
                : "Ask a question… (Enter to send)"
            }
            disabled={providers.length === 0}
            rows={1}
            className="flex-1 resize-none bg-[#3c3c3c] text-gray-200 text-[12px] rounded-md px-3 py-2 border border-[#555] focus:border-[#007acc] focus:outline-none placeholder-gray-600 min-h-[36px] max-h-[120px] overflow-y-auto"
            style={{
              height: "auto",
              minHeight: "36px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="flex items-center justify-center w-8 h-8 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors shrink-0"
              title="Stop generating"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || providers.length === 0}
              className="flex items-center justify-center w-8 h-8 rounded-md bg-[#007acc] text-white hover:bg-[#0098ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-600">
            Shift+Enter for newline
          </span>
          {filename && (
            <span className="text-[10px] text-gray-600 truncate max-w-[120px]">
              Context: {filename}
            </span>
          )}
        </div>
      </div>

      {/* Scrollbar styling */}
      <style>{`
        .chat-scroll::-webkit-scrollbar { width: 5px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

ChatPanel.displayName = "ChatPanel";
