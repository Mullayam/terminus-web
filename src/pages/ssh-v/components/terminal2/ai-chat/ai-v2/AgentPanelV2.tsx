import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Bot, Send, Square, Trash2, Zap, ZapOff } from 'lucide-react';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { useAgentV2 } from './useAgentV2';
import { TranscriptView } from './TranscriptView';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}

const EXAMPLES = [
  "stop my container caddy and force recreate",
  "what's on my screen?",
  "remove the old build folder recursively",
  "restart the nginx service",
];

/**
 * AI Agent v2 — the full `/ai-agent` integration-guide UX (streamed MESSAGE,
 * COMMAND/OUTPUT chips, EXECUTE_TASK, the DANGEROUS → CONFIRM → reply flow,
 * auto-mode, model picker, stop). Wired to the REAL agent namespace: prompts,
 * confirmations and aborts run against the terminal's own PTY.
 */
/** Rough luminance of a #rrggbb color → pick a native control color-scheme. */
function schemeFor(bg: string): 'dark' | 'light' {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg.trim());
  if (!m) return 'dark';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.5 ? 'dark' : 'light';
}

export default function AgentPanelV2({ sessionId, open, onClose }: Props) {
  const { colors } = useSessionTheme();
  const agent = useAgentV2(sessionId);
  const { transcript, running, confirm, autoMode, model, catalog, connected, error } = agent;
  const colorScheme = schemeFor(colors.background);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [transcript, confirm]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 180);
  }, [open]);

  const submit = useCallback(() => {
    const t = input.trim();
    if (!t || running) return;
    setInput('');
    agent.sendPrompt(t);
  }, [input, running, agent]);

  if (!open) return null;

  return (
    <div
      className="fixed right-0 top-14 bottom-12 z-40 flex flex-col overflow-hidden animate-in slide-in-from-right themed-scrollbar"
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
      <div className="flex items-center gap-2 px-3 py-3 shrink-0 border-b" style={{ borderColor: `${colors.foreground}12` }}>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 transition-colors" title="Back to AI chat">
          <ArrowLeft size={15} style={{ color: `${colors.foreground}80` }} />
        </button>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.magenta}30, ${colors.blue}30)` }}>
          <Bot size={14} style={{ color: colors.magenta }} />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: colors.foreground }}>
            AI Agent
            <span className="text-[9px] font-semibold px-1 py-px rounded" style={{ backgroundColor: `${colors.magenta}22`, color: colors.magenta }}>
              v2
            </span>
          </span>
          <span className="block text-[10px] leading-tight truncate" style={{ color: `${colors.foreground}50` }}>
            {sessionId.slice(0, 8)} • live
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => agent.setAutoMode(!autoMode)}
            className="p-1.5 rounded transition-colors hover:bg-white/10 relative"
            title={autoMode ? 'Auto-mode ON — confirm-tier runs without asking (blocked still asks)' : 'Auto-mode OFF — every dangerous command asks'}
          >
            {autoMode ? <Zap size={13} style={{ color: colors.green }} /> : <ZapOff size={13} style={{ color: `${colors.foreground}60` }} />}
            {autoMode && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.green }} />}
          </button>
          <button onClick={agent.clear} className="p-1.5 rounded hover:bg-white/10 transition-colors" title="Clear transcript">
            <Trash2 size={13} style={{ color: `${colors.foreground}60` }} />
          </button>
        </div>
      </div>

      {/* ── Model picker + live connection status ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ borderColor: `${colors.foreground}10` }}>
        <select
          value={model}
          onChange={(e) => agent.setModel(e.target.value)}
          disabled={catalog.providers.length === 0}
          className="text-[11px] rounded-md px-2 py-1 outline-none cursor-pointer disabled:opacity-60 max-w-[220px]"
          style={{
            backgroundColor: colors.background,
            color: colors.foreground,
            border: `1px solid ${colors.foreground}26`,
            // keep the native dropdown list readable (not white-on-white)
            colorScheme,
          }}
        >
          {!model && (
            <option value="" style={{ backgroundColor: colors.background, color: colors.foreground }}>
              {catalog.providers.length ? 'Default model' : 'Loading models…'}
            </option>
          )}
          {catalog.providers.map((p) => {
            const configured = catalog.configured.includes(p.id);
            return (
              <optgroup
                key={p.id}
                label={configured ? p.label : `${p.label} (no key)`}
                style={{ backgroundColor: colors.background, color: colors.foreground }}
              >
                {p.models.map((m) => (
                  <option key={m.id} value={m.id} disabled={!configured} style={{ backgroundColor: colors.background, color: colors.foreground }}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <span className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: `${colors.foreground}70` }}>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: connected ? colors.green : colors.brightRed || colors.red }}
          />
          {connected ? 'connected' : 'connecting…'}
        </span>
      </div>

      {/* ── Error strip ── */}
      {error && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 border-b shrink-0 text-[11px]"
          style={{ borderColor: `${colors.red}30`, backgroundColor: `${colors.red}12`, color: colors.foreground }}
        >
          <AlertCircle size={12} style={{ color: colors.brightRed || colors.red }} />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* ── Transcript ── */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 relative">
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: `linear-gradient(135deg, ${colors.magenta}26, ${colors.blue}26)` }}>
              <Bot size={20} style={{ color: colors.magenta }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: colors.foreground }}>
              AI Agent v2
            </p>
            <p className="text-[11px] mt-1 mb-4 max-w-[280px]" style={{ color: `${colors.foreground}70` }}>
              Runs tasks on this terminal's session. It streams its plan, executes commands, and pauses for your approval on anything destructive.
            </p>
            <div className="flex flex-col gap-1.5 w-full max-w-[300px]">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setInput(ex);
                    inputRef.current?.focus();
                  }}
                  className="text-left text-[11.5px] rounded-md px-2.5 py-1.5 transition-colors hover:bg-white/5"
                  style={{ color: `${colors.foreground}cc`, border: `1px solid ${colors.foreground}14` }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <TranscriptView items={transcript} colors={colors as Record<string, string>} />
        )}

        {/* ── Confirmation overlay ── */}
        {confirm && <ConfirmDialog request={confirm} colors={colors as Record<string, string>} onReply={agent.replyConfirm} />}
      </div>

      {/* ── Composer ── */}
      <div className="shrink-0 border-t px-3 py-3" style={{ borderColor: `${colors.foreground}12` }}>
        <div className="flex items-end gap-2 rounded-lg px-2.5 py-2" style={{ backgroundColor: `${colors.foreground}0a`, border: `1px solid ${colors.foreground}18` }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={running ? 'Agent is working…' : 'Ask the agent to do something…'}
            className="flex-1 bg-transparent resize-none outline-none text-[12.5px] max-h-28"
            style={{ color: colors.foreground }}
          />
          {running ? (
            <button
              onClick={agent.abort}
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-opacity hover:opacity-90"
              style={{ backgroundColor: colors.brightRed || colors.red, color: colors.background }}
              title="Stop (@@AI_AGENT_ABORT)"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-opacity disabled:opacity-40"
              style={{ backgroundColor: colors.cyan, color: colors.background }}
              title="Send (@@AI_AGENT_PROMPT)"
            >
              <Send size={13} />
            </button>
          )}
        </div>
        <p className="text-[9.5px] mt-1.5 px-1" style={{ color: `${colors.foreground}45` }}>
          Enter to send · Shift+Enter for newline · {autoMode ? 'auto-mode on' : 'auto-mode off'}
        </p>
      </div>
    </div>
  );
}
