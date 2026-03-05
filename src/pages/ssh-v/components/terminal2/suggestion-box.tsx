
import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useCommandStore } from "@/store";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useAIChatStore, getDefaultModel } from "@/store/aiChatStore";
import { useTerminalStore } from "@/store/terminalStore";
import { __config } from "@/lib/config";

interface SuggestionBoxProps {
  suggestionPos: { top: number; left: number }
  suggestions: string[]
  isVisible?: boolean
  terminalHeight: number;
  terminalWidth: number;
  setSuggestions: React.Dispatch<React.SetStateAction<string[]>>
  /** localStorage key used to persist suggestions per host */
  hostKey?: string
  /** Current partial command the user is typing */
  commandBuffer?: string
  /** Session ID for AI ghost command */
  sessionId: string
}

/**
 * Mix two hex colors. `t` is 0-1 where 0 = c1, 1 = c2.
 */
function mixHex(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "").slice(0, 6);
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const m = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `#${m(r1, r2).toString(16).padStart(2, "0")}${m(g1, g2).toString(16).padStart(2, "0")}${m(b1, b2).toString(16).padStart(2, "0")}`;
}

/**
 * Derive suggestion-box UI colors from the active terminal theme.
 * Falls back to the current hardcoded palette (tokyoNight-ish).
 */
function useBoxColors() {
  const { colors } = useSessionTheme();

  return useMemo(() => {
    // Cast to a loose record so we can safely read any xterm color key
    const c = colors as Record<string, string | undefined>;

    const bg = c.background ?? "#1a1b26";
    const fg = c.foreground ?? "#e0e0e0";
    const accent = c.green ?? c.cyan ?? "#22c55e";
    const accentBright = c.brightGreen ?? c.brightCyan ?? "#4ade80";
    const border = c.brightBlack ?? "#2c2d3c";
    // Mix bg toward fg at 12% so hover is always visible regardless of theme
    const hoverBg = mixHex(bg, fg, 0.12);
    const dimFg = c.brightBlack ?? "#6272a4";
    const errorFg = c.red ?? "#f43f5e";
    const errorBright = c.brightRed ?? "#fb7185";

    const hoverBorder = `${accent}40`; // subtle accent border on hover
    return { bg, fg, accent, accentBright, border, hoverBg, hoverBorder, dimFg, errorFg, errorBright };
  }, [colors]);
}

/* ── AI command suggestion via /api/chat/ai SSE → ghost text ── */

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
}

/**
 * Fetch AI-suggested command for the current partial input via /api/chat/ai SSE.
 * Streams the response and sets it as ghost text in the terminal.
 */
function useAICommandSuggestion(commandBuffer: string, isVisible: boolean, sessionId: string) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef("");

  const fetchAISuggestions = useCallback(async (query: string) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiLoading(true);
    setAiError(null);
    lastQueryRef.current = query;

    try {
      const state = useAIChatStore.getState();
      const model = state.selectedModel[sessionId] ?? getDefaultModel(state.providers);
      const logs = useTerminalStore.getState().logs[sessionId] ?? [];
      const last50 = logs.slice(-50);
      const termContext = stripAnsi(last50.join('')).trim();

      const payload = {
        modelId: model?.modelId ?? '',
        providerId: model?.providerId ?? '',
        question: `Given this terminal context, suggest a single shell command for: "${query}". Reply ONLY with the raw command, no explanation, no markdown, no code fences.`,
        selection: '',
        context: termContext ? `Recent terminal output:\n${termContext}` : '',
        history: [],
      };

      const res = await fetch(`${__config.API_URL}/api/chat/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const lines = event.split('\n');
          let eventType = '';
          let eventData = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            else if (line.startsWith('data:')) eventData = line.slice(5).trim();
          }
          if (!eventData) continue;
          try {
            const json = JSON.parse(eventData);
            if (eventType === 'chunk') fullText += json.text ?? '';
            else if (eventType === 'done') fullText = json.text ?? fullText;
          } catch {
            fullText += eventData;
          }
        }
      }

      // Clean up — strip code fences, backticks, leading $
      let cmd = fullText.trim();
      cmd = cmd.replace(/^```(?:\w*)\n?/i, '').replace(/\n?```$/, '').trim();
      cmd = cmd.replace(/^`|`$/g, '').trim();
      cmd = cmd.replace(/^\$\s*/, '').trim();

      if (cmd) {
        useAIChatStore.getState().setGhostCommand(sessionId, cmd);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setAiError('AI unavailable');
    } finally {
      if (lastQueryRef.current === query) setAiLoading(false);
    }
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Auto-clear when hidden or buffer is empty
  useEffect(() => {
    if (!isVisible || !commandBuffer) {
      setAiError(null);
      setAiLoading(false);
      abortRef.current?.abort();
    }
  }, [isVisible, commandBuffer]);

  return { aiLoading, aiError, fetchAISuggestions };
}

const AISuggestionBox: React.FC<SuggestionBoxProps> = ({ terminalHeight, setSuggestions, terminalWidth, suggestionPos, suggestions, isVisible = true, hostKey, commandBuffer = "", sessionId }) => {
  const { setCommand } = useCommandStore();
  const c = useBoxColors();
  const { aiLoading, aiError, fetchAISuggestions } = useAICommandSuggestion(commandBuffer, isVisible, sessionId);
  const BOX_HEIGHT = 160;
  const AI_SECTION_HEIGHT = 32;
  const BOX_WIDTH = 280;
  const OUTER_PADDING = 16; // p-2 = 0.5rem = 8px per side, total 16px
  const GAP = 30


  const handleCommandClick = (command: string) => {
    setCommand(command, "single");
  };

  if (!isVisible) return null;

  // Horizontal position
  const fitsRight = suggestionPos.left + BOX_WIDTH < terminalWidth;
  const adjustedLeft = fitsRight
    ? suggestionPos.left
    : Math.max(0, terminalWidth - BOX_WIDTH - 10); // 10px padding

  // Vertical position
  const fitsBelow = suggestionPos.top + BOX_HEIGHT + GAP < terminalHeight;
  const adjustedTop = fitsBelow
    ? suggestionPos.top + 8
    : suggestionPos.top - BOX_HEIGHT - GAP;
  return (
    <div
      className="absolute rounded-lg z-50 p-2"
      style={{
        top: adjustedTop,
        left: suggestionPos.left,
        width: BOX_WIDTH,
        maxHeight: BOX_HEIGHT + AI_SECTION_HEIGHT,
        overflow: "hidden",
        background: c.bg,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: c.border,
        color: c.accent,
      }}
    >
      {/* ── AI Suggest section ─────────────────────────────── */}
      <div
        style={{
          borderBottom: `1px solid ${c.border}`,
          paddingBottom: 4,
          marginBottom: 4,
        }}
      >
        {/* Ask AI button row */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors duration-150"
          style={{ color: c.fg }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = c.hoverBg;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "transparent";
          }}
          onClick={() => {
            if (commandBuffer.trim()) {
              fetchAISuggestions(commandBuffer.trim());
            }
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: c.accent, flexShrink: 0 }}>
            <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
            <path d="M18 14a6 6 0 0 1-12 0" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
          <span className="font-medium" style={{ color: c.accent }}>
            {aiLoading ? "Thinking…" : "Ask AI"}
          </span>
          {commandBuffer.trim() && !aiLoading && (
            <span className="truncate ml-1" style={{ color: c.dimFg, maxWidth: 160 }}>
              "{commandBuffer.trim().slice(0, 30)}"
            </span>
          )}
          {aiLoading && (
            <span
              className="ml-auto inline-block w-3 h-3 border-2 rounded-full animate-spin"
              style={{ borderColor: `${c.accent} transparent ${c.accent} transparent` }}
            />
          )}
        </div>

        {/* AI error */}
        {aiError && (
          <div className="px-2 py-0.5 text-[10px]" style={{ color: c.errorFg }}>
            {aiError}
          </div>
        )}
      </div>

      {/* ── History suggestions ──────────────────────────── */}
      <div
        className="overflow-y-auto scrollbar-thin scrollbar-green"
        style={{ height: BOX_HEIGHT - OUTER_PADDING - AI_SECTION_HEIGHT }}
      >
        {suggestions.map((command, index) => (
          <div
            key={index}
            className="group flex justify-between items-center font-mono whitespace-nowrap overflow-hidden px-2 py-1 rounded text-xs transition-colors duration-150 cursor-pointer"
            style={{
              color: c.accent,
              borderBottom: index < suggestions.length - 1 ? `1px solid ${c.border}` : "none",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = c.hoverBg;
              el.style.color = c.accentBright;
              el.style.borderRadius = "4px";
              el.style.outline = `1px solid ${c.hoverBorder}`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "transparent";
              el.style.color = c.accent;
              el.style.outline = "none";
            }}
            onClick={() => handleCommandClick(command)}
          >
            <span className="truncate">{command}</span>

            {/* Cross button - visible only on hover */}
            <button
              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: c.errorFg }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = c.errorBright; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = c.errorFg; }}
              onClick={(e) => {
                e.stopPropagation();
                setSuggestions((prevSuggestions) => {
                  const updated = Array.from(new Set(prevSuggestions.filter((s) => s !== command)));
                  // Persist removal to localStorage immediately
                  if (hostKey) {
                    try { localStorage.setItem(`terminus-suggestions:${hostKey}`, JSON.stringify(updated)); } catch { /* ignore */ }
                  }
                  return updated;
                });
              }}
            >
              ×
            </button>
          </div>

        ))}
      </div>
    </div>

  )
}


export default AISuggestionBox
