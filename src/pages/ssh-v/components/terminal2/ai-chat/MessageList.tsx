import type { ReactNode } from 'react';
import type { AIChatMessage } from '@/store/aiChatStore';
import { AgentAccordion } from './AgentAccordion';
import { MessageBubble } from './MessageBubble';

/**
 * Render the chat transcript.
 *
 * Agent messages are grouped by run (`agentRunId`) into a single accordion even
 * when a run's steps are interleaved with assistant messages. The accordion is
 * emitted at the run's LAST agent message so the AI's inline text responses stay
 * above the collapsed run summary.
 */
export function MessageList({
  messages,
  colors,
  loading,
  agentRunning,
  onExecute,
  onPaste,
}: {
  messages: AIChatMessage[];
  colors: Record<string, string>;
  loading: boolean;
  agentRunning: boolean;
  onExecute: (cmd: string) => void;
  onPaste: (cmd: string) => void;
}) {
  const elements: ReactNode[] = [];

  // Only the final assistant bubble is still being written.
  const streamingId =
    loading && messages[messages.length - 1]?.role === 'assistant'
      ? messages[messages.length - 1].id
      : undefined;

  const runMsgs = new Map<string, AIChatMessage[]>();
  const idToRun = new Map<number, string>();
  let legacyKey = '';
  let prevWasAgent = false;
  for (const msg of messages) {
    if (msg.role !== 'agent') {
      prevWasAgent = false;
      continue;
    }
    // Messages without a runId fall back to contiguous grouping (legacy).
    const key = msg.agentRunId
      ? `run-${msg.agentRunId}`
      : prevWasAgent
        ? legacyKey
        : (legacyKey = `legacy-${msg.id}`);
    prevWasAgent = true;
    if (!runMsgs.has(key)) runMsgs.set(key, []);
    runMsgs.get(key)!.push(msg);
    idToRun.set(msg.id, key);
  }
  const lastIdOfRun = new Map<string, number>();
  for (const [key, msgs] of runMsgs) lastIdOfRun.set(key, msgs[msgs.length - 1].id);

  // The run holding the last agent message is the one still executing.
  let activeRunKey: string | null = null;
  if (agentRunning) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'agent') {
        activeRunKey = idToRun.get(messages[i].id) ?? null;
        break;
      }
    }
  }

  for (const msg of messages) {
    if (msg.role === 'agent') {
      const key = idToRun.get(msg.id)!;
      if (lastIdOfRun.get(key) === msg.id) {
        elements.push(
          <AgentAccordion
            key={`agent-${key}`}
            agentMessages={runMsgs.get(key)!}
            colors={colors}
            forceRunning={key === activeRunKey}
          />,
        );
      }
    } else {
      elements.push(
        <MessageBubble
          key={msg.id}
          msg={msg}
          colors={colors}
          isLoading={loading}
          isStreaming={msg.id === streamingId}
          onExecute={onExecute}
          onPaste={onPaste}
        />,
      );
    }
  }

  return <>{elements}</>;
}

export default MessageList;
