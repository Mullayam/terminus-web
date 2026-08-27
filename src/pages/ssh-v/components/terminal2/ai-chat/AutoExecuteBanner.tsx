import { Loader2, ShieldCheck, ShieldOff, Square } from 'lucide-react';
import type { AgentStatus } from '@/store/aiChatStore';

export function AutoExecuteBanner({
  agentStatus,
  colors,
  onStop,
  onDisable,
}: {
  agentStatus?: AgentStatus;
  colors: Record<string, string>;
  onStop: () => void;
  onDisable: () => void;
}) {
  const running = !!agentStatus?.running;

  return (
    <div
      className="px-4 py-1.5 flex items-center gap-2 text-[10px] border-b shrink-0"
      style={{
        borderColor: `${colors.foreground}12`,
        backgroundColor: running ? `${colors.yellow}10` : `${colors.green}08`,
        color: running ? colors.yellow : colors.green,
      }}
    >
      {running ? (
        <>
          <Loader2 size={10} className="animate-spin" />
          <span className="flex-1 truncate">
            Agent step {agentStatus!.step}: {agentStatus!.action}
          </span>
          <button
            onClick={onStop}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors hover:brightness-125"
            style={{ backgroundColor: `${colors.red}20`, color: colors.red }}
            title="Stop agent"
          >
            <Square size={8} />
            Stop
          </button>
        </>
      ) : (
        <>
          <ShieldCheck size={10} />
          <span className="flex-1">Auto-execute enabled for this session</span>
          <button
            onClick={onDisable}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors hover:brightness-125"
            style={{ backgroundColor: `${colors.foreground}15`, color: `${colors.foreground}70` }}
          >
            <ShieldOff size={8} />
            Disable
          </button>
        </>
      )}
    </div>
  );
}

export default AutoExecuteBanner;
