import type React from "react";
import { useEffect, useState } from "react";
import { Loader2, Play, ShieldAlert, Sparkles, X } from "lucide-react";
import { streamAIExplanation, stripAnsi } from "./aiCommand";
import { useTerminalStore } from "@/store/terminalStore";

export interface ExplanationState {
  text: string;
  loading: boolean;
  error: string | null;
}

/**
 * Streams a plain-language explanation of `command` for the given session.
 * Re-runs whenever the command changes; aborts the in-flight request on
 * unmount or when the command changes so only the latest explanation shows.
 */
export function useCommandExplanation(command: string, sessionId: string, enabled: boolean): ExplanationState {
  const [state, setState] = useState<ExplanationState>({ text: "", loading: false, error: null });

  useEffect(() => {
    const cmd = command.trim();
    if (!enabled || !cmd) {
      setState({ text: "", loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ text: "", loading: true, error: null });

    // Debounce so editing the command (e.g. in the palette) doesn't spam the API.
    const timer = setTimeout(() => {
      // A little recent output helps the model reason about cwd / prior errors.
      const logs = useTerminalStore.getState().logs[sessionId] ?? [];
      const context = stripAnsi(logs.slice(-30).join("")).trim();

      streamAIExplanation({
        sessionId,
        command: cmd,
        context: context ? `Recent terminal output:\n${context}` : "",
        signal: controller.signal,
        onText: (full) => setState((s) => ({ ...s, text: full })),
      })
        .then((full) => setState({ text: full, loading: false, error: null }))
        .catch((e) => {
          if (controller.signal.aborted) return;
          setState({ text: "", loading: false, error: e instanceof Error ? e.message : "Failed to explain" });
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [command, sessionId, enabled]);

  return state;
}

/** Heuristic flag so we can surface a warning banner for risky commands. */
const RISKY_RE = /\b(rm\s+-|mkfs|dd\s+if=|:\(\)\s*\{|shutdown|reboot|chmod\s+-R|chown\s+-R|>\s*\/dev\/sd|--force|--no-preserve-root|drop\s+(database|table)|truncate)\b/i;

interface ExplanationBodyProps {
  state: ExplanationState;
  fg: string;
  accent: string;
  error: string;
}

/** Renders the streamed explanation as a light bullet list. */
export function ExplanationBody({ state, fg, accent, error }: ExplanationBodyProps) {
  if (state.error) {
    return <div style={{ fontSize: 12, color: error }}>{state.error}</div>;
  }
  if (!state.text && state.loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: `${fg}99` }}>
        <Loader2 size={14} style={{ color: accent, animation: "explSpin 0.7s linear infinite" }} />
        Analyzing command…
      </div>
    );
  }
  const lines = state.text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {lines.map((line, i) => {
        const clean = line.replace(/^[-*•]\s*/, "");
        return (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, lineHeight: 1.5, color: `${fg}dd` }}>
            <span style={{ color: accent, flexShrink: 0 }}>•</span>
            <span>{clean}</span>
          </div>
        );
      })}
      {state.loading && <Loader2 size={13} style={{ color: accent, animation: "explSpin 0.7s linear infinite" }} />}
    </div>
  );
}

interface CommandExplainProps {
  sessionId: string;
  /** The command being explained (as currently typed). */
  command: string;
  /** Run the command in the live terminal. */
  onRun: (command: string) => void;
  onClose: () => void;
  bg: string;
  fg: string;
  accent: string;
  border: string;
  error: string;
}

/**
 * Ctrl+Shift+E explanation overlay: shows what the currently-typed command
 * will do before it runs, then lets the user Run or dismiss.
 */
const CommandExplain: React.FC<CommandExplainProps> = ({ sessionId, command, onRun, onClose, bg, fg, accent, border, error }) => {
  const state = useCommandExplanation(command, sessionId, true);
  const risky = RISKY_RE.test(command);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); onRun(command); onClose(); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose, onRun, command]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "absolute", inset: 0, zIndex: 60,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh", background: "rgba(0,0,0,0.35)",
        animation: "explFade 0.12s ease-out",
      }}
    >
      <div
        style={{
          width: 560, maxWidth: "92%",
          background: `${bg}f7`, border: `1px solid ${border}`, borderRadius: 12,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)", overflow: "hidden",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Header + command */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
          <Sparkles size={16} style={{ color: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: fg }}>Command explanation</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} title="Close (Esc)" style={{ display: "flex", background: "transparent", border: "none", color: `${fg}88`, cursor: "pointer", padding: 2 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${accent}12`, border: `1px solid ${accent}40`, borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ color: accent, fontFamily: "monospace", flexShrink: 0 }}>$</span>
            <span style={{ flex: 1, color: fg, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {command}
            </span>
          </div>

          {risky && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${error}18`, border: `1px solid ${error}55`, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, color: error }}>
              <ShieldAlert size={14} style={{ flexShrink: 0 }} />
              This command may be destructive — review carefully before running.
            </div>
          )}

          <ExplanationBody state={state} fg={fg} accent={accent} error={error} />

          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 10.5, color: `${fg}55`, marginRight: "auto" }}>
              <b style={{ color: `${fg}88` }}>Ctrl+↵</b> run · <b style={{ color: `${fg}88` }}>Esc</b> dismiss
            </span>
            <button
              onClick={onClose}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer", border: `1px solid ${border}`, background: "transparent", color: fg }}
            >
              Cancel
            </button>
            <button
              onClick={() => { onRun(command); onClose(); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer", border: `1px solid ${accent}`, background: accent, color: bg, fontWeight: 600 }}
            >
              <Play size={13} /> Run
            </button>
          </div>
        </div>

        <style>{`
          @keyframes explFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes explSpin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
};

export default CommandExplain;
