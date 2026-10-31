// AI Agent v2 — the `/ai-agent` integration-guide UX wired to the real agent
// namespace (Socket.IO `/ai-agent` + `/api/ai/agent/*`). Operates on the
// terminal's own SSH session (sessionId = the SSH session id).
export { default as AgentPanelV2 } from './AgentPanelV2';
export { useAgentV2 } from './useAgentV2';
export { ConfirmDialog } from './ConfirmDialog';
export { TranscriptView } from './TranscriptView';
export {
  getAgentSocket,
  emitPrompt,
  emitConfirmReply,
  emitAbort,
  onAgentEvent,
  onConfirmRequest,
  onConnectionChange,
  isAgentConnected,
  fetchAgentModels,
  fetchAgentSettings,
  updateAgentSettings,
} from './agentSocket';
export { CONFIRM_TIMEOUT_MS, AGENT_NAMESPACE, AgentEventName } from './constants';
export type * from './types';
