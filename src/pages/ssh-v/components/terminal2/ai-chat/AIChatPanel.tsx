import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, Shield, ShieldCheck, Trash2, X } from 'lucide-react';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { useAIChatStore, type AIChatMessage, type AgentStatus, getDefaultModel } from '@/store/aiChatStore';
import { useAgentRunStore, DEFAULT_AGENT_CONFIG } from '@/store/agentRunStore';
import { useSSHStore } from '@/store/sshStore';
import { useAIChat, extractCommands } from './useAIChat';
import { useAgentExecutor, requestNotificationPermission } from './useAgentExecutor';
import { useServerAgent } from './useServerAgent';
import { AgentControls, AgentRuns } from './AgentRunPanel';
import { AgentUsagePanel } from './AgentUsagePanel';
import { AutoExecuteBanner } from './AutoExecuteBanner';
import { ChatComposer } from './ChatComposer';
import { ChatEmptyState } from './ChatEmptyState';
import { ContextBadge } from './ContextBadge';
import { MessageList } from './MessageList';
import { ModelPicker } from './ModelPicker';
import { ScrollToBottom } from './ScrollToBottom';
import { SocketEventConstants } from '@/lib/sockets/event-constants';

interface AIChatPanelProps {
  sessionId: string;
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

  // Server-driven agent: the backend proposes commands, this client runs them.
  const agentConfig = useAgentRunStore((s) => s.config[sessionId] ?? DEFAULT_AGENT_CONFIG);
  const setAgentConfig = useAgentRunStore((s) => s.setConfig);
  const clearAgentRuns = useAgentRunStore((s) => s.clearRuns);
  const clearAgentUsage = useAgentRunStore((s) => s.clearUsage);
  const serverAgentRunning = useAgentRunStore((s) =>
    Object.values(s.runs[sessionId] ?? {}).some((r) => r.running),
  );
  // Primitive digest of the server-agent runs so the transcript scrolls as they stream.
  const agentRunTick = useAgentRunStore((s) => {
    const runs = s.runs[sessionId];
    if (!runs) return 0;
    let tick = 0;
    for (const run of Object.values(runs)) {
      tick += run.text.length + run.toolCalls.length + run.planDone + (run.running ? 1 : 0);
    }
    return tick;
  });
  const { run: runServerAgent, stop: stopServerAgent } = useServerAgent(sessionId);

  const handleToggleAgentMode = useCallback(() => {
    const next = !agentConfig.enabled;
    setAgentConfig(sessionId, { enabled: next });
    if (next) requestNotificationPermission();
  }, [agentConfig.enabled, sessionId, setAgentConfig]);

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages — unless the user has scrolled up to read.
  const stickToBottomRef = useRef(true);
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, agentRunTick, loading]);

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

    if (agentConfig.enabled) {
      if (serverAgentRunning) return;
      const { addUserMessage } = useAIChatStore.getState();
      addUserMessage(sessionId, sel ? `Selected:\n\`\`\`\n${sel}\n\`\`\`\n${trimmed}` : trimmed);
      const history = messages
        .filter((m) => m.role !== 'agent')
        .slice(-10)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      runServerAgent(sel ? `${trimmed}\n\nSelected terminal text:\n${sel}` : trimmed, { history });
      return;
    }

    // When auto-execute is ON and agent isn't already running,
    // use step-by-step mode so AI plans one command at a time using real output.
    if (autoExecute && !agentStatus?.running) {
      runStepByStepLoop(trimmed);
    } else {
      sendMessage(trimmed, sel);
    }
  }, [input, loading, selection, sessionId, sendMessage, setTerminalSelection, agentStatus?.running, autoExecute, runStepByStepLoop, agentConfig.enabled, serverAgentRunning, runServerAgent, messages]);

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
    if (agentConfig.enabled) return;
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
  }, [loading, autoExecute, sessionId, agentStatus?.running, runAgentLoop, agentConfig.enabled]);

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
        <ModelPicker
          providers={providers}
          fetching={providersFetching}
          onRefresh={() => fetchProviders()}
          selectedModel={selectedModel}
          onSelect={(model) => setSelectedModel(sessionId, model)}
          colors={colors as Record<string, string>}
        />

        <div className="flex items-center gap-1">
          {/* Server agent — backend proposes commands, this client runs them */}
          <button
            onClick={handleToggleAgentMode}
            className="p-1.5 rounded transition-colors hover:bg-white/10 relative"
            title={agentConfig.enabled
              ? 'Agent mode ON — backend plans, commands run here with your approval'
              : 'Agent mode OFF — click to enable the server-driven agent'}
          >
            <Bot size={13} style={{ color: agentConfig.enabled ? colors.cyan : `${colors.foreground}60` }} />
            {agentConfig.enabled && (
              <span
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: colors.cyan }}
              />
            )}
          </button>
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
            onClick={() => {
              clearSession(sessionId);
              clearAgentRuns(sessionId);
              clearAgentUsage(sessionId);
            }}
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

      {/* ── Agent controls ── */}
      {agentConfig.enabled && (
        <div
          className="px-4 py-2 border-b shrink-0"
          style={{ borderColor: `${colors.foreground}12`, backgroundColor: `${colors.cyan}06` }}
        >
          <AgentControls sessionId={sessionId} colors={colors as Record<string, string>} />
        </div>
      )}

      {/* ── Auto-execute status banner ── */}
      {autoExecute && !agentConfig.enabled && (
        <AutoExecuteBanner
          agentStatus={agentStatus}
          colors={colors as Record<string, string>}
          onStop={stopAgent}
          onDisable={handleToggleAutoExecute}
        />
      )}

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <ChatEmptyState
            colors={colors as Record<string, string>}
            onPick={(q) => {
              setInput(q);
              inputRef.current?.focus();
            }}
          />
        )}
        <MessageList
          messages={messages}
          colors={colors as Record<string, string>}
          loading={loading}
          agentRunning={!!agentStatus?.running}
          onExecute={handleExecute}
          onPaste={handlePaste}
        />
        {/* Past runs stay visible after agent mode is switched off. */}
        <AgentRuns sessionId={sessionId} colors={colors as Record<string, string>} onStop={stopServerAgent} />
        <AgentUsagePanel sessionId={sessionId} colors={colors as Record<string, string>} />
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
      <ContextBadge
        selection={selection}
        screenContent={screenContent}
        colors={colors as Record<string, string>}
        onClearSelection={() => setTerminalSelection(sessionId, '')}
      />

      {/* ── Input ── */}
      <ChatComposer
        inputRef={inputRef}
        value={input}
        onChange={setInput}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        onAbort={abort}
        onStopAgent={stopAgent}
        loading={loading}
        agentStatus={agentStatus}
        selectedModel={selectedModel}
        colors={colors as Record<string, string>}
      />
    </div>
  );
}
