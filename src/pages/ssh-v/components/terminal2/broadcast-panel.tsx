import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, History, Radio, RotateCcw, Send, X } from "lucide-react";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useSSHStore } from "@/store/sshStore";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { ActionBtn, Chip, IconBtn } from "./widget-parts";
import { sendToTerminal } from "./widget-utils";
import { commandLines, detectDanger } from "./broadcast-utils";
import type { PanelProps } from "./panels";

interface HistoryEntry {
  command: string;
  targets: string[];
  at: number;
}

/** Last broadcasts per originating session — memory only, gone on reload. */
const historyBySession = new Map<string, HistoryEntry[]>();
const HISTORY_MAX = 10;

interface Target {
  sessionId: string;
  title: string;
  host: string;
  username: string;
  connected: boolean;
}

interface Review {
  lines: string[];
  targets: Target[];
  danger: string[];
}

export default function BroadcastPanel({ sessionId, onClose }: PanelProps) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;

  const tabs = useSSHStore((s) => s.tabs);
  const sessions = useSSHStore((s) => s.sessions);

  const targets: Target[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Target[] = [];
    for (const t of tabs) {
      const s = sessions[t.sessionId];
      if (!s || seen.has(t.sessionId)) continue;
      seen.add(t.sessionId);
      out.push({
        sessionId: t.sessionId,
        title: t.title,
        host: s.host,
        username: s.username,
        connected: s.status === "connected" && !!s.socket?.connected,
      });
    }
    return out;
  }, [tabs, sessions]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set([sessionId]));
  const [command, setCommand] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [typed, setTyped] = useState("");
  const [results, setResults] = useState<{ title: string; ok: boolean }[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => historyBySession.get(sessionId) ?? []);
  const [showHistory, setShowHistory] = useState(false);

  // Only connected sessions can stay selected.
  const connectedIds = useMemo(() => new Set(targets.filter((t) => t.connected).map((t) => t.sessionId)), [targets]);
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => connectedIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [connectedIds]);

  const chosen = targets.filter((t) => t.connected && selected.has(t.sessionId));
  const allSelected = connectedIds.size > 0 && chosen.length === connectedIds.size;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const deliver = (lines: string[], to: Target[]) => {
    const out: { title: string; ok: boolean }[] = [];
    for (const t of to) {
      const sock = useSSHStore.getState().sessions[t.sessionId]?.socket;
      const ok = !!sock?.connected;
      if (ok) for (const line of lines) sendToTerminal(sock, line);
      out.push({ title: `${t.title} (${t.username}@${t.host})`, ok });
    }
    setResults(out);
    const entry: HistoryEntry = { command: lines.join("\n"), targets: to.map((t) => t.sessionId), at: Date.now() };
    const next = [entry, ...(historyBySession.get(sessionId) ?? [])].slice(0, HISTORY_MAX);
    historyBySession.set(sessionId, next);
    setHistory(next);
    setReview(null);
    setTyped("");
  };

  const startReview = () => {
    const lines = commandLines(command);
    if (!lines.length || !chosen.length) return;
    const danger = detectDanger(command);
    setResults(null);
    // A safe command to a single host goes straight through.
    if (!danger.length && chosen.length === 1) {
      deliver(lines, chosen);
      return;
    }
    setTyped("");
    setReview({ lines, targets: chosen, danger });
  };

  const resend = (h: HistoryEntry) => {
    setCommand(h.command);
    setSelected(new Set(h.targets.filter((id) => connectedIds.has(id))));
    setShowHistory(false);
    setReview(null);
    setResults(null);
  };

  const needsTyped = !!review && review.danger.length > 0;
  const confirmReady = !review ? false : needsTyped ? typed.trim() === String(review.targets.length) : true;

  return (
    <FloatingPanel
      title="Broadcast"
      icon={<Radio size={15} />}
      subtitle={`${chosen.length} of ${connectedIds.size} connected selected`}
      width={440}
      offset={{ right: 140, top: 140 }}
      onClose={onClose}
      actions={
        <IconBtn fg={fg} title="Recent broadcasts" onClick={() => setShowHistory((v) => !v)} disabled={!history.length}>
          <History size={14} />
        </IconBtn>
      }
      footer={<span>Each line is typed into every selected tab's terminal. Output stays in each tab.</span>}
    >
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1, minHeight: 0 }} className="scrollbar-green">
        {/* History */}
        {showHistory && history.length > 0 && (
          <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {history.map((h) => (
              <div key={h.at} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5 }}>
                <code style={{ flex: 1, minWidth: 0, color: `${fg}cc`, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h.command}>
                  {h.command.replace(/\n/g, " ⏎ ")}
                </code>
                <span style={{ color: `${fg}55`, whiteSpace: "nowrap" }}>{h.targets.length} host{h.targets.length === 1 ? "" : "s"} · {new Date(h.at).toLocaleTimeString()}</span>
                <IconBtn fg={fg} title="Load again (re-checks targets & safety)" onClick={() => resend(h)}><RotateCcw size={12} /></IconBtn>
              </div>
            ))}
          </div>
        )}

        {/* Targets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: `${fg}66` }}>Send to</span>
            <div style={{ flex: 1 }} />
            <Chip
              fg={fg} border={border} accent={colors.blue} active={allSelected}
              onClick={() => setSelected(allSelected ? new Set() : new Set(connectedIds))}
            >
              {allSelected ? "Clear" : "Select all connected"}
            </Chip>
          </div>
          {targets.length === 0 ? (
            <PanelMessage>No SSH tabs open.</PanelMessage>
          ) : (
            targets.map((t) => {
              const on = t.connected && selected.has(t.sessionId);
              return (
                <label
                  key={t.sessionId}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7,
                    border: `1px solid ${on ? `${colors.blue}66` : border}`, background: on ? `${colors.blue}10` : `${fg}06`,
                    cursor: t.connected ? "pointer" : "not-allowed", opacity: t.connected ? 1 : 0.5,
                  }}
                >
                  <input type="checkbox" checked={on} disabled={!t.connected} onChange={() => toggle(t.sessionId)} style={{ accentColor: colors.blue }} />
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: t.connected ? colors.green : `${fg}44` }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  <span style={{ fontSize: 10, color: `${fg}77`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.username}@{t.host}</span>
                  {t.sessionId === sessionId && <span style={{ marginLeft: "auto", fontSize: 9, color: `${fg}66` }}>this tab</span>}
                  {!t.connected && <span style={{ marginLeft: "auto", fontSize: 9, color: `${fg}66` }}>offline</span>}
                </label>
              );
            })
          )}
        </div>

        {/* Command */}
        <textarea
          value={command}
          onChange={(e) => { setCommand(e.target.value); setReview(null); setResults(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); startReview(); } }}
          placeholder={"Command(s) to run — one per line\nCtrl+Enter to send"}
          rows={3}
          spellCheck={false}
          style={{
            width: "100%", fontSize: 11.5, color: fg, background: `${fg}0a`, border: `1px solid ${border}`,
            borderRadius: 7, padding: "6px 8px", outline: "none", resize: "vertical", fontFamily: "ui-monospace, monospace",
          }}
        />

        {!review && (
          <div style={{ display: "flex", gap: 6 }}>
            <ActionBtn
              label={chosen.length > 1 ? `Review & send to ${chosen.length} hosts` : "Send"}
              icon={<Send size={12} />}
              disabled={!commandLines(command).length || !chosen.length}
              onClick={startReview}
              fg={fg} border={border} accent={colors.green}
            />
          </div>
        )}

        {/* Review / confirm */}
        {review && (
          <div style={{
            border: `1px solid ${review.danger.length ? `${colors.red}77` : `${colors.yellow}66`}`,
            background: review.danger.length ? `${colors.red}12` : `${colors.yellow}0e`,
            borderRadius: 8, padding: 9, display: "flex", flexDirection: "column", gap: 7,
          }}>
            {review.danger.length > 0 && (
              <div style={{ display: "flex", gap: 6, fontSize: 11, color: colors.red }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Destructive command</div>
                  <div style={{ color: `${fg}aa`, fontSize: 10.5 }}>{review.danger.join(" · ")}</div>
                </div>
              </div>
            )}
            <div style={{ fontSize: 10.5, color: `${fg}aa` }}>
              {review.lines.length} line{review.lines.length === 1 ? "" : "s"} will be typed into {review.targets.length} terminal{review.targets.length === 1 ? "" : "s"}:
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10.5, color: fg, display: "flex", flexDirection: "column", gap: 1 }}>
              {review.targets.map((t) => <li key={t.sessionId}>{t.title} <span style={{ color: `${fg}77` }}>({t.username}@{t.host})</span></li>)}
            </ul>
            <code style={{ fontSize: 10.5, color: colors.green, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", background: `${fg}0a`, borderRadius: 5, padding: "4px 6px" }}>
              {review.lines.map((l) => `$ ${l}`).join("\n")}
            </code>
            {needsTyped && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: `${fg}cc` }}>
                Type <b style={{ color: colors.red }}>{review.targets.length}</b> (number of hosts) to confirm
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && confirmReady) deliver(review.lines, review.targets); }}
                  style={{ width: 56, fontSize: 11, color: fg, background: `${fg}0a`, border: `1px solid ${border}`, borderRadius: 5, padding: "2px 6px", outline: "none" }}
                />
              </label>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <ActionBtn
                label={`Send to ${review.targets.length} host${review.targets.length === 1 ? "" : "s"}`}
                icon={<Send size={12} />}
                disabled={!confirmReady}
                onClick={() => deliver(review.lines, review.targets)}
                fg={fg} border={border} accent={review.danger.length ? colors.red : colors.green}
              />
              <ActionBtn label="Cancel" icon={<X size={12} />} onClick={() => setReview(null)} fg={fg} border={border} accent={fg} />
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {results.map((r) => (
              <div key={r.title} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: r.ok ? `${fg}bb` : colors.red }}>
                {r.ok ? <Check size={12} style={{ color: colors.green }} /> : <X size={12} />}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                <span style={{ marginLeft: "auto", color: `${fg}66` }}>{r.ok ? "sent" : "not connected"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </FloatingPanel>
  );
}
