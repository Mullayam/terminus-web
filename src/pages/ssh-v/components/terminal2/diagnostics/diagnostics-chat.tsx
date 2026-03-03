import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Copy,
  Loader2,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { __config } from '@/lib/config';
import type { DiagnosticEntry } from './useDiagnostics';

// ─── Types ───────────────────────────────────────────────────
interface Props {
  entries: DiagnosticEntry[];
  /** Pre-selected filter when opened from a status-bar click */
  initialFilter?: 'error' | 'warning' | 'all';
  onClose: () => void;
  onClear: () => void;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Helpers ─────────────────────────────────────────────────
/** Build the prompt sent to the AI for diagnosis */
function buildPrompt(selectedEntries: DiagnosticEntry[]): string {
  const lines = selectedEntries.map((e) => `[${e.type.toUpperCase()}] ${e.line}`).join('\n');
  return [
    'The following errors/warnings appeared in a Linux terminal session.',
    'Explain what each one means, why it likely happened, and suggest concise fixes.',
    'Be brief and practical.\n',
    '```',
    lines,
    '```',
  ].join('\n');
}

/**
 * Diagnostics chat panel — shows captured errors/warnings
 * with the ability to ask AI what happened.
 *
 * Open/Closed: pluggable AI endpoint via __config.API_URL.
 * Single Responsibility: only UI + AI fetch, gets data via props.
 */
export default function DiagnosticsChat({
  entries,
  initialFilter = 'all',
  onClose,
  onClear,
}: Props) {
  const { colors } = useSessionTheme();
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>(initialFilter);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextMsgId = useRef(1);

  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.type === filter)),
    [entries, filter],
  );

  const errorColor = useMemo(() => (colors as Record<string, string | undefined>).red ?? '#ef4444', [colors]);
  const warnColor = useMemo(() => (colors as Record<string, string | undefined>).yellow ?? '#eab308', [colors]);

  // Auto-scroll chat
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  /** Copy all visible diagnostics to clipboard */
  const copyToClipboard = useCallback(() => {
    const text = filtered.map((e) => `[${e.type.toUpperCase()}] ${e.line}`).join('\n');
    navigator.clipboard.writeText(text);
  }, [filtered]);

  /** Ask AI to diagnose */
  const diagnose = useCallback(
    async (prompt: string) => {
      const userMsg: ChatMessage = { id: nextMsgId.current++, role: 'user', content: prompt };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch(`${__config.API_URL}/api/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'You are a concise Linux terminal diagnostics assistant.' },
              { role: 'user', content: prompt },
            ],
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Handle streaming (SSE) or plain JSON
        const contentType = res.headers.get('content-type') ?? '';
        let assistantText = '';

        if (contentType.includes('text/event-stream') || contentType.includes('stream')) {
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          const assistantId = nextMsgId.current++;
          setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

          if (reader) {
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              // Parse SSE lines
              const parts = buffer.split('\n');
              buffer = parts.pop() ?? '';
              for (const part of parts) {
                const line = part.trim();
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') continue;
                try {
                  const json = JSON.parse(data);
                  const delta =
                    json.choices?.[0]?.delta?.content ??
                    json.choices?.[0]?.text ??
                    json.content ??
                    json.text ??
                    '';
                  assistantText += delta;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: assistantText } : m)),
                  );
                } catch {
                  // plain text chunk
                  assistantText += data;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: assistantText } : m)),
                  );
                }
              }
            }
          }
        } else {
          // Plain JSON response
          const json = await res.json();
          assistantText =
            json.choices?.[0]?.message?.content ??
            json.choices?.[0]?.text ??
            json.content ??
            json.text ??
            JSON.stringify(json);
          setMessages((prev) => [
            ...prev,
            { id: nextMsgId.current++, role: 'assistant', content: assistantText },
          ]);
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId.current++,
            role: 'assistant',
            content: `⚠ Failed to reach AI endpoint: ${err?.message ?? 'unknown error'}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Auto-diagnose button: builds prompt from current filtered entries */
  const handleAutoDiagnose = () => {
    if (filtered.length === 0) return;
    diagnose(buildPrompt(filtered));
  };

  /** Manual user message */
  const handleSend = () => {
    const trimmed = userInput.trim();
    if (!trimmed) return;
    setUserInput('');
    // If there are entries, prepend context
    const context =
      filtered.length > 0
        ? `Given these terminal diagnostics:\n${filtered.map((e) => `[${e.type.toUpperCase()}] ${e.line}`).join('\n')}\n\nUser question: ${trimmed}`
        : trimmed;
    diagnose(context);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-[560px] max-h-[80vh] rounded-lg border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: colors.background,
          borderColor: `${colors.foreground}20`,
          color: colors.foreground,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: `${colors.foreground}15` }}
        >
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-blue-400" />
            <span className="text-sm font-medium">Terminal Diagnostics</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={copyToClipboard}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Copy diagnostics"
            >
              <Copy size={13} style={{ color: `${colors.foreground}80` }} />
            </button>
            <button
              onClick={() => { onClear(); setMessages([]); }}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Clear all"
            >
              <Trash2 size={13} style={{ color: `${colors.foreground}80` }} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
            >
              <X size={14} style={{ color: `${colors.foreground}80` }} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div
          className="flex items-center gap-2 px-4 py-2 border-b shrink-0"
          style={{ borderColor: `${colors.foreground}10` }}
        >
          {(['all', 'error', 'warning'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              {f === 'all'
                ? `All (${entries.length})`
                : f === 'error'
                  ? `Errors (${entries.filter((e) => e.type === 'error').length})`
                  : `Warnings (${entries.filter((e) => e.type === 'warning').length})`}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={handleAutoDiagnose}
            disabled={filtered.length === 0 || loading}
            className="px-3 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <Bot size={12} />
            Diagnose with AI
          </button>
        </div>

        {/* Diagnostic entries list */}
        <div
          className="max-h-36 overflow-y-auto border-b px-3 py-2 space-y-1 shrink-0"
          style={{ borderColor: `${colors.foreground}10` }}
        >
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: `${colors.foreground}50` }}>
              No diagnostics captured yet.
            </p>
          ) : (
            filtered.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-2 px-2 py-1 rounded text-xs font-mono"
                style={{ backgroundColor: `${colors.foreground}08` }}
              >
                {e.type === 'error' ? (
                  <AlertCircle size={12} className="mt-0.5 shrink-0" style={{ color: errorColor }} />
                ) : (
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: warnColor }} />
                )}
                <span className="break-all leading-relaxed" style={{ color: `${colors.foreground}cc` }}>
                  {e.line}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Chat messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[160px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: `${colors.foreground}40` }}>
              <Bot size={24} />
              <p className="text-xs">Click "Diagnose with AI" or ask a question below</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : ''
                }`}
                style={
                  msg.role === 'assistant'
                    ? { backgroundColor: `${colors.foreground}10`, color: `${colors.foreground}dd` }
                    : undefined
                }
              >
                {msg.content || (loading && msg.role === 'assistant' ? '...' : '')}
              </div>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex items-center gap-2" style={{ color: `${colors.foreground}60` }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Analyzing...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-t shrink-0"
          style={{ borderColor: `${colors.foreground}15` }}
        >
          <input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about these errors..."
            className="flex-1 bg-transparent text-xs px-3 py-2 rounded border outline-none transition-colors"
            style={{
              borderColor: `${colors.foreground}20`,
              color: colors.foreground,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!userInput.trim() || loading}
            className="p-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
