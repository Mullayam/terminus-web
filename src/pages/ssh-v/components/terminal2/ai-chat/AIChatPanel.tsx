import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Copy,
  Loader2,
  Play,
  ClipboardPaste,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Square,
  StopCircle,
  Trash2,
  X,
  ChevronsUpDown,
} from 'lucide-react';
import stripAnsi from 'strip-ansi';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { useAIChatStore, type AIChatMessage, type AgentStatus, type AgentAction, getModelOptions, getDefaultModel } from '@/store/aiChatStore';
import { useSSHStore } from '@/store/sshStore';
import { useAIChat, extractCommands } from './useAIChat';
import { useAgentExecutor, requestNotificationPermission } from './useAgentExecutor';
import { SocketEventConstants } from '@/lib/sockets/event-constants';

interface AIChatPanelProps {
  sessionId: string;
}

// ────────────────────────────────────────────────────
// Lightweight inline markdown renderer (no deps)
// Handles: **bold**, *italic*, `code`, [links](url),
//          headers (##), bullet/numbered lists, ---
// ────────────────────────────────────────────────────
function renderMarkdownLine(line: string, colors: Record<string, string>, keyBase: string) {
  // Split by inline patterns, preserving delimiters
  const tokens: React.ReactNode[] = [];
  // Process inline formatting: bold, italic, inline code, links
  const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(line)) !== null) {
    // Push text before this match
    if (match.index > lastIndex) {
      tokens.push(line.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      tokens.push(<strong key={`${keyBase}-b-${match.index}`} style={{ color: colors.foreground, fontWeight: 600 }}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      tokens.push(<em key={`${keyBase}-i-${match.index}`} style={{ opacity: 0.9 }}>{match[3]}</em>);
    } else if (match[4]) {
      // `inline code`
      tokens.push(
        <code
          key={`${keyBase}-c-${match.index}`}
          className="px-1 py-0.5 rounded text-[10px] font-mono"
          style={{ backgroundColor: `${colors.foreground}12`, color: colors.cyan }}
        >
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
      // [text](url)
      tokens.push(
        <a
          key={`${keyBase}-a-${match.index}`}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:brightness-125"
          style={{ color: colors.blue }}
        >
          {match[5]}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  // Remaining text
  if (lastIndex < line.length) {
    tokens.push(line.slice(lastIndex));
  }
  return tokens.length > 0 ? tokens : [line];
}

function renderMarkdownBlock(text: string, colors: Record<string, string>, keyPrefix: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.type === 'ol' ? 'ol' : 'ul';
    elements.push(
      <Tag
        key={`${keyPrefix}-list-${elements.length}`}
        className={`text-[11px] leading-relaxed pl-4 my-1 ${listBuffer.type === 'ol' ? 'list-decimal' : 'list-disc'}`}
        style={{ color: `${colors.foreground}cc` }}
      >
        {listBuffer.items.map((item, li) => (
          <li key={li} className="py-0.5">{item}</li>
        ))}
      </Tag>,
    );
    listBuffer = null;
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      flushList();
      elements.push(
        <hr key={`${keyPrefix}-hr-${li}`} className="my-2 border-t" style={{ borderColor: `${colors.foreground}15` }} />,
      );
      continue;
    }

    // Headers (h1–h4)
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const sizes = ['text-sm font-bold', 'text-xs font-bold', 'text-xs font-semibold', 'text-[11px] font-semibold'];
      elements.push(
        <div
          key={`${keyPrefix}-h-${li}`}
          className={`${sizes[level - 1] ?? sizes[3]} mt-2 mb-1`}
          style={{ color: colors.foreground }}
        >
          {renderMarkdownLine(headerMatch[2], colors, `${keyPrefix}-h-${li}`)}
        </div>,
      );
      continue;
    }

    // Unordered list item (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(renderMarkdownLine(ulMatch[1], colors, `${keyPrefix}-ul-${li}`));
      continue;
    }

    // Ordered list item (1. 2. etc)
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(renderMarkdownLine(olMatch[1], colors, `${keyPrefix}-ol-${li}`));
      continue;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`${keyPrefix}-br-${li}`} className="h-1.5" />);
      continue;
    }

    // Regular paragraph line
    flushList();
    elements.push(
      <span key={`${keyPrefix}-p-${li}`} className="block text-[11px] leading-relaxed">
        {renderMarkdownLine(trimmed, colors, `${keyPrefix}-p-${li}`)}
      </span>,
    );
  }
  flushList();
  return elements;
}

// ────────────────────────────────────────────────────
// Strip agent control tokens from displayed text
// ────────────────────────────────────────────────────
const AGENT_TOKENS = /\[TASK_COMPLETE\]|\[TASK_BLOCKED\]|\[STILL_TO_DO\]/g;
function cleanAgentTokens(text: string): string {
  return text.replace(AGENT_TOKENS, '').trim();
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
  text = cleanAgentTokens(text);
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
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 border-t"
            style={{ borderColor: `${colors.foreground}10`, backgroundColor: `${colors.foreground}05` }}
          >
            <button
              onClick={() => onExecute(code)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:brightness-125"
              style={{ backgroundColor: `${colors.green}18`, color: colors.green }}
              title="Execute in terminal"
            >
              <Play size={10} />
              Run
            </button>
            <button
              onClick={() => onPaste(code)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:brightness-125"
              style={{ backgroundColor: `${colors.yellow}18`, color: colors.yellow }}
              title="Paste in terminal"
            >
              <ClipboardPaste size={10} />
              Paste
            </button>
          </div>
        </div>
      );
    }
    // Markdown text between code blocks
    return (
      <span key={i}>
        {renderMarkdownBlock(part, colors, `md-${i}`)}
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
        className={`max-w-[96%] rounded-lg px-3 py-2 text-xs leading-relaxed overflow-hidden break-words ${
          isUser ? '' : ''
        }`}
        style={
          isUser
            ? { backgroundColor: `${colors.blue}30`, color: colors.foreground }
            : { backgroundColor: `${colors.foreground}08`, color: `${colors.foreground}dd` }
        }
      >
        {isUser ? (
          msg.content ? renderContent(stripAnsi(msg.content), colors, onExecute, onPaste) : null
        ) : msg.content ? (
          renderContent(stripAnsi(msg.content), colors, onExecute, onPaste)
        ) : isLoading ? (
          <span className="flex items-center gap-1.5" style={{ color: `${colors.foreground}50` }}>
            <Loader2 size={12} className="animate-spin" />
            Thinking...
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Agent status bubble (inline in chat) — single step row
// ────────────────────────────────────────────────────
const AGENT_ICONS: Record<AgentAction, { icon: typeof Play; color: string; spin?: boolean }> = {
  executing: { icon: Loader2, color: 'cyan', spin: true },
  waiting: { icon: Loader2, color: 'yellow', spin: true },
  success: { icon: ShieldCheck, color: 'green' },
  error: { icon: ShieldOff, color: 'red' },
  replanning: { icon: RefreshCw, color: 'yellow', spin: true },
  blocked: { icon: ShieldOff, color: 'red' },
  stopped: { icon: Square, color: 'foreground' },
  info: { icon: Shield, color: 'cyan' },
};

/** A single agent step — shown inside the accordion */
function AgentStepRow({
  msg,
  colors,
}: {
  msg: AIChatMessage;
  colors: Record<string, string>;
}) {
  const action = msg.agentAction ?? 'info';
  const iconDef = AGENT_ICONS[action] ?? AGENT_ICONS.info;
  const IconComp = iconDef.icon;
  const iconColor = colors[iconDef.color] ?? `${colors.foreground}80`;
  const [detailOpen, setDetailOpen] = useState(false);
  const hasDetail = !!(msg.agentCommand || msg.agentOutput);

  return (
    <div className="py-1">
      <button
        onClick={() => hasDetail && setDetailOpen((v) => !v)}
        className={`flex items-center gap-2 w-full text-left text-[10px] px-2 py-1 rounded transition-colors ${hasDetail ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'}`}
        style={{ color: iconColor }}
      >
        <IconComp
          size={10}
          className={iconDef.spin ? 'animate-spin' : ''}
          style={{ color: iconColor }}
        />
        <span className="flex-1 truncate" style={{ color: `${colors.foreground}bb` }}>
          {msg.agentStep ? `Step ${msg.agentStep}: ` : ''}{stripAnsi(msg.content ?? '')}
        </span>
        {hasDetail && (
          <ChevronDown
            size={10}
            className={`shrink-0 transition-transform ${detailOpen ? 'rotate-0' : '-rotate-90'}`}
            style={{ color: `${colors.foreground}40` }}
          />
        )}
      </button>
      {detailOpen && (
        <div className="ml-6 mt-1 space-y-1">
          {msg.agentCommand && (
            <pre
              className="px-2 py-1 rounded text-[10px] font-mono overflow-x-auto"
              style={{
                backgroundColor: `${colors.foreground}06`,
                color: colors.green ?? colors.foreground,
                border: `1px solid ${colors.foreground}10`,
              }}
            >
              $ {stripAnsi(msg.agentCommand)}
            </pre>
          )}
          {msg.agentOutput && (
            <pre
              className="px-2 py-1 rounded text-[10px] font-mono overflow-x-auto max-h-32 overflow-y-auto"
              style={{
                backgroundColor: `${colors.foreground}06`,
                color: `${colors.foreground}80`,
                border: `1px solid ${colors.foreground}10`,
              }}
            >
              {stripAnsi(msg.agentOutput)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/** Accordion that groups consecutive agent messages */
function AgentAccordion({
  agentMessages,
  colors,
}: {
  agentMessages: AIChatMessage[];
  colors: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (agentMessages.length === 0) return null;

  // Determine overall status from the last message
  const last = agentMessages[agentMessages.length - 1];
  const lastAction = last.agentAction ?? 'info';
  const isRunning = lastAction === 'executing' || lastAction === 'waiting' || lastAction === 'replanning';
  const isDone = lastAction === 'success';
  const isError = lastAction === 'error' || lastAction === 'blocked';
  const isStopped = lastAction === 'stopped';

  const accentColor = isRunning
    ? colors.cyan
    : isDone
      ? colors.green
      : isError
        ? colors.red
        : isStopped
          ? `${colors.foreground}60`
          : `${colors.foreground}80`;

  // Summary label
  const totalSteps = agentMessages.filter((m) => m.agentCommand).length;
  const label = isRunning
    ? `Agent working — step ${last.agentStep ?? '?'}`
    : isDone
      ? `Agent completed — ${totalSteps} command${totalSteps !== 1 ? 's' : ''} executed`
      : isError
        ? `Agent error at step ${last.agentStep ?? '?'}`
        : isStopped
          ? 'Agent stopped by user'
          : `Agent — ${agentMessages.length} step${agentMessages.length !== 1 ? 's' : ''}`;

  return (
    <div
      className="rounded-lg overflow-hidden text-xs"
      style={{
        backgroundColor: `${accentColor}06`,
        border: `1px solid ${accentColor}18`,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors hover:bg-white/5"
        style={{ color: accentColor }}
      >
        {isRunning ? (
          <Loader2 size={12} className="animate-spin shrink-0" />
        ) : isDone ? (
          <ShieldCheck size={12} className="shrink-0" />
        ) : isError ? (
          <ShieldOff size={12} className="shrink-0" />
        ) : isStopped ? (
          <Square size={12} className="shrink-0" />
        ) : (
          <Shield size={12} className="shrink-0" />
        )}
        <span className="flex-1 text-[11px] font-medium truncate">{label}</span>
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
          style={{ color: `${colors.foreground}40` }}
        />
      </button>
      {expanded && (
        <div
          className="px-2 pb-2 border-t"
          style={{ borderColor: `${accentColor}15` }}
        >
          {agentMessages.map((msg) => (
            <AgentStepRow key={msg.id} msg={msg} colors={colors} />
          ))}
        </div>
      )}
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
  const providersFetching = useAIChatStore((s) => s.providersFetching);
  const fetchProviders = useAIChatStore((s) => s.fetchProviders);
  const modelOptions = useMemo(() => getModelOptions(providers), [providers]);
  const defaultModel = useMemo(() => getDefaultModel(providers), [providers]);
  const selectedModel = useAIChatStore(
    (s) => s.selectedModel[sessionId] ?? defaultModel,
  );
  const setSelectedModel = useAIChatStore((s) => s.setSelectedModel);

  // Auto-execute state
  const autoExecute = useAIChatStore((s) => !!s.autoExecute[sessionId]);
  const setAutoExecute = useAIChatStore((s) => s.setAutoExecute);
  const agentStatus = useAIChatStore((s) => s.agentStatus[sessionId] as AgentStatus | undefined);
  const { runAgentLoop, runStepByStepLoop, stopAgent } = useAgentExecutor(sessionId);

  const handleToggleAutoExecute = useCallback(() => {
    const next = !autoExecute;
    setAutoExecute(sessionId, next);
    if (next) {
      requestNotificationPermission();
    }
  }, [autoExecute, sessionId, setAutoExecute]);

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
    if (!trimmed) return;
    // Allow sending while agent runs — AI chat handles sequencing.
    // Only block if AI is actively streaming a response right now.
    if (loading && !agentStatus?.running) return;
    const sel = selection || undefined;
    setInput('');
    // Clear selection after using it
    if (sel) setTerminalSelection(sessionId, '');

    // When auto-execute is ON and agent isn't already running,
    // use step-by-step mode so AI plans one command at a time using real output.
    if (autoExecute && !agentStatus?.running) {
      runStepByStepLoop(trimmed);
    } else {
      sendMessage(trimmed, sel);
    }
  }, [input, loading, selection, sessionId, sendMessage, setTerminalSelection, agentStatus?.running, autoExecute, runStepByStepLoop]);

  // Auto-execute fallback: when loading finishes and autoExecute is ON,
  // and the agent ISN'T already running (i.e. a normal AI response with commands),
  // extract commands and run them in batch mode.
  // This handles the case where user toggled auto-execute mid-conversation.
  const prevLoadingRef = useRef(loading);
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;

    // Trigger only when loading transitions from true → false
    if (!wasLoading || loading) return;
    if (!autoExecute) return;
    if (agentStatus?.running) return;

    // Don't trigger if the last message was from the agent loop itself
    // (step-by-step sends its own messages)
    const state = useAIChatStore.getState();
    const session = state.sessions[sessionId];
    if (!session) return;
    const msgs = session.messages;
    // Check if any recent agent message exists — means step-by-step is handling it
    const recentAgent = msgs.slice(-5).some((m) => m.role === 'agent');
    if (recentAgent) return;

    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    const cmds = extractCommands(lastMsg.content);
    if (cmds.length > 0) {
      runAgentLoop(cmds);
    }
  }, [loading, autoExecute, sessionId, agentStatus?.running, runAgentLoop]);

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
      className="fixed right-0 top-14 bottom-12 z-30 flex flex-col overflow-hidden transition-all duration-300 ease-out animate-in slide-in-from-right themed-scrollbar"
      style={{
        width: '500px',
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
        <div className="relative flex items-center gap-1">
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
          <button
            onClick={() => fetchProviders()}
            disabled={providersFetching}
            className="p-1 rounded transition-colors hover:bg-white/10 disabled:opacity-30"
            title="Refresh providers"
          >
            <RefreshCw size={12} className={providersFetching ? 'animate-spin' : ''} style={{ color: `${colors.foreground}60` }} />
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
          {/* Auto-allow toggle — like VS Code Copilot's shield button */}
          <button
            onClick={handleToggleAutoExecute}
            className="p-1.5 rounded transition-colors hover:bg-white/10 relative group"
            title={autoExecute
              ? 'Auto-execute ON — AI will run commands automatically this session'
              : 'Auto-execute OFF — Click to allow AI to run commands automatically'}
          >
            {autoExecute ? (
              <ShieldCheck size={13} style={{ color: colors.green }} />
            ) : (
              <Shield size={13} style={{ color: `${colors.foreground}60` }} />
            )}
            {autoExecute && (
              <span
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: colors.green }}
              />
            )}
          </button>
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

      {/* ── Auto-execute status banner ── */}
      {autoExecute && (
        <div
          className="px-4 py-1.5 flex items-center gap-2 text-[10px] border-b shrink-0"
          style={{
            borderColor: `${colors.foreground}12`,
            backgroundColor: agentStatus?.running
              ? `${colors.yellow}10`
              : `${colors.green}08`,
            color: agentStatus?.running ? colors.yellow : colors.green,
          }}
        >
          {agentStatus?.running ? (
            <>
              <Loader2 size={10} className="animate-spin" />
              <span className="flex-1 truncate">
                Agent step {agentStatus.step}: {agentStatus.action}
              </span>
              <button
                onClick={stopAgent}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors hover:brightness-125"
                style={{ backgroundColor: `${colors.red}20`, color: colors.red }}
                title="Stop agent"
              >
                <Square size={8} />
                Stop
              </button>
            </>
          ) : (
            <>
              <ShieldCheck size={10} />
              <span className="flex-1">Auto-execute enabled for this session</span>
              <button
                onClick={handleToggleAutoExecute}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors hover:brightness-125"
                style={{ backgroundColor: `${colors.foreground}15`, color: `${colors.foreground}70` }}
              >
                <ShieldOff size={8} />
                Disable
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3"
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
        {(() => {
          // Group consecutive agent messages into accordions
          const elements: React.ReactNode[] = [];
          let agentBuffer: AIChatMessage[] = [];

          const flushAgents = () => {
            if (agentBuffer.length > 0) {
              elements.push(
                <AgentAccordion
                  key={`agent-group-${agentBuffer[0].id}`}
                  agentMessages={agentBuffer}
                  colors={colors as Record<string, string>}
                />,
              );
              agentBuffer = [];
            }
          };

          for (const msg of messages) {
            if (msg.role === 'agent') {
              agentBuffer.push(msg);
            } else {
              flushAgents();
              elements.push(
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  colors={colors as Record<string, string>}
                  isLoading={loading}
                  onExecute={handleExecute}
                  onPaste={handlePaste}
                />,
              );
            }
          }
          flushAgents();
          return elements;
        })()}
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
        {/* Agent task-in-progress badge above input */}
        {agentStatus?.running && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-[10px]"
            style={{
              backgroundColor: `${colors.yellow}10`,
              color: colors.yellow,
              border: `1px solid ${colors.yellow}20`,
            }}
          >
            <Loader2 size={10} className="animate-spin shrink-0" />
            <span className="flex-1 truncate">
              Step {agentStatus.step}: {agentStatus.action}
            </span>
            <button
              onClick={stopAgent}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] transition-colors hover:brightness-125 shrink-0"
              style={{ backgroundColor: `${colors.red}20`, color: colors.red }}
              title="Stop agent"
            >
              <Square size={8} />
              Stop
            </button>
          </div>
        )}
        <div
          className="flex items-end gap-2 rounded-lg border px-3 py-2 transition-colors"
          style={{
            borderColor: agentStatus?.running ? `${colors.yellow}40` : `${colors.foreground}20`,
            backgroundColor: `${colors.foreground}05`,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={agentStatus?.running
              ? 'Agent is working… type to send a follow-up'
              : loading
                ? 'AI is responding…'
                : 'Ask about your terminal...'}
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
            onPaste={() => {
              // After paste content is applied, recalc height on next tick
              requestAnimationFrame(() => {
                const t = inputRef.current;
                if (t) {
                  t.style.height = 'auto';
                  t.style.height = `${Math.min(t.scrollHeight, 112)}px`;
                }
              });
            }}
          />
          {loading && !agentStatus?.running ? (
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
          {agentStatus?.running
            ? 'Agent auto-executing • You can still send messages'
            : `Shift+Enter for new line • ${selectedModel?.label ?? 'No model'} (${selectedModel?.providerId ?? ''})`}
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
