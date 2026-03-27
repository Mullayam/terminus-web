import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Copy,
  Loader2,
  Play,
  ClipboardPaste,
  Send,
  Sparkles,
  StopCircle,
  Trash2,
  X,
  ChevronsUpDown,
} from 'lucide-react';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { useAIChatStore, type AIChatMessage, getModelOptions, getDefaultModel } from '@/store/aiChatStore';
import { useSSHStore } from '@/store/sshStore';
import { useAIChat, extractCommands } from './useAIChat';
import { SocketEventConstants } from '@/lib/sockets/event-constants';

interface AIChatPanelProps {
  sessionId: string;
}

// ────────────────────────────────────────────────────
// Simple markdown-like renderer for code blocks
// ────────────────────────────────────────────────────
function renderContent(
  text: string,
  colors: Record<string, string>,
  onExecute: (cmd: string) => void,
  onPaste: (cmd: string) => void,
) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    const codeMatch = part.match(/^```(?:\w*)\n?([\s\S]*?)```$/);
    if (codeMatch) {
      const code = codeMatch[1].trim();
      return (
        <div
          key={i}
          className="my-2 rounded-md overflow-hidden border"
          style={{ borderColor: `${colors.foreground}15` }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5 text-[10px]"
            style={{ backgroundColor: `${colors.foreground}08`, color: `${colors.foreground}60` }}
          >
            <span>command</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Copy"
              >
                <Copy size={11} />
              </button>
              <button
                onClick={() => onPaste(code)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Paste in terminal"
              >
                <ClipboardPaste size={11} />
              </button>
              <button
                onClick={() => onExecute(code)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Execute in terminal"
              >
                <Play size={11} />
              </button>
            </div>
          </div>
          <pre
            className="px-3 py-2 text-xs font-mono overflow-x-auto"
            style={{ backgroundColor: `${colors.foreground}05`, color: colors.green }}
          >
            {code}
          </pre>
        </div>
      );
    }
    // Regular text — preserve newlines
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part}
      </span>
    );
  });
}

// ────────────────────────────────────────────────────
// Single message bubble
// ────────────────────────────────────────────────────
function MessageBubble({
  msg,
  colors,
  isLoading,
  onExecute,
  onPaste,
}: {
  msg: AIChatMessage;
  colors: Record<string, string>;
  isLoading: boolean;
  onExecute: (cmd: string) => void;
  onPaste: (cmd: string) => void;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      {!isUser && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2"
          style={{ backgroundColor: `${colors.cyan}20` }}
        >
          <Sparkles size={12} style={{ color: colors.cyan }} />
        </div>
      )}
      <div
        className={`max-w-[88%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
          isUser ? '' : ''
        }`}
        style={
          isUser
            ? { backgroundColor: `${colors.blue}30`, color: colors.foreground }
            : { backgroundColor: `${colors.foreground}08`, color: `${colors.foreground}dd` }
        }
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : msg.content ? (
          renderContent(msg.content, colors, onExecute, onPaste)
        ) : isLoading ? (
          <span className="flex items-center gap-1.5" style={{ color: `${colors.foreground}50` }}>
            <Loader2 size={12} className="animate-spin" />
            Thinking...
          </span>
        ) : null}

        {/* Quick action buttons for commands */}
        {!isUser && msg.commands && msg.commands.length > 0 && (
          <div
            className="mt-2 pt-2 flex flex-wrap gap-1.5 border-t"
            style={{ borderColor: `${colors.foreground}10` }}
          >
            {msg.commands.map((cmd, i) => (
              <div key={i} className="flex items-center gap-0.5">
                <button
                  onClick={() => onExecute(cmd)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:brightness-125"
                  style={{
                    backgroundColor: `${colors.green}18`,
                    color: colors.green,
                  }}
                  title={`Execute: ${cmd}`}
                >
                  <Play size={10} />
                  Run
                </button>
                <button
                  onClick={() => onPaste(cmd)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:brightness-125"
                  style={{
                    backgroundColor: `${colors.yellow}18`,
                    color: colors.yellow,
                  }}
                  title={`Paste: ${cmd}`}
                >
                  <ClipboardPaste size={10} />
                  Paste
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Main AI Chat Panel
// ────────────────────────────────────────────────────
const EMPTY_MESSAGES: AIChatMessage[] = [];

export default function AIChatPanel({ sessionId }: AIChatPanelProps) {
  const { colors } = useSessionTheme();
  const isOpen = useAIChatStore((s) => s.isOpen);
  const close = useAIChatStore((s) => s.close);
  const messages = useAIChatStore(
    (s) => s.sessions[sessionId]?.messages ?? EMPTY_MESSAGES,
  );
  const loading = useAIChatStore((s) => !!s.loading[sessionId]);
  const selection = useAIChatStore((s) => s.terminalSelection[sessionId] ?? '');
  const screenContent = useAIChatStore((s) => s.terminalContent[sessionId] ?? '');
  const clearSession = useAIChatStore((s) => s.clearSession);
  const setTerminalSelection = useAIChatStore((s) => s.setTerminalSelection);
  const providers = useAIChatStore((s) => s.providers);
  const providersFetched = useAIChatStore((s) => s.providersFetched);
  const fetchProviders = useAIChatStore((s) => s.fetchProviders);
  const modelOptions = useMemo(() => getModelOptions(providers), [providers]);
  const defaultModel = useMemo(() => getDefaultModel(providers), [providers]);
  const selectedModel = useAIChatStore(
    (s) => s.selectedModel[sessionId] ?? defaultModel,
  );
  const setSelectedModel = useAIChatStore((s) => s.setSelectedModel);

  // Fetch providers on mount
  useEffect(() => {
    if (!providersFetched) fetchProviders();
  }, [providersFetched, fetchProviders]);

  const { sendMessage, abort } = useAIChat(sessionId);
  const session = useSSHStore((s) => s.sessions[sessionId]);
  const socket = session?.socket;

  const [input, setInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleExecute = useCallback(
    (cmd: string) => {
      if (socket) {
        // Send command + newline to execute
        socket.emit(SocketEventConstants.SSH_EMIT_INPUT, cmd + '\r');
      }
    },
    [socket],
  );

  const handlePaste = useCallback(
    (cmd: string) => {
      if (socket) {
        // Paste without executing (no newline)
        socket.emit(SocketEventConstants.SSH_EMIT_INPUT, cmd);
      }
    },
    [socket],
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const sel = selection || undefined;
    setInput('');
    // Clear selection after using it
    if (sel) setTerminalSelection(sessionId, '');
    sendMessage(trimmed, sel);
  }, [input, loading, selection, sessionId, sendMessage, setTerminalSelection]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed right-0 top-14 bottom-12 z-30 flex flex-col transition-all duration-300 ease-out animate-in slide-in-from-right themed-scrollbar"
      style={{
        width: '400px',
        backgroundColor: colors.background,
        borderLeftWidth: 1,
        borderLeftColor: `${colors.foreground}15`,
        boxShadow: `-4px 0 24px ${colors.background}80`,
        '--sb-thumb': `${colors.foreground}30`,
        '--sb-thumb-hover': `${colors.foreground}50`,
        '--sb-track': `${colors.foreground}08`,
      } as React.CSSProperties}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
        style={{ borderColor: `${colors.foreground}12` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${colors.cyan}30, ${colors.blue}30)` }}
          >
            <Bot size={14} style={{ color: colors.cyan }} />
          </div>
          <div>
            <span className="text-sm font-medium" style={{ color: colors.foreground }}>
              AI Assistant
            </span>
            <span
              className="block text-[10px] leading-tight"
              style={{ color: `${colors.foreground}50` }}
            >
              Terminal • {sessionId.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Model selector */}
        <div className="relative">
          <button
            onClick={() => setShowModelPicker((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:brightness-125"
            style={{
              backgroundColor: `${colors.foreground}10`,
              color: `${colors.foreground}70`,
              border: `1px solid ${colors.foreground}15`,
            }}
            title="Select AI model"
          >
            <span className="max-w-[90px] truncate">{selectedModel?.label ?? 'No model'}</span>
            <ChevronsUpDown size={10} />
          </button>
          {showModelPicker && (
            <div
              className="absolute right-0 top-full mt-1 z-50 rounded-lg border py-1 shadow-xl min-w-[180px] max-h-[300px] overflow-y-auto"
              style={{
                backgroundColor: colors.background,
                borderColor: `${colors.foreground}20`,
              }}
            >
              {providers.filter((p) => p.available).map((provider) => (
                <div key={provider.id}>
                  <div
                    className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: `${colors.foreground}40` }}
                  >
                    {provider.name}
                  </div>
                  {provider.models.map((model) => (
                    <button
                      key={`${provider.id}-${model.id}`}
                      onClick={() => {
                        setSelectedModel(sessionId, {
                          providerId: provider.id,
                          modelId: model.id,
                          label: model.name,
                        });
                        setShowModelPicker(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:brightness-125 flex items-center justify-between"
                      style={{
                        color:
                          selectedModel?.modelId === model.id && selectedModel?.providerId === provider.id
                            ? colors.cyan
                            : `${colors.foreground}80`,
                        backgroundColor:
                          selectedModel?.modelId === model.id && selectedModel?.providerId === provider.id
                            ? `${colors.cyan}10`
                            : 'transparent',
                      }}
                    >
                      <span>{model.name}</span>
                    </button>
                  ))}
                </div>
              ))}
              {modelOptions.length === 0 && (
                <div className="px-3 py-2 text-[11px]" style={{ color: `${colors.foreground}40` }}>
                  No models available
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => clearSession(sessionId)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Clear chat"
          >
            <Trash2 size={13} style={{ color: `${colors.foreground}60` }} />
          </button>
          <button
            onClick={close}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={14} style={{ color: `${colors.foreground}60` }} />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-full gap-3"
            style={{ color: `${colors.foreground}35` }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${colors.cyan}15, ${colors.blue}15)` }}
            >
              <Sparkles size={20} style={{ color: `${colors.cyan}60` }} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-medium" style={{ color: `${colors.foreground}50` }}>
                AI Terminal Assistant
              </p>
              <p className="text-[11px]" style={{ color: `${colors.foreground}30` }}>
                Ask anything about your terminal session.
                <br />
                Select text in terminal for context.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-xs">
              {[
                'Explain the last error',
                'How to find large files?',
                'Fix permission denied',
                'Show disk usage',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  className="px-2.5 py-2 rounded-lg text-[10px] text-left transition-colors hover:brightness-125"
                  style={{
                    backgroundColor: `${colors.foreground}08`,
                    color: `${colors.foreground}60`,
                    border: `1px solid ${colors.foreground}10`,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            colors={colors as Record<string, string>}
            isLoading={loading}
            onExecute={handleExecute}
            onPaste={handlePaste}
          />
        ))}
        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex items-center gap-2" style={{ color: `${colors.foreground}50` }}>
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Thinking...</span>
          </div>
        )}
      </div>

      {/* ── Scroll to bottom ── */}
      <ScrollToBottom scrollRef={scrollRef} colors={colors as Record<string, string>} />

      {/* ── Context badge ── */}
      {selection ? (
        <div
          className="mx-4 mb-1 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px]"
          style={{
            backgroundColor: `${colors.yellow}12`,
            color: colors.yellow,
            border: `1px solid ${colors.yellow}25`,
          }}
        >
          <span className="flex-1 truncate">
            📎 Selection attached ({selection.length} chars)
          </span>
          <button
            onClick={() => setTerminalSelection(sessionId, '')}
            className="p-0.5 rounded hover:bg-white/10"
          >
            <X size={10} />
          </button>
        </div>
      ) : screenContent ? (
        <div
          className="mx-4 mb-1 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px]"
          style={{
            backgroundColor: `${colors.cyan}12`,
            color: colors.cyan,
            border: `1px solid ${colors.cyan}25`,
          }}
        >
          <span className="flex-1 truncate">
            🖥 Full screen context ({screenContent.length} chars)
          </span>
        </div>
      ) : null}

      {/* ── Input ── */}
      <div
        className="px-4 py-3 border-t shrink-0"
        style={{ borderColor: `${colors.foreground}12` }}
      >
        <div
          className="flex items-end gap-2 rounded-lg border px-3 py-2"
          style={{
            borderColor: `${colors.foreground}20`,
            backgroundColor: `${colors.foreground}05`,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your terminal..."
            rows={1}
            className="flex-1 bg-transparent text-xs resize-none outline-none max-h-28 min-h-[20px] themed-scrollbar"
            style={{
              color: colors.foreground,
              '--sb-thumb': `${colors.foreground}30`,
              '--sb-thumb-hover': `${colors.foreground}50`,
              '--sb-track': `${colors.foreground}08`,
            } as React.CSSProperties}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 112)}px`;
            }}
          />
          {loading ? (
            <button
              onClick={abort}
              className="p-1.5 rounded transition-colors hover:bg-white/10 shrink-0"
              title="Stop generating"
            >
              <StopCircle size={16} style={{ color: colors.red }} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-1.5 rounded transition-colors hover:bg-white/10 shrink-0 disabled:opacity-30"
              title="Send (Enter)"
            >
              <Send size={16} style={{ color: input.trim() ? colors.cyan : `${colors.foreground}30` }} />
            </button>
          )}
        </div>
        <p
          className="text-[9px] mt-1.5 text-center"
          style={{ color: `${colors.foreground}25` }}
        >
          Shift+Enter for new line • {selectedModel?.label ?? 'No model'} ({selectedModel?.providerId ?? ''})
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Scroll-to-bottom fab
// ────────────────────────────────────────────────────
function ScrollToBottom({
  scrollRef,
  colors,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  colors: Record<string, string>;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShow(distanceFromBottom > 100);
    };
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, [scrollRef]);

  if (!show) return null;

  return (
    <button
      onClick={() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      }
      className="absolute bottom-24 right-4 p-1.5 rounded-full shadow-lg transition-all hover:scale-110"
      style={{
        backgroundColor: colors.background,
        border: `1px solid ${colors.foreground}20`,
        color: `${colors.foreground}60`,
      }}
    >
      <ChevronDown size={14} />
    </button>
  );
}
