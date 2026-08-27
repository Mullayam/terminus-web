import { Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'Explain the last error',
  'How to find large files?',
  'Fix permission denied',
  'Show disk usage',
];

export function ChatEmptyState({
  colors,
  onPick,
}: {
  colors: Record<string, string>;
  onPick: (question: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: `${colors.foreground}35` }}>
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${colors.cyan}15, ${colors.blue}15)` }}
      >
        <Sparkles size={20} style={{ color: `${colors.cyan}60` }} />
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs font-medium" style={{ color: `${colors.foreground}50` }}>
          AI Terminal Assistant
        </p>
        <p className="text-[11px]" style={{ color: `${colors.foreground}30` }}>
          Ask anything about your terminal session.
          <br />
          Select text in terminal for context.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-xs">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="px-2.5 py-2 rounded-lg text-[10px] text-left transition-colors hover:brightness-125"
            style={{
              backgroundColor: `${colors.foreground}08`,
              color: `${colors.foreground}60`,
              border: `1px solid ${colors.foreground}10`,
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ChatEmptyState;
