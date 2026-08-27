import { useCallback, useEffect, useRef } from 'react';
import { runAgent, postAgentResult, DEFAULT_TOOL_TIMEOUT_MS } from '@/lib/agent/client';
import type { AgentEvent, AgentRunBody, AgentSpec, ToolRisk } from '@/lib/agent/types';
import {
  DEFAULT_AGENT_NAME,
  useAgentRunStore,
  type AgentToolCall,
} from '@/store/agentRunStore';
import { useAIChatStore } from '@/store/aiChatStore';
import { useTerminalStore } from '@/store/terminalStore';
import { execInTerminal, interruptTerminal } from './terminalExec';
import stripAnsi from 'strip-ansi';

/** Output posted back to the model is capped so the next turn stays small. */
const MAX_OUTPUT_CHARS = 4000;
/** Terminal buffer sent as `context`. */
const MAX_CONTEXT_CHARS = 50000;

/** Resolvers for tool calls awaiting the user's Approve/Deny, keyed by callId. */
const pendingApprovals = new Map<string, (approved: boolean) => void>();

/** Called from the UI when the user clicks Approve/Deny on a proposed command. */
export function resolveToolApproval(callId: string, approved: boolean) {
  pendingApprovals.get(callId)?.(approved);
}

export function hasPendingApproval(callId: string): boolean {
  return pendingApprovals.has(callId);
}

function awaitApproval(callId: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (approved: boolean) => {
      clearTimeout(timer);
      pendingApprovals.delete(callId);
      resolve(approved);
    };
    // Approving after the backend stopped waiting is pointless — auto-decline.
    const timer = setTimeout(() => done(false), timeoutMs);
    pendingApprovals.set(callId, done);
  });
}

export function useServerAgent(sessionId: string) {
  const abortRef = useRef<AbortController | null>(null);
  /** Serializes tool execution — the terminal can only run one command at a time. */
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    pendingApprovals.forEach((resolve) => resolve(false));
    pendingApprovals.clear();
    interruptTerminal(sessionId);
    const runs = useAgentRunStore.getState().runs[sessionId] ?? {};
    for (const name of Object.keys(runs)) {
      if (runs[name].running) useAgentRunStore.getState().endRun(sessionId, name, 'Stopped by user');
    }
  }, [sessionId]);

  // The backend only stops a run once the socket actually closes.
  useEffect(() => () => abortRef.current?.abort(), []);

  const buildContext = useCallback(() => {
    const logs = useTerminalStore.getState().logs[sessionId] ?? [];
    const screen = useAIChatStore.getState().terminalContent[sessionId] ?? '';
    const buffer = stripAnsi(logs.join('')).trim() || screen;
    return buffer.slice(-MAX_CONTEXT_CHARS);
  }, [sessionId]);

  const handleToolCall = useCallback(
    (event: Extract<AgentEvent, { type: 'tool_call' }>, agentName: string, signal: AbortSignal) => {
      const store = useAgentRunStore.getState();
      const config = store.getConfig(sessionId);
      const timeoutMs = event.timeoutMs ?? config.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
      const risk: ToolRisk = event.risk ?? 'medium';
      const needsApproval =
        event.requiresApproval ??
        (risk === 'dangerous' || (risk === 'medium' && !config.autoApproveMedium) || !config.autoRunSafe);

      const call: AgentToolCall = {
        callId: event.callId,
        name: event.name,
        command: event.command,
        purpose: event.purpose,
        risk,
        requiresApproval: needsApproval,
        reason: event.reason,
        timeoutMs,
        deadline: Date.now() + timeoutMs,
        status: needsApproval ? 'awaiting-approval' : 'running',
      };
      store.upsertToolCall(sessionId, agentName, call);

      // Chain onto the queue: several tool_calls can arrive before any result,
      // but they must hit the terminal one at a time.
      queueRef.current = queueRef.current.then(async () => {
        if (signal.aborted) return;
        const patch = useAgentRunStore.getState().patchToolCall;

        if (needsApproval) {
          const approved = await awaitApproval(event.callId, Math.max(0, call.deadline - Date.now()));
          if (!approved) {
            patch(sessionId, agentName, event.callId, { status: 'declined' });
            await postAgentResult({ callId: event.callId, declined: true }).catch(() => {});
            return;
          }
        }
        if (signal.aborted) return;

        patch(sessionId, agentName, event.callId, { status: 'running' });
        // Leave room for the round trip so the result lands before the backend gives up.
        const budget = Math.max(2000, call.deadline - Date.now() - 1500);
        const { output, exitCode } = await execInTerminal(sessionId, event.command, budget, signal);
        const trimmed = output.slice(0, MAX_OUTPUT_CHARS);

        patch(sessionId, agentName, event.callId, {
          status: 'done',
          output: trimmed,
          exitCode,
          ok: exitCode === undefined ? undefined : exitCode === 0,
        });
        useAgentRunStore.getState().patchRun(sessionId, agentName, {
          planDone: Math.min(
            (useAgentRunStore.getState().runs[sessionId]?.[agentName]?.planDone ?? 0) + 1,
            useAgentRunStore.getState().runs[sessionId]?.[agentName]?.plan.length ?? 0,
          ),
        });

        const accepted = await postAgentResult({ callId: event.callId, output: trimmed, exitCode }).catch(() => false);
        if (!accepted) patch(sessionId, agentName, event.callId, { status: 'failed' });
      });
    },
    [sessionId],
  );

  const run = useCallback(
    async (input: string, opts?: { agents?: AgentSpec[]; history?: AgentRunBody['history'] }) => {
      const store = useAgentRunStore.getState();
      const config = store.getConfig(sessionId);
      const names = opts?.agents?.length ? opts.agents.map((a) => a.name) : [DEFAULT_AGENT_NAME];

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      queueRef.current = Promise.resolve();

      store.setLastInput(sessionId, input);
      names.forEach((name) => store.startRun(sessionId, name));

      const body: AgentRunBody = {
        input,
        mode: config.mode,
        providerId: config.providerId || 'auto',
        context: buildContext(),
        history: opts?.history,
        maxSteps: config.maxSteps,
        toolTimeoutMs: config.toolTimeoutMs,
        autoApproveMedium: config.autoApproveMedium,
        denyDangerous: config.denyDangerous,
      };
      if (config.profile !== 'auto') body.profile = config.profile;
      if (config.model) body.model = config.model;
      if (opts?.agents?.length) body.agents = opts.agents;

      const nameFor = (event: AgentEvent) => (event.agent && names.includes(event.agent) ? event.agent : names[0]);

      try {
        await runAgent(
          body,
          (event) => {
            const s = useAgentRunStore.getState();
            const agentName = nameFor(event);
            if (!s.runs[sessionId]?.[agentName]) s.startRun(sessionId, agentName);

            switch (event.type) {
              case 'status':
                s.patchRun(sessionId, agentName, { statusMessage: event.message });
                break;
              case 'routing': {
                const { type: _t, agent: _a, ...routing } = event as any;
                s.patchRun(sessionId, agentName, { routing });
                break;
              }
              case 'plan':
                s.patchRun(sessionId, agentName, { plan: event.steps ?? [], planDone: 0 });
                break;
              case 'chunk':
                s.appendChunk(sessionId, agentName, event.text ?? '');
                break;
              case 'tool_call':
                handleToolCall(event, agentName, controller.signal);
                break;
              case 'tool_result':
                s.patchToolCall(sessionId, agentName, event.callId, {
                  status: event.declined ? 'declined' : 'done',
                  ok: event.ok,
                  output: event.output ?? undefined,
                });
                break;
              case 'final':
                s.patchRun(sessionId, agentName, { finalText: event.text, statusMessage: 'Finished' });
                break;
              case 'error':
                s.patchRun(sessionId, agentName, { error: event.message });
                break;
              case 'done':
                s.endRun(sessionId, agentName);
                break;
            }
          },
          controller.signal,
        );
        names.forEach((name) => useAgentRunStore.getState().endRun(sessionId, name));
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        names.forEach((name) =>
          useAgentRunStore.getState().endRun(sessionId, name, err?.message ?? 'Agent run failed'),
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [sessionId, buildContext, handleToolCall],
  );

  return { run, stop, resolveToolApproval };
}
