import { useCallback, useRef } from 'react';
import { useAIChatStore, getDefaultModel } from '@/store/aiChatStore';
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
    const last50 = logs.slice(-50);
    return stripAnsi(last50.join('')).trim();
  }, [logs]);

  const buildPayload = useCallback(
    (userPrompt: string, selection?: string) => {
      const state = useAIChatStore.getState();
      const session = state.sessions[sessionId];
      const history = session?.messages ?? [];
      const model = state.selectedModel[sessionId] ?? getDefaultModel(state.providers);

      const termContext = getTerminalContext();

      // Build context string from terminal output
      let context = '';
      if (termContext) {
        context = `Recent terminal output (last 50 entries):\n\`\`\`\n${termContext}\n\`\`\``;
      }

      // Build question with selection context
      let question = userPrompt;
      if (selection) {
        question = `Selected terminal text:\n\`\`\`\n${selection}\n\`\`\`\n\n${userPrompt}`;
      }

      // Build history array for the API
      const chatHistory = history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      return {
        modelId: model?.modelId ?? '',
        providerId: model?.providerId ?? '',
        question,
        selection: selection ?? '',
        context,
        history: chatHistory,
      };
    },
    [sessionId, getTerminalContext],
  );

  const sendMessage = useCallback(
    async (userPrompt: string, selection?: string) => {
      const trimmed = userPrompt.trim();
      if (!trimmed) return;

      const { addUserMessage, setLoading, addAssistantMessage, appendAssistantContent, updateAssistantMessage, setMessageCommands } =
        useAIChatStore.getState();

      addUserMessage(
        sessionId,
        selection ? `Selected:\n\`\`\`\n${selection}\n\`\`\`\n${trimmed}` : trimmed,
      );

      setLoading(sessionId, true);
      const assistantId = addAssistantMessage(sessionId);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const payload = buildPayload(trimmed, selection);
        const res = await fetch(`${__config.API_URL}/api/chat/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Parse SSE stream
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const event of events) {
            const lines = event.split('\n');
            let eventType = '';
            let eventData = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                eventData = line.slice(5).trim();
              }
            }

            if (!eventData) continue;

            try {
              const json = JSON.parse(eventData);

              if (eventType === 'chunk') {
                const delta = json.text ?? '';
                fullText += delta;
                appendAssistantContent(sessionId, assistantId, delta);
              } else if (eventType === 'done') {
                // Final complete text – overwrite to ensure consistency
                fullText = json.text ?? fullText;
                updateAssistantMessage(sessionId, assistantId, fullText);
              }
              // 'provider' event is informational, no action needed
            } catch {
              // Non-JSON data, append as text
              fullText += eventData;
              appendAssistantContent(sessionId, assistantId, eventData);
            }
          }
        }

        // Extract commands from the full response
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
    [sessionId, buildPayload],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    useAIChatStore.getState().setLoading(sessionId, false);
  }, [sessionId]);

  return { sendMessage, abort, getTerminalContext };
}
