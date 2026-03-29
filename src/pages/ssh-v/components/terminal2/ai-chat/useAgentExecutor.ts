import { useCallback, useRef } from 'react';
import { useAIChatStore, type AgentStatus } from '@/store/aiChatStore';
import { useTerminalStore } from '@/store/terminalStore';
import { useSSHStore } from '@/store/sshStore';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { useAIChat, extractCommands } from './useAIChat';
import type { AgentAction } from '@/store/aiChatStore';

/** Max number of agent retry iterations per activation */
const DEFAULT_MAX_STEPS = 25;

/** How long to wait (ms) after executing a command before reading output */
const OUTPUT_SETTLE_MS = 15000;

/** Max total wait before sending Ctrl+C (ms) */
const OUTPUT_MAX_WAIT_MS = 30000;

/** Additional settle time per subsequent attempt (ms) */
const OUTPUT_SETTLE_EXTRA_MS = 500;

/** The system prompt that tells AI to work step-by-step */
const STEP_BY_STEP_PROMPT = `You are an AI agent connected to a user's SSH terminal. You can see their terminal output and execute commands.

CRITICAL RULES — READ FIRST:
- If the user asks a QUESTION ("what's on my screen", "explain this error", "what happened") → Answer directly from the terminal context already provided. Do NOT run any commands. Just answer.
- If the user says to RUN a specific command ("run docker ps", "execute ls -la") → Run EXACTLY that command. Nothing else before or after.
- If the user asks to DO a task ("install nginx", "restart the app") → Run ONLY the minimum commands needed. No exploration first.
- NEVER run exploratory/info commands (pwd, whoami, ls, hostname, uname, cat /etc/os-release) unless the user explicitly asked.
- Do EXACTLY what the user asked. Nothing more, nothing less. No "let me check first" steps.

WHEN RUNNING COMMANDS:
- Provide EXACTLY ONE shell command per response in a \`\`\`bash code block.
- NEVER guess or fabricate data. Use real output from previous commands.
- After I show you command output, decide the next step based on REAL data.
- When the task is FULLY DONE, end your response with the summary only.
- If stuck or need user input, explain what you need.
- If a command fails, analyze the error and provide a corrected command.

FORMAT when running a command:
**Step N: <brief description>**
\`\`\`bash
<single command>
\`\`\`

FORMAT when answering without commands (questions, done, blocked):
Just provide your answer naturally. No special tokens needed.`;

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

  /** Wait for terminal output to settle after command execution.
   *  Waits up to OUTPUT_MAX_WAIT_MS; if still producing output, sends Ctrl+C. */
  const waitForOutput = useCallback(
    (prevLogLen: number, extraMs = 0): Promise<string> => {
      return new Promise((resolve) => {
        const settleTime = OUTPUT_SETTLE_MS + extraMs;
        const hardDeadline = OUTPUT_MAX_WAIT_MS + extraMs;
        const start = Date.now();
        let lastLen = prevLogLen;
        let lastChangeTime = start;
        let ctrlCSent = false;

        const check = () => {
          if (abortRef.current) {
            resolve('');
            return;
          }
          const logs = useTerminalStore.getState().logs[sessionId] ?? [];
          const elapsed = Date.now() - start;
          const sinceLast = Date.now() - lastChangeTime;

          if (logs.length > lastLen) {
            lastLen = logs.length;
            lastChangeTime = Date.now();
          }

          // Hard deadline: if still getting output, send Ctrl+C and collect what we have
          if (elapsed >= hardDeadline && !ctrlCSent) {
            ctrlCSent = true;
            const socket = useSSHStore.getState().sessions[sessionId]?.socket;
            if (socket) socket.emit(SocketEventConstants.SSH_EMIT_INPUT, '\x03');
            // Wait 2s for Ctrl+C to take effect, then resolve
            setTimeout(() => {
              const finalLogs = useTerminalStore.getState().logs[sessionId] ?? [];
              const newLines = finalLogs.slice(prevLogLen);
              resolve(stripAnsi(newLines.join('')).trim());
            }, 2000);
            return;
          }

          // Settle: no new output for settleTime → done
          if (sinceLast >= settleTime && elapsed >= settleTime) {
            const newLines = logs.slice(prevLogLen);
            resolve(stripAnsi(newLines.join('')).trim());
            return;
          }

          setTimeout(check, 500);
        };

        setTimeout(check, 1500);
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
   * Run the agentic execution loop (batch mode):
   * Gets pre-extracted commands and runs them, replanning on error.
   * Use runStepByStepLoop() for multi-step tasks that need real output between steps.
   */
  const runAgentLoop = useCallback(
    async (commands: string[], maxSteps = DEFAULT_MAX_STEPS) => {
      if (runningRef.current) return;
      runningRef.current = true;
      abortRef.current = false;

      const { addAgentMessage, updateAgentMessage } = useAIChatStore.getState();

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

          let lastOutput = '';
          for (let ci = 0; ci < safeCommands.length; ci++) {
            if (abortRef.current) break;
            const cmd = safeCommands[ci];

            updateStatus({ step, action: `Running: ${cmd.slice(0, 60)}${cmd.length > 60 ? '…' : ''}`, lastResult: 'running' });

            const execMsgId = postAgent('Executing command...', 'executing', { step, command: cmd });
            const prevLen = executeCommand(cmd);
            const output = await waitForOutput(prevLen, step * OUTPUT_SETTLE_EXTRA_MS);
            lastOutput = output;

            updateAgentMessage(sessionId, execMsgId, output ? 'Command completed' : 'Command completed (no output)', {
              agentAction: 'waiting',
              agentStep: step,
              agentMaxSteps: maxSteps,
              agentCommand: cmd,
              agentOutput: output.slice(0, 1500) || undefined,
            });
          }

          if (abortRef.current) break;

          const hasError = detectError(lastOutput);
          if (!hasError) {
            updateStatus({ step, action: 'Completed successfully', lastResult: 'success', running: false });
            postAgent('All commands completed successfully.', 'success', { step });
            notifyIfHidden('Terminus AI Agent', `Commands completed successfully (step ${step}/${maxSteps}).`);
            break;
          }

          if (step >= maxSteps) {
            updateStatus({ step, action: `Max retries reached (${maxSteps})`, lastResult: 'error', running: false });
            postAgent(`Max retries reached (${maxSteps}). Manual intervention needed.`, 'error', { step, output: lastOutput.slice(0, 800) });
            notifyIfHidden('Terminus AI Agent', `Stopped after ${maxSteps} attempts.`);
            break;
          }

          postAgent(`Error detected — replanning (step ${step + 1}/${maxSteps})...`, 'replanning', { step, output: lastOutput.slice(0, 800) });
          updateStatus({ step, action: 'Error detected, replanning…', lastResult: 'error' });

          step++;
          const replanPrompt = `The previous command(s) failed. Here is the terminal output:\n\`\`\`\n${lastOutput.slice(0, 2000)}\n\`\`\`\n\nPlease analyze the error and provide corrected command(s) to fix the issue. Only provide shell commands in code blocks.`;
          await sendMessage(replanPrompt, undefined, { displayContent: null });

          const state = useAIChatStore.getState();
          const session = state.sessions[sessionId];
          if (!session) break;
          const lastMsg = session.messages[session.messages.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant') break;

          currentCommands = extractCommands(lastMsg.content);
          if (currentCommands.length === 0) {
            updateStatus({ step, action: 'AI provided no new commands', running: false });
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

      if (abortRef.current) {
        postAgent('Agent stopped by user.', 'stopped', { step });
      }
    },
    [sessionId, executeCommand, waitForOutput, sendMessage, setAgentStatus],
  );

  /**
   * Step-by-step agentic loop:
   * Sends the user's task to AI with a system prompt that instructs it to
   * return ONE command at a time. Executes each command, feeds real output
   * back to AI, and lets AI decide the next step based on real data.
   *
   * Flow: user task → AI gives cmd 1 → execute → output → AI gives cmd 2 → …
   * Ends when AI outputs [TASK_COMPLETE] or [TASK_BLOCKED], or max steps reached.
   */
  const runStepByStepLoop = useCallback(
    async (userTask: string, maxSteps = DEFAULT_MAX_STEPS) => {
      if (runningRef.current) return;
      runningRef.current = true;
      abortRef.current = false;

      const { addAgentMessage, updateAgentMessage } = useAIChatStore.getState();

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

      let step = 1;
      updateStatus({ step, action: 'Planning first step…', running: true, lastResult: 'running' });

      postAgent(
        `Starting step-by-step execution for: "${userTask.slice(0, 100)}${userTask.length > 100 ? '…' : ''}"`,
        'info',
        { step },
      );

      // Send initial task with step-by-step system prompt
      // Show only the user task in chat, hide the system prompt
      const initialPrompt = `${STEP_BY_STEP_PROMPT}\n\nUser task: ${userTask}\n\nIf this is a question about what's visible, answer from the terminal context already provided — no commands needed. Otherwise provide the first command.`;
      await sendMessage(initialPrompt, undefined, { displayContent: userTask });

      try {
        while (step <= maxSteps && !abortRef.current) {
          // Get the latest AI response
          const state = useAIChatStore.getState();
          const session = state.sessions[sessionId];
          if (!session) break;
          const lastMsg = session.messages[session.messages.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant') break;

          const responseText = lastMsg.content;

          // Check for task completion signals
          if (responseText.includes('[TASK_COMPLETE]') || responseText.includes('[TASK_BLOCKED]')) {
            const isBlocked = responseText.includes('[TASK_BLOCKED]');
            updateStatus({
              step,
              action: isBlocked ? 'Task blocked — needs user input' : 'Task completed',
              lastResult: isBlocked ? 'error' : 'success',
              running: false,
            });
            postAgent(
              isBlocked ? 'Task blocked — AI needs your input.' : 'Task completed.',
              isBlocked ? 'error' : 'success',
              { step },
            );
            notifyIfHidden('Terminus AI Agent', isBlocked ? 'Task blocked.' : 'Task completed.');
            break;
          }

          // Also check: if AI gave no commands and no code block, treat as complete
          const cmds = extractCommands(responseText);
          if (cmds.length === 0) {
            // AI didn't provide a command — might be asking a question or giving analysis
            updateStatus({ step, action: 'AI provided no command — waiting', running: false });
            postAgent('AI did not provide a command. Review the response above.', 'info', { step });
            break;
          }

          // Take only the first command (step-by-step)
          const cmd = cmds[0];

          // Safety check
          if (isDangerous(cmd)) {
            postAgent(`Blocked dangerous command: \`${cmd}\``, 'blocked', { step, command: cmd });
            updateStatus({ step, action: 'Dangerous command blocked', lastResult: 'error', running: false });
            notifyIfHidden('Terminus AI Agent', 'A dangerous command was blocked.');
            break;
          }

          // Execute the command
          updateStatus({ step, action: `Step ${step}: ${cmd.slice(0, 50)}${cmd.length > 50 ? '…' : ''}`, lastResult: 'running' });

          const execMsgId = postAgent(
            `Step ${step}: Executing command…`,
            'executing',
            { step, command: cmd },
          );

          const prevLen = executeCommand(cmd);
          const output = await waitForOutput(prevLen, Math.min(step, 3) * OUTPUT_SETTLE_EXTRA_MS);

          // Update agent bubble with captured output
          updateAgentMessage(sessionId, execMsgId, output ? `Step ${step}: Command completed` : `Step ${step}: Command completed (no output)`, {
            agentAction: output ? 'success' : 'waiting',
            agentStep: step,
            agentMaxSteps: maxSteps,
            agentCommand: cmd,
            agentOutput: output.slice(0, 2000) || undefined,
          });

          if (abortRef.current) break;

          // Check if this is the last allowed step
          if (step >= maxSteps) {
            updateStatus({ step, action: `Max steps reached (${maxSteps})`, lastResult: 'error', running: false });
            postAgent(`Max steps reached (${maxSteps}). Asking AI for summary…`, 'info', { step });

            // Ask AI for final summary (hidden from chat — agent already posted status)
            await sendMessage(
              `We've reached the maximum number of steps (${maxSteps}). Here is the output of the last command:\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\`\n\nPlease provide a summary of what was accomplished and what remains. End with [TASK_COMPLETE] if the task is done, or explain what's left.`,
              undefined,
              { displayContent: null },
            );
            notifyIfHidden('Terminus AI Agent', `Max steps reached (${maxSteps}).`);
            break;
          }

          // Feed real output back to AI and ask for next step
          step++;
          updateStatus({ step, action: 'Reading output, planning next step…', lastResult: 'running' });

          postAgent(
            `Step ${step}: Sending output to AI for next step…`,
            'replanning',
            { step },
          );

          const nextPrompt = `Here is the real output from the command \`${cmd}\`:\n\`\`\`\n${output.slice(0, 3000)}\n\`\`\`\n\nBased on this REAL output, what is the next command? ONE command in a bash code block. If the task is done, just say so with a summary (no commands needed).`;

          // Hide internal agent prompt from chat — user sees agent bubbles instead
          await sendMessage(nextPrompt, undefined, { displayContent: null });
        }
      } finally {
        runningRef.current = false;
        const status = useAIChatStore.getState().agentStatus[sessionId];
        if (status?.running) {
          setAgentStatus(sessionId, { ...status, running: false });
        }
      }

      if (abortRef.current) {
        postAgent('Agent stopped by user.', 'stopped', { step });
      }
    },
    [sessionId, executeCommand, waitForOutput, sendMessage, setAgentStatus],
  );

  const stopAgent = useCallback(() => {
    abortRef.current = true;
    const state = useAIChatStore.getState();
    const status = state.agentStatus[sessionId];
    if (status) {
      setAgentStatus(sessionId, { ...status, running: false, action: 'Stopped by user' });
    }
    // Update the last in-progress agent message so its spinner stops
    const session = state.sessions[sessionId];
    if (session) {
      const { updateAgentMessage } = state;
      const msgs = session.messages;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.role === 'agent' && (m.agentAction === 'executing' || m.agentAction === 'waiting' || m.agentAction === 'replanning')) {
          updateAgentMessage(sessionId, m.id, 'Stopped by user', { agentAction: 'stopped' });
          break;
        }
      }
    }
  }, [sessionId, setAgentStatus]);

  return { runAgentLoop, runStepByStepLoop, stopAgent, requestNotificationPermission };
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
