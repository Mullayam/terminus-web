import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, CornerDownLeft, Play, Copy, RefreshCw, X } from "lucide-react";
import { fetchAICommand } from "./aiCommand";
import { useTerminalStore } from "@/store/terminalStore";
import { stripAnsi } from "./aiCommand";

interface CommandPaletteProps {
  sessionId: string;
  /** Insert the command into the input without running it. */
  onInsert: (command: string) => void;
  /** Insert and execute the command. */
  onRun: (command: string) => void;
  onClose: () => void;
  bg: string;
  fg: string;
  accent: string;
  border: string;
  error: string;
}

/**
 * Ctrl+K natural-language command palette: type an intent, the model returns a
 * single runnable command which you can edit, insert, or run.
 */
const CommandPalette: React.FC<CommandPaletteProps> = ({ sessionId, onInsert, onRun, onClose, bg, fg, accent, border, error }) => {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setTimeout(() => queryRef.current?.focus(), 30); }, []);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const generate = useCallback(async () => {
    const intent = query.trim();
    if (!intent || loading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setErrMsg(null);
    try {
      const logs = useTerminalStore.getState().logs[sessionId] ?? [];
      const termContext = stripAnsi(logs.slice(-40).join("")).trim();
      const cmd = await fetchAICommand({
        sessionId,
        question: `Translate this request into a single shell command: "${intent}". Reply ONLY with the raw command — no explanation, no markdown, no code fences.`,
        context: termContext ? `Recent terminal output:\n${termContext}` : "",
        signal: controller.signal,
      });
      if (cmd) {
        setResult(cmd);
        setTimeout(() => resultRef.current?.focus(), 30);
      } else {
        setErrMsg("No command generated");
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setErrMsg("AI unavailable");
    } finally {
      setLoading(false);
    }
  }, [query, loading, sessionId]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "absolute", inset: 0, zIndex: 60,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh", background: "rgba(0,0,0,0.35)",
        animation: "paletteFade 0.12s ease-out",
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
        {/* Query row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
          <Sparkles size={16} style={{ color: accent, flexShrink: 0 }} />
          <input
            ref={queryRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); generate(); }
            }}
            placeholder="Describe what you want to do…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: fg, fontSize: 14 }}
          />
          {loading
            ? <Loader2 size={15} style={{ color: accent, animation: "paletteSpin 0.7s linear infinite", flexShrink: 0 }} />
            : <kbd style={{ fontSize: 10, color: `${fg}66`, border: `1px solid ${border}`, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>⏎</kbd>}
          <button onClick={onClose} title="Close (Esc)" style={{ display: "flex", background: "transparent", border: "none", color: `${fg}88`, cursor: "pointer", padding: 2 }}>
            <X size={15} />
          </button>
        </div>

        {errMsg && (
          <div style={{ padding: "8px 14px", fontSize: 12, color: error }}>{errMsg}</div>
        )}

        {/* Result row */}
        {result && (
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${accent}12`, border: `1px solid ${accent}40`, borderRadius: 8, padding: "8px 10px" }}>
              <span style={{ color: accent, fontFamily: "monospace", flexShrink: 0 }}>$</span>
              <input
                ref={resultRef}
                value={result}
                onChange={(e) => setResult(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") { e.preventDefault(); onRun(result); onClose(); }
                }}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: fg, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <PaletteBtn onClick={generate} fg={fg} border={border}><RefreshCw size={13} /> Regenerate</PaletteBtn>
              <PaletteBtn onClick={() => { navigator.clipboard.writeText(result).catch(() => {}); }} fg={fg} border={border}><Copy size={13} /> Copy</PaletteBtn>
              <PaletteBtn onClick={() => { onInsert(result); onClose(); }} fg={fg} border={border}><CornerDownLeft size={13} /> Insert</PaletteBtn>
              <PaletteBtn onClick={() => { onRun(result); onClose(); }} fg={bg} border={accent} bgColor={accent} primary><Play size={13} /> Run</PaletteBtn>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div style={{ padding: "10px 14px", fontSize: 11, color: `${fg}66` }}>
            Press <b style={{ color: `${fg}aa` }}>Enter</b> to generate a command from your description.
          </div>
        )}

        <style>{`
          @keyframes paletteFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes paletteSpin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
};

function PaletteBtn({ children, onClick, fg, border, bgColor, primary }: { children: React.ReactNode; onClick: () => void; fg: string; border: string; bgColor?: string; primary?: boolean; }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer",
        border: `1px solid ${border}`, background: bgColor ?? "transparent", color: fg,
        fontWeight: primary ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

export default CommandPalette;
