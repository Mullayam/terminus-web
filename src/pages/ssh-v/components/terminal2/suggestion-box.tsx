
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
 */
function useBoxColors() {
  const { colors } = useSessionTheme();

  return useMemo(() => {
    const c = colors as Record<string, string | undefined>;

    const bg = c.background ?? "#1a1b26";
    const fg = c.foreground ?? "#e0e0e0";
    const accent = c.green ?? c.cyan ?? "#22c55e";
    const accentBright = c.brightGreen ?? c.brightCyan ?? "#4ade80";
    const border = c.brightBlack ?? "#2c2d3c";
    const hoverBg = mixHex(bg, fg, 0.08);
    const activeBg = mixHex(bg, fg, 0.14);
    const dimFg = c.brightBlack ?? "#6272a4";
    const errorFg = c.red ?? "#f43f5e";
    const errorBright = c.brightRed ?? "#fb7185";
    const blue = c.blue ?? c.brightBlue ?? "#7aa2f7";
    const yellow = c.yellow ?? c.brightYellow ?? "#e0af68";
    const surfaceBg = mixHex(bg, fg, 0.04);

    return { bg, fg, accent, accentBright, border, hoverBg, activeBg, dimFg, errorFg, errorBright, blue, yellow, surfaceBg };
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const BOX_WIDTH = 320;
  const MAX_HEIGHT = 280;
  const GAP = 12;

  // Reset active index when suggestions or buffer changes
  useEffect(() => { setActiveIndex(-1); }, [suggestions.length, commandBuffer]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      } else if (e.key === "Tab" && activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        e.stopPropagation();
        setCommand(suggestions[activeIndex], "single");
      } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        e.stopPropagation();
        setCommand(suggestions[activeIndex], "single");
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex(-1);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isVisible, activeIndex, suggestions, setCommand]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleCommandClick = (command: string) => setCommand(command, "single");

  const handleRemove = (command: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSuggestions((prev) => {
      const updated = prev.filter((s) => s !== command);
      if (hostKey) {
        try { localStorage.setItem(`terminus-suggestions:${hostKey}`, JSON.stringify(updated)); } catch { /* ignore */ }
      }
      return updated;
    });
  };

  if (!isVisible) return null;

  // Position
  const fitsRight = suggestionPos.left + BOX_WIDTH < terminalWidth;
  const adjustedLeft = fitsRight
    ? suggestionPos.left
    : Math.max(8, terminalWidth - BOX_WIDTH - 8);

  const fitsBelow = suggestionPos.top + MAX_HEIGHT + GAP < terminalHeight;
  const adjustedTop = fitsBelow
    ? suggestionPos.top + GAP
    : suggestionPos.top - MAX_HEIGHT - GAP;

  // Highlight matched portion in suggestion text
  const renderHighlighted = (text: string) => {
    if (!commandBuffer) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(commandBuffer.toLowerCase());
    if (idx < 0) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ color: c.accentBright, fontWeight: 600 }}>{text.slice(idx, idx + commandBuffer.length)}</span>
        {text.slice(idx + commandBuffer.length)}
      </>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        top: adjustedTop,
        left: adjustedLeft,
        width: BOX_WIDTH,
        maxHeight: MAX_HEIGHT,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        background: `${c.bg}e6`,
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 ${c.fg}08`,
        overflow: "hidden",
        fontFamily: "'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif",
        animation: "suggestionSlideIn 0.15s ease-out",
      }}
    >
      {/* ── Header: Ask AI ── */}
      <div style={{ padding: "8px 10px 6px", borderBottom: `1px solid ${c.border}` }}>
        <button
          onClick={() => { if (commandBuffer.trim()) fetchAISuggestions(commandBuffer.trim()); }}
          disabled={aiLoading || !commandBuffer.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "6px 10px",
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            background: c.surfaceBg,
            color: c.fg,
            cursor: aiLoading || !commandBuffer.trim() ? "default" : "pointer",
            opacity: !commandBuffer.trim() ? 0.5 : 1,
            fontSize: 12,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!aiLoading && commandBuffer.trim()) {
              (e.currentTarget as HTMLElement).style.background = c.hoverBg;
              (e.currentTarget as HTMLElement).style.borderColor = `${c.accent}60`;
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = c.surfaceBg;
            (e.currentTarget as HTMLElement).style.borderColor = c.border;
          }}
        >
          {/* Sparkle icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          <span style={{ fontWeight: 500, color: c.fg }}>
            {aiLoading ? "Thinking…" : "Ask AI"}
          </span>
          {commandBuffer.trim() && !aiLoading && (
            <span style={{ color: c.dimFg, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
              {commandBuffer.trim().slice(0, 35)}
            </span>
          )}
          {aiLoading && (
            <span
              style={{
                marginLeft: "auto",
                width: 12,
                height: 12,
                border: `2px solid ${c.accent}40`,
                borderTopColor: c.accent,
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
                flexShrink: 0,
              }}
            />
          )}
          {!aiLoading && (
            <span style={{ marginLeft: "auto", fontSize: 10, color: c.dimFg, flexShrink: 0 }}>⏎</span>
          )}
        </button>
        {aiError && (
          <div style={{ padding: "2px 10px 0", fontSize: 10, color: c.errorFg }}>{aiError}</div>
        )}
      </div>

      {/* ── Suggestions list ── */}
      {suggestions.length > 0 && (
        <>
          <div style={{ padding: "6px 12px 2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: mixHex(c.bg, c.fg, 0.55) }}>
              Suggestions
            </span>
            <span style={{ fontSize: 10, color: mixHex(c.bg, c.fg, 0.55) }}>
              {suggestions.length}
            </span>
          </div>
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "2px 6px 6px",
              scrollbarWidth: "thin",
              scrollbarColor: `${c.dimFg}40 transparent`,
            }}
          >
            {suggestions.map((cmd, index) => {
              const isActive = index === activeIndex;
              return (
                <div
                  key={index}
                  onClick={() => handleCommandClick(cmd)}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 8px",
                    marginBottom: 1,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    color: isActive ? c.fg : c.accent,
                    background: isActive ? c.activeBg : "transparent",
                    transition: "background 0.1s ease, color 0.1s ease",
                  }}
                >
                  {/* Command icon */}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isActive ? c.accentBright : c.dimFg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>

                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {renderHighlighted(cmd)}
                  </span>

                  {/* Remove button */}
                  <button
                    onClick={(e) => handleRemove(cmd, e)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "none",
                      background: "transparent",
                      color: c.dimFg,
                      cursor: "pointer",
                      opacity: isActive ? 0.7 : 0,
                      transition: "opacity 0.15s, background 0.15s, color 0.15s",
                      flexShrink: 0,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = "1";
                      (e.currentTarget as HTMLElement).style.background = `${c.errorFg}20`;
                      (e.currentTarget as HTMLElement).style.color = c.errorBright;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = isActive ? "0.7" : "0";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = c.dimFg;
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {suggestions.length === 0 && (
        <div style={{ padding: "16px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: c.dimFg }}>No matching commands</div>
          <div style={{ fontSize: 10, color: `${c.dimFg}80`, marginTop: 2 }}>Type to search or ask AI</div>
        </div>
      )}

      {/* ── Footer hints ── */}
      <div
        style={{
          padding: "4px 12px 6px",
          borderTop: `1px solid ${c.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 10,
          color: mixHex(c.bg, c.fg, 0.55),
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <kbd style={{ padding: "0 4px", borderRadius: 3, background: `${c.fg}18`, border: `1px solid ${c.fg}22`, fontSize: 9, lineHeight: "16px" }}>↑↓</kbd>
          navigate
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <kbd style={{ padding: "0 4px", borderRadius: 3, background: `${c.fg}18`, border: `1px solid ${c.fg}22`, fontSize: 9, lineHeight: "16px" }}>Tab</kbd>
          accept
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <kbd style={{ padding: "0 4px", borderRadius: 3, background: `${c.fg}18`, border: `1px solid ${c.fg}22`, fontSize: 9, lineHeight: "16px" }}>Esc</kbd>
          close
        </span>
      </div>

      {/* Keyframe animations injected via style tag */}
      <style>{`
        @keyframes suggestionSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}


export default AISuggestionBox
