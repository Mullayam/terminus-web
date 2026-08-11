import { __config } from "@/lib/config";
import { useAIChatStore, getDefaultModel } from "@/store/aiChatStore";

/** Strip ANSI escape sequences + carriage returns from terminal text. */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
}

/** Clean an AI reply down to a single runnable command. */
export function cleanCommand(text: string): string {
  let cmd = text.trim();
  cmd = cmd.replace(/^```(?:\w*)\n?/i, "").replace(/\n?```$/, "").trim();
  cmd = cmd.replace(/^`|`$/g, "").trim();
  cmd = cmd.replace(/^\$\s*/, "").trim();
  // Keep only the first line — we want a single command.
  cmd = cmd.split("\n")[0].trim();
  return cmd;
}

export interface AICommandParams {
  sessionId: string;
  question: string;
  context?: string;
  selection?: string;
  signal?: AbortSignal;
}

/**
 * Streams the `/api/chat/ai` SSE endpoint and resolves with the cleaned,
 * single-line command from the model's reply.
 */
export async function fetchAICommand({
  sessionId,
  question,
  context = "",
  selection = "",
  signal,
}: AICommandParams): Promise<string> {
  const state = useAIChatStore.getState();
  const model = state.selectedModel[sessionId] ?? getDefaultModel(state.providers);

  const payload = {
    modelId: model?.modelId ?? "",
    providerId: model?.providerId ?? "",
    question,
    selection,
    context,
    history: [],
  };

  return cleanCommand(await streamChat(payload, signal));
}

/**
 * Shared SSE reader for the `/api/chat/ai` endpoint. Returns the full reply
 * text and invokes `onText` with the cumulative text as chunks arrive.
 */
async function streamChat(
  payload: unknown,
  signal?: AbortSignal,
  onText?: (full: string) => void,
): Promise<string> {
  const res = await fetch(`${__config.API_URL}/api/chat/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  // eslint-disable-next-line no-constant-condition
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
      onText?.(fullText);
    }
  }

  return fullText;
}

export interface AIExplainParams {
  sessionId: string;
  command: string;
  context?: string;
  signal?: AbortSignal;
  /** Called with the cumulative explanation text as it streams in. */
  onText?: (full: string) => void;
}

/**
 * Streams a concise, plain-language explanation of a shell command from the
 * `/api/chat/ai` endpoint. Unlike {@link fetchAICommand}, the reply is kept as
 * prose so the user can understand a command before running it.
 */
export async function streamAIExplanation({
  sessionId,
  command,
  context = "",
  signal,
  onText,
}: AIExplainParams): Promise<string> {
  const state = useAIChatStore.getState();
  const model = state.selectedModel[sessionId] ?? getDefaultModel(state.providers);

  const payload = {
    modelId: model?.modelId ?? "",
    providerId: model?.providerId ?? "",
    question:
      "Explain concisely what this shell command does before I run it. " +
      "Cover its effect, any notable flags, and call out anything destructive or risky. " +
      "Use at most 4 short bullet points, plain text, no code fences.\n\nCommand:\n" +
      command,
    selection: command,
    context,
    history: [],
  };

  return streamChat(payload, signal, onText);
}
