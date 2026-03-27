import { useCallback, useEffect, useRef, useState, memo } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import type { Terminal } from "@xterm/xterm";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useAIChatStore, getDefaultModel } from "@/store/aiChatStore";
import { useTerminalStore } from "@/store/terminalStore";
import { __config } from "@/lib/config";

interface InlineCommandInputProps {
  sessionId: string;
  termRef: React.RefObject<Terminal | null>;
  isRightSidebarOpen?: boolean;
  isAIChatOpen?: boolean;
  onClose: () => void;
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
}

function getCursorPixelPos(term: Terminal) {
  const core = (term as any)._core;
  const dims = core?._renderService?.dimensions;
  if (!dims) return null;

  const screen = term.element?.querySelector(".xterm-screen") as HTMLElement | null;
  const offsetX = screen?.offsetLeft ?? 0;
  const offsetY = screen?.offsetTop ?? 0;

  const buf = term.buffer.active;
  return {
    x: offsetX,
    y: (buf.cursorY + 1) * dims.css.cell.height + offsetY,
  };
}

const InlineCommandInput = memo(function InlineCommandInput({
  sessionId,
  termRef,
  isRightSidebarOpen = false,
  isAIChatOpen = false,
  onClose,
}: InlineCommandInputProps) {
  const { colors } = useSessionTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Get cursor position on mount
  useEffect(() => {
    const term = termRef.current;
    if (term) {
      const pos = getCursorPixelPos(term);
      if (pos) setCursorPos(pos);
    }
  }, [termRef]);

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const state = useAIChatStore.getState();
      const model =
        state.selectedModel[sessionId] ?? getDefaultModel(state.providers);
      const logs = useTerminalStore.getState().logs[sessionId] ?? [];
      const last50 = logs.slice(-50);
      const termContext = stripAnsi(last50.join("")).trim();

      const payload = {
        modelId: model?.modelId ?? "",
        providerId: model?.providerId ?? "",
        question: `Given this terminal context, suggest a single shell command for: "${trimmed}". Reply ONLY with the raw command, no explanation, no markdown, no code fences.`,
        selection: "",
        context: termContext
          ? `Recent terminal output:\n${termContext}`
          : "",
        history: [],
      };

      const res = await fetch(`${__config.API_URL}/api/chat/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const lines = event.split("\n");
          let eventType = "";
          let eventData = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) eventData = line.slice(5).trim();
          }
          if (!eventData) continue;
          try {
            const json = JSON.parse(eventData);
            if (eventType === "chunk") fullText += json.text ?? "";
            else if (eventType === "done") fullText = json.text ?? fullText;
          } catch {
            fullText += eventData;
          }
        }
      }

      // Clean up — strip code fences, backticks, leading $
      let cmd = fullText.trim();
      cmd = cmd.replace(/^```(?:\w*)\n?/i, "").replace(/\n?```$/, "").trim();
      cmd = cmd.replace(/^`|`$/g, "").trim();
      cmd = cmd.replace(/^\$\s*/, "").trim();

      if (cmd) {
        useAIChatStore.getState().setGhostCommand(sessionId, cmd);
        onClose();
      } else {
        setError("No command generated");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError("AI unavailable");
    } finally {
      setLoading(false);
    }
  }, [query, loading, sessionId, onClose]);

  const rightOffset = isRightSidebarOpen && isAIChatOpen
    ? 'calc(25rem + 400px + 8px)'
    : isRightSidebarOpen
      ? '25.5rem'
      : isAIChatOpen
        ? '26.5rem'
        : '8px';

  return (
    <div
      className="absolute z-30 flex items-center gap-2 rounded-lg border px-3 py-2 shadow-xl backdrop-blur-sm transition-[right] duration-300 ease-in-out animate-in fade-in slide-in-from-bottom-2"
      style={{
        left: cursorPos?.x ?? 8,
        top: cursorPos ? cursorPos.y + 4 : undefined,
        bottom: cursorPos ? undefined : 8,
        right: rightOffset,
        backgroundColor: `${colors.background}f0`,
        borderColor: `${colors.cyan}40`,
        boxShadow: `0 0 20px ${colors.cyan}15, 0 4px 12px rgba(0,0,0,0.4)`,
      }}
    >
      <Sparkles
        size={14}
        className={loading ? "animate-pulse" : ""}
        style={{ color: colors.cyan, flexShrink: 0 }}
      />

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
          // Stop propagation so xterm doesn't capture keys
          e.stopPropagation();
        }}
        placeholder="Describe what you want to do..."
        className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
        style={{ color: colors.foreground, caretColor: colors.cyan }}
        disabled={loading}
      />

      {loading && (
        <Loader2
          size={14}
          className="animate-spin flex-shrink-0"
          style={{ color: colors.cyan }}
        />
      )}

      {error && (
        <span className="text-[10px] flex-shrink-0" style={{ color: colors.red }}>
          {error}
        </span>
      )}

      <div
        className="flex items-center gap-1 flex-shrink-0 text-[10px]"
        style={{ color: `${colors.foreground}40` }}
      >
        <span
          style={{
            padding: "1px 5px",
            borderRadius: "3px",
            border: `1px solid ${colors.foreground}20`,
            fontSize: "9px",
          }}
        >
          Enter
        </span>
        <span>to generate</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span
          style={{
            padding: "1px 5px",
            borderRadius: "3px",
            border: `1px solid ${colors.foreground}20`,
            fontSize: "9px",
          }}
        >
          Esc
        </span>
        <span>to close</span>
      </div>

      <button
        onClick={onClose}
        className="p-1 rounded transition-colors hover:bg-white/10 flex-shrink-0"
        title="Close (Esc)"
      >
        <X size={12} style={{ color: `${colors.foreground}60` }} />
      </button>
    </div>
  );
});

export default InlineCommandInput;
