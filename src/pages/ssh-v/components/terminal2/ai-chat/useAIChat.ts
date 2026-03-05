import { useCallback, useRef } from 'react';
import { useAIChatStore } from '@/store/aiChatStore';
import { useTerminalStore } from '@/store/terminalStore';
import { __config } from '@/lib/config';

/** Strip ANSI escape sequences */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
}

/** Extract code-fenced commands from AI response */
export function extractCommands(text: string): string[] {
  const cmds: string[] = [];
  const regex = /```(?:bash|sh|shell|zsh)?\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const block = match[1].trim();
    // split multi-line blocks into individual commands
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        cmds.push(trimmed);
      }
    }
  }
  return cmds;
}

const EMPTY_LOGS: string[] = [];

export function useAIChat(sessionId: string) {
  const logs = useTerminalStore((s) => s.logs[sessionId] ?? EMPTY_LOGS);
  const abortRef = useRef<AbortController | null>(null);

  const getTerminalContext = useCallback(() => {
    // Last 50 log entries, stripped of ANSI
    const last50 = logs.slice(-50);
    return stripAnsi(last50.join('')).trim();
  }, [logs]);

  const buildMessages = useCallback(
    (userPrompt: string, selection?: string) => {
      const session = useAIChatStore.getState().sessions[sessionId];
      const history = session?.messages ?? [];

      const systemPrompt = [
        'You are an expert Linux terminal assistant embedded in a web SSH client.',
        'Help the user with commands, debugging, scripting, and system administration.',
        'When suggesting commands, wrap them in ```bash code blocks so the user can execute them directly.',
        'Be concise and practical.',
      ].join(' ');

      // Build conversation history for context accumulation
      const msgs: { role: string; content: string }[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add terminal context
      const termContext = getTerminalContext();
      if (termContext) {
        msgs.push({
          role: 'system',
          content: `Recent terminal output (last 50 entries):\n\`\`\`\n${termContext}\n\`\`\``,
        });
      }

      // Add prior conversation messages
      for (const msg of history) {
        msgs.push({ role: msg.role, content: msg.content });
      }

      // Build the current user message with selection context
      let prompt = userPrompt;
      if (selection) {
        prompt = `Selected terminal text:\n\`\`\`\n${selection}\n\`\`\`\n\n${userPrompt}`;
      }
      msgs.push({ role: 'user', content: prompt });

      return msgs;
    },
    [sessionId, getTerminalContext],
  );

  const sendMessage = useCallback(
    async (userPrompt: string, selection?: string) => {
      const trimmed = userPrompt.trim();
      if (!trimmed) return;

      const { addUserMessage, setLoading, addAssistantMessage, updateAssistantMessage, setMessageCommands } = useAIChatStore.getState();

      // Add user message
      addUserMessage(sessionId, selection
        ? `Selected:\n\`\`\`\n${selection}\n\`\`\`\n${trimmed}`
        : trimmed);

      setLoading(sessionId, true);
      const assistantId = addAssistantMessage(sessionId);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const messages = buildMessages(trimmed, selection);
        const res = await fetch(`${__config.API_URL}/api/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const contentType = res.headers.get('content-type') ?? '';
        let fullText = '';

        if (contentType.includes('text/event-stream') || contentType.includes('stream')) {
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();

          if (reader) {
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split('\n');
              buffer = parts.pop() ?? '';
              for (const part of parts) {
                const line = part.trim();
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') continue;
                try {
                  const json = JSON.parse(data);
                  const delta =
                    json.choices?.[0]?.delta?.content ??
                    json.choices?.[0]?.text ??
                    json.content ??
                    json.text ??
                    '';
                  fullText += delta;
                  updateAssistantMessage(sessionId, assistantId, fullText);
                } catch {
                  fullText += data;
                  updateAssistantMessage(sessionId, assistantId, fullText);
                }
              }
            }
          }
        } else {
          const json = await res.json();
          fullText =
            json.choices?.[0]?.message?.content ??
            json.choices?.[0]?.text ??
            json.content ??
            json.text ??
            JSON.stringify(json);
          updateAssistantMessage(sessionId, assistantId, fullText);
        }

        // Extract commands from the response
        const cmds = extractCommands(fullText);
        if (cmds.length > 0) {
          setMessageCommands(sessionId, assistantId, cmds);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          updateAssistantMessage(
            sessionId,
            assistantId,
            `⚠ Failed to reach AI: ${err?.message ?? 'unknown error'}`,
          );
        }
      } finally {
        setLoading(sessionId, false);
        abortRef.current = null;
      }
    },
    [sessionId, buildMessages],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    useAIChatStore.getState().setLoading(sessionId, false);
  }, [sessionId]);

  return { sendMessage, abort, getTerminalContext };
}
