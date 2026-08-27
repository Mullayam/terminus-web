import { Loader2, Send, Square, StopCircle } from 'lucide-react';
import type { AgentStatus, AIModelOption } from '@/store/aiChatStore';

const MAX_INPUT_HEIGHT = 112;

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
}

export function ChatComposer({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  onAbort,
  onStopAgent,
  loading,
  agentStatus,
  selectedModel,
  colors,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onAbort: () => void;
  onStopAgent: () => void;
  loading: boolean;
  agentStatus?: AgentStatus;
  selectedModel?: AIModelOption;
  colors: Record<string, string>;
}) {
  const running = !!agentStatus?.running;

  return (
    <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: `${colors.foreground}12` }}>
      {running && (
        <div
          className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-[10px]"
          style={{
            backgroundColor: `${colors.yellow}10`,
            color: colors.yellow,
            border: `1px solid ${colors.yellow}20`,
          }}
        >
          <Loader2 size={10} className="animate-spin shrink-0" />
          <span className="flex-1 truncate">
            Step {agentStatus!.step}: {agentStatus!.action}
          </span>
          <button
            onClick={onStopAgent}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] transition-colors hover:brightness-125 shrink-0"
            style={{ backgroundColor: `${colors.red}20`, color: colors.red }}
            title="Stop agent"
          >
            <Square size={8} />
            Stop
          </button>
        </div>
      )}
      <div
        className="flex items-end gap-2 rounded-lg border px-3 py-2 transition-colors"
        style={{
          borderColor: running ? `${colors.yellow}40` : `${colors.foreground}20`,
          backgroundColor: `${colors.foreground}05`,
        }}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            running
              ? 'Agent is working… type to send a follow-up'
              : loading
                ? 'AI is responding…'
                : 'Ask about your terminal...'
          }
          rows={1}
          className="flex-1 bg-transparent text-xs resize-none outline-none max-h-28 min-h-[20px] themed-scrollbar"
          style={{
            color: colors.foreground,
            '--sb-thumb': `${colors.foreground}30`,
            '--sb-thumb-hover': `${colors.foreground}50`,
            '--sb-track': `${colors.foreground}08`,
          } as React.CSSProperties}
          onInput={(e) => autoGrow(e.currentTarget)}
          // Height must be recalculated after the pasted text lands.
          onPaste={() => requestAnimationFrame(() => autoGrow(inputRef.current))}
        />
        {loading && !running ? (
          <button
            onClick={onAbort}
            className="p-1.5 rounded transition-colors hover:bg-white/10 shrink-0"
            title="Stop generating"
          >
            <StopCircle size={16} style={{ color: colors.red }} />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!value.trim()}
            className="p-1.5 rounded transition-colors hover:bg-white/10 shrink-0 disabled:opacity-30"
            title="Send (Enter)"
          >
            <Send size={16} style={{ color: value.trim() ? colors.cyan : `${colors.foreground}30` }} />
          </button>
        )}
      </div>
      <p className="text-[9px] mt-1.5 text-center" style={{ color: `${colors.foreground}25` }}>
        {running
          ? 'Agent auto-executing • You can still send messages'
          : `Shift+Enter for new line • ${selectedModel?.label ?? 'No model'} (${selectedModel?.providerId ?? ''})`}
      </p>
    </div>
  );
}

export default ChatComposer;
