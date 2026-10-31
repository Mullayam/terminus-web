// ─────────────────────────────────────────────────────────────
// AI Agent v2 — React bridge to the REAL `/ai-agent` namespace
//
// Owns the transcript + run lifecycle. `ingest` is the `@@AI_AGENT_EVENT`
// handler; prompts/confirms/aborts are emitted over the live socket and
// settings/model come from `/api/ai/agent/*`. Events are filtered by sessionId
// since the namespace socket is shared across terminal tabs.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentEvent, AgentModelCatalog, ConfirmRequest, TranscriptItem } from './types';
import { toText } from './constants';
import {
  EMPTY_CATALOG,
  emitAbort,
  emitConfirmReply,
  emitPrompt,
  fetchAgentModels,
  fetchAgentSettings,
  getAgentSocket,
  isAgentConnected,
  onAgentEvent,
  onConfirmRequest,
  onConnectionChange,
  updateAgentSettings,
} from './agentSocket';

let _tid = 0;
const tid = (p: string) => `${p}_${Date.now().toString(36)}_${(_tid++).toString(36)}`;

export function useAgentV2(sessionId: string) {
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [autoMode, setAutoModeState] = useState(false);
  const [model, setModelState] = useState<string>('');
  const [catalog, setCatalog] = useState<AgentModelCatalog>(EMPTY_CATALOG);
  const [connected, setConnected] = useState(isAgentConnected());
  const [error, setError] = useState<string | null>(null);

  // Append or merge a server event into the transcript (the "reducer").
  const ingest = useCallback((e: AgentEvent) => {
    setTranscript((prev) => {
      const next = prev.slice();
      const p = e.payload ?? {};
      switch (e.kind) {
        case 'MESSAGE': {
          const last = next[next.length - 1];
          const text = toText(p.text);
          // Consecutive MESSAGE events append to the same bubble.
          if (last && last.type === 'message') {
            next[next.length - 1] = { ...last, text: last.text + text };
          } else {
            next.push({ id: tid('m'), type: 'message', role: 'assistant', text, ts: e.ts });
          }
          break;
        }
        case 'COMMAND':
          next.push({ id: tid('cmd'), type: 'command', command: toText(p.command), ts: e.ts });
          break;
        case 'EXECUTE_TASK':
          next.push({ id: tid('task'), type: 'task', task: toText(p.task), ts: e.ts });
          break;
        case 'OUTPUT':
          next.push({
            id: tid('out'),
            type: 'output',
            command: toText(p.command),
            output: toText(p.output),
            exitCode: typeof p.exitCode === 'number' ? p.exitCode : 0,
            timedOut: !!p.timedOut,
            ts: e.ts,
          });
          break;
        case 'DANGEROUS':
          next.push({
            id: tid('dng'),
            type: 'dangerous',
            command: toText(p.command),
            reason: toText(p.reason),
            level: p.level === 'blocked' ? 'blocked' : 'confirm',
            ts: e.ts,
          });
          break;
        case 'ERROR':
          next.push({ id: tid('err'), type: 'error', error: toText(p.error) || 'Unknown error', ts: e.ts });
          break;
        case 'DONE':
          next.push({ id: tid('done'), type: 'done', stopped: p.stopped === true, ts: e.ts });
          break;
      }
      return next;
    });

    if (e.kind === 'DONE') {
      setRunning(false);
      setConfirm(null);
    }
  }, []);

  // ── Subscribe to the live namespace; connect, fetch catalog + settings ──
  useEffect(() => {
    getAgentSocket(); // ensure connection is initiated
    setConnected(isAgentConnected());

    const offConn = onConnectionChange(setConnected);

    const offEvent = onAgentEvent((e) => {
      // Namespace socket is shared across tabs — ignore other sessions'.
      if (e.sessionId && e.sessionId !== sessionId) return;
      if (e.kind === 'ERROR') setError(toText(e.payload?.error) || 'Agent error');
      ingest(e);
    });

    const offConfirm = onConfirmRequest((req) => {
      if (req.sessionId && req.sessionId !== sessionId) return;
      // Coerce fields — they're rendered directly in the dialog.
      setConfirm({
        confirmId: toText((req as any).confirmId),
        sessionId: toText((req as any).sessionId),
        command: toText((req as any).command),
        reason: toText((req as any).reason),
        level: (req as any).level === 'blocked' ? 'blocked' : 'confirm',
      });
    });

    return () => {
      offConn();
      offEvent();
      offConfirm();
    };
  }, [sessionId, ingest]);

  // Model catalog (once).
  useEffect(() => {
    const ac = new AbortController();
    fetchAgentModels(ac.signal)
      .then(setCatalog)
      .catch((err) => {
        if (!ac.signal.aborted) setError(err?.message ?? 'Failed to load models');
      });
    return () => ac.abort();
  }, []);

  // Per-session settings (autoMode, model).
  useEffect(() => {
    const ac = new AbortController();
    fetchAgentSettings(sessionId, ac.signal)
      .then((s) => {
        if (ac.signal.aborted) return;
        if (typeof s.autoMode === 'boolean') setAutoModeState(s.autoMode);
        if (s.model) setModelState(s.model);
      })
      .catch(() => {/* settings are optional — fall back to defaults */});
    return () => ac.abort();
  }, [sessionId]);

  const sendPrompt = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || running) return;
      setError(null);
      setTranscript((prev) => [...prev, { id: tid('u'), type: 'user', text: trimmed, ts: Date.now() }]);
      setRunning(true);
      setConfirm(null);
      emitPrompt(sessionId, trimmed, model || undefined);
    },
    [sessionId, model, running],
  );

  const replyConfirm = useCallback((confirmId: string, approved: boolean) => {
    // Mark the most recent unresolved DANGEROUS entry in the transcript.
    setTranscript((prev) => {
      const next = prev.slice();
      for (let i = next.length - 1; i >= 0; i--) {
        const it = next[i];
        if (it.type === 'dangerous' && !it.resolved) {
          next[i] = { ...it, resolved: approved ? 'approved' : 'denied' };
          break;
        }
      }
      return next;
    });
    setConfirm(null);
    emitConfirmReply(confirmId, approved);
  }, []);

  const abort = useCallback(() => {
    emitAbort(sessionId);
    setConfirm(null);
    // The turn ends for real when the server sends DONE { stopped: true }.
  }, [sessionId]);

  const clear = useCallback(() => {
    if (running) emitAbort(sessionId);
    setTranscript([]);
    setRunning(false);
    setConfirm(null);
    setError(null);
  }, [sessionId, running]);

  const setAutoMode = useCallback(
    (next: boolean) => {
      setAutoModeState(next);
      updateAgentSettings({ sessionId, autoMode: next }).catch((err) =>
        setError(err?.message ?? 'Failed to update auto-mode'),
      );
    },
    [sessionId],
  );

  const setModel = useCallback(
    (next: string) => {
      setModelState(next);
      updateAgentSettings({ sessionId, model: next }).catch((err) =>
        setError(err?.message ?? 'Failed to update model'),
      );
    },
    [sessionId],
  );

  return {
    transcript,
    running,
    confirm,
    autoMode,
    model,
    catalog,
    connected,
    error,
    setAutoMode,
    setModel,
    sendPrompt,
    replyConfirm,
    abort,
    clear,
  };
}
