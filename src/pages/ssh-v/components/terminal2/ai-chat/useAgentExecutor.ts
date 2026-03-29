import { useCallback, useRef } from 'react';
import { useAIChatStore, type AgentStatus } from '@/store/aiChatStore';
import { useTerminalStore } from '@/store/terminalStore';
import { useSSHStore } from '@/store/sshStore';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { useAIChat, extractCommands } from './useAIChat';
import type { AgentAction } from '@/store/aiChatStore';

/** Max number of agent retry iterations per activation */
const DEFAULT_MAX_STEPS = 5;

/** How long to wait (ms) after executing a command before reading output */
const OUTPUT_SETTLE_MS = 3000;

/** Additional settle time per subsequent attempt (ms) */
const OUTPUT_SETTLE_EXTRA_MS = 1000;

/** Dangerous command patterns that should never be auto-executed */
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+\/(?:\s|$)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:(){ :\|:& };:/,           // fork bomb
  /\b>\s*\/dev\/sd/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  /\binit\s+0\b/i,
];

function isDangerous(cmd: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(cmd));
}

/** Strip ANSI escape sequences */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
}

/** Send a browser notification (if permitted and page is hidden) */
function notifyIfHidden(title: string, body: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  try {
    new Notification(title, { body, icon: '/favicon.ico' });
  } catch {
    // Notification API may be blocked in some contexts
  }
}

/** Request notification permission (call once from UI interaction) */
export function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function useAgentExecutor(sessionId: string) {
  const abortRef = useRef(false);
  const runningRef = useRef(false);
  const { sendMessage, getTerminalContext } = useAIChat(sessionId);

  const setAgentStatus = useAIChatStore((s) => s.setAgentStatus);
  const clearAgentStatus = useAIChatStore((s) => s.clearAgentStatus);

  /** Wait for terminal output to settle after command execution */
  const waitForOutput = useCallback(
    (prevLogLen: number, extraMs = 0): Promise<string> => {
      return new Promise((resolve) => {
        const deadline = OUTPUT_SETTLE_MS + extraMs;
        const start = Date.now();
        let lastLen = prevLogLen;

        const check = () => {
          if (abortRef.current) {
            resolve('');
            return;
          }
          const logs = useTerminalStore.getState().logs[sessionId] ?? [];
          const elapsed = Date.now() - start;

          if (logs.length > lastLen) {
            // New output appeared — reset settle timer
            lastLen = logs.length;
            if (elapsed < deadline + 5000) {
              setTimeout(check, 500);
              return;
            }
          }

          if (elapsed >= deadline) {
            // Grab new lines since command was sent
            const newLines = logs.slice(prevLogLen);
            resolve(stripAnsi(newLines.join('')).trim());
            return;
          }

          setTimeout(check, 500);
        };

        setTimeout(check, Math.min(deadline, 1500));
      });
    },
    [sessionId],
  );

  /** Execute a single command in the terminal */
  const executeCommand = useCallback(
    (cmd: string): number => {
      const socket = useSSHStore.getState().sessions[sessionId]?.socket;
      if (!socket) return 0;
      const logs = useTerminalStore.getState().logs[sessionId] ?? [];
      const prevLen = logs.length;
      socket.emit(SocketEventConstants.SSH_EMIT_INPUT, cmd + '\r');
      return prevLen;
    },
    [sessionId],
  );

  /**
   * Run the agentic execution loop:
   * 1. Gets commands from the last assistant message
   * 2. Executes them one by one
   * 3. Reads output, checks for errors
   * 4. If errors found, sends output back to AI to replan
   * 5. Repeats up to maxSteps times
   */
  const runAgentLoop = useCallback(
    async (commands: string[], maxSteps = DEFAULT_MAX_STEPS) => {
      if (runningRef.current) return;
      runningRef.current = true;
      abortRef.current = false;

      const { addAgentMessage, updateAgentMessage } = useAIChatStore.getState();

      /** Post or update an agent message in the chat */
      const postAgent = (
        content: string,
        action: AgentAction,
        extra?: { step?: number; command?: string; output?: string },
      ) => {
        return addAgentMessage(sessionId, content, {
          agentAction: action,
          agentStep: extra?.step ?? 1,
          agentMaxSteps: maxSteps,
          agentCommand: extra?.command,
          agentOutput: extra?.output,
        });
      };

      const updateStatus = (partial: Partial<AgentStatus>) => {
        const current = useAIChatStore.getState().agentStatus[sessionId];
        setAgentStatus(sessionId, {
          running: current?.running ?? true,
          step: current?.step ?? 1,
          maxSteps: current?.maxSteps ?? maxSteps,
          action: current?.action ?? '',
          ...partial,
        });
      };

      let currentCommands = commands;
      let step = 1;

      // Initial agent message
      postAgent(
        `Starting auto-execute — ${commands.length} command${commands.length > 1 ? 's' : ''} (max ${maxSteps} steps)`,
        'info',
        { step },
      );

      try {
        while (step <= maxSteps && !abortRef.current) {
          if (currentCommands.length === 0) {
            updateStatus({ action: 'No commands to execute', running: false });
            postAgent('No commands to execute.', 'info', { step });
            break;
          }

          // Filter out dangerous commands
          const safeCommands = currentCommands.filter((cmd) => {
            if (isDangerous(cmd)) {
              postAgent(`Blocked dangerous command: \`${cmd}\``, 'blocked', { step, command: cmd });
              return false;
            }
            return true;
          });

          if (safeCommands.length === 0) {
            updateStatus({ action: 'All commands blocked (dangerous)', running: false });
            notifyIfHidden('Terminus AI Agent', 'Dangerous commands were blocked.');
            break;
          }

          // Execute each command sequentially
          let lastOutput = '';
          for (let ci = 0; ci < safeCommands.length; ci++) {
            if (abortRef.current) break;
            const cmd = safeCommands[ci];

            updateStatus({
              step,
              action: `Running: ${cmd.slice(0, 60)}${cmd.length > 60 ? '…' : ''}`,
              lastResult: 'running',
            });

            // Post "executing" message in chat
            const execMsgId = postAgent(
              `Executing command...`,
              'executing',
              { step, command: cmd },
            );

            const prevLen = executeCommand(cmd);
            const output = await waitForOutput(prevLen, step * OUTPUT_SETTLE_EXTRA_MS);
            lastOutput = output;

            // Update the message with the captured output
            updateAgentMessage(sessionId, execMsgId, output ? 'Command completed' : 'Command completed (no output)', {
              agentAction: 'waiting',
              agentStep: step,
              agentMaxSteps: maxSteps,
              agentCommand: cmd,
              agentOutput: output.slice(0, 1500) || undefined,
            });
          }

          if (abortRef.current) break;

          // Check if output looks like an error
          const hasError = detectError(lastOutput);

          if (!hasError) {
            // Success — done
            updateStatus({
              step,
              action: 'Completed successfully',
              lastResult: 'success',
              running: false,
            });
            postAgent(
              `All commands completed successfully.`,
              'success',
              { step },
            );
            notifyIfHidden(
              'Terminus AI Agent',
              `Commands completed successfully (step ${step}/${maxSteps}).`,
            );
            break;
          }

          // Error detected — replan
          if (step >= maxSteps) {
            updateStatus({
              step,
              action: `Max retries reached (${maxSteps})`,
              lastResult: 'error',
              running: false,
            });
            postAgent(
              `Max retries reached (${maxSteps}). Manual intervention needed.`,
              'error',
              { step, output: lastOutput.slice(0, 800) },
            );
            notifyIfHidden(
              'Terminus AI Agent',
              `Stopped after ${maxSteps} attempts. Manual intervention needed.`,
            );
            break;
          }

          postAgent(
            `Error detected in output — replanning (step ${step + 1}/${maxSteps})...`,
            'replanning',
            { step, output: lastOutput.slice(0, 800) },
          );

          updateStatus({
            step,
            action: 'Error detected, replanning…',
            lastResult: 'error',
          });

          // Send the error output back to AI for replanning
          step++;
          const replanPrompt =
            `The previous command(s) failed. Here is the terminal output:\n\`\`\`\n${lastOutput.slice(0, 2000)}\n\`\`\`\n\nPlease analyze the error and provide corrected command(s) to fix the issue. Only provide shell commands in code blocks.`;

          // Wait for AI response — sendMessage is async and will add the response to the store
          await sendMessage(replanPrompt);

          // Extract commands from the latest assistant message
          const state = useAIChatStore.getState();
          const session = state.sessions[sessionId];
          if (!session) break;
          const lastMsg = session.messages[session.messages.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant') break;

          currentCommands = extractCommands(lastMsg.content);
          if (currentCommands.length === 0) {
            updateStatus({
              step,
              action: 'AI provided no new commands',
              running: false,
            });
            postAgent('AI provided no new commands to try.', 'info', { step });
            notifyIfHidden('Terminus AI Agent', 'AI could not provide a fix.');
            break;
          }
        }
      } finally {
        runningRef.current = false;
        const status = useAIChatStore.getState().agentStatus[sessionId];
        if (status?.running) {
          setAgentStatus(sessionId, { ...status, running: false });
        }
      }

      // Stopped by user
      if (abortRef.current) {
        postAgent('Agent stopped by user.', 'stopped', { step });
      }
    },
    [sessionId, executeCommand, waitForOutput, sendMessage, setAgentStatus],
  );

  const stopAgent = useCallback(() => {
    abortRef.current = true;
    const status = useAIChatStore.getState().agentStatus[sessionId];
    if (status) {
      setAgentStatus(sessionId, { ...status, running: false, action: 'Stopped by user' });
    }
  }, [sessionId, setAgentStatus]);

  return { runAgentLoop, stopAgent, requestNotificationPermission };
}

/** Heuristic: does terminal output contain error indicators? */
function detectError(output: string): boolean {
  if (!output) return false;
  const lower = output.toLowerCase();
  const errorPatterns = [
    'error:',
    'error -',
    'fatal:',
    'failed',
    'command not found',
    'no such file or directory',
    'permission denied',
    'segmentation fault',
    'syntax error',
    'traceback (most recent call last)',
    'exception:',
    'panic:',
    'cannot ',
    'unable to',
    'not found',
    'errno',
  ];
  return errorPatterns.some((p) => lower.includes(p));
}
