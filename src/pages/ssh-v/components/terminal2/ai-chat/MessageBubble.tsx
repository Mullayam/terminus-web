import { Loader2, Sparkles } from 'lucide-react';
import stripAnsi from 'strip-ansi';
import type { AIChatMessage } from '@/store/aiChatStore';
import { renderContent } from './messageContent';

export function MessageBubble({
  msg,
  colors,
  isLoading,
  isStreaming = false,
  onExecute,
  onPaste,
}: {
  msg: AIChatMessage;
  colors: Record<string, string>;
  isLoading: boolean;
  /** This bubble is the reply currently being written. */
  isStreaming?: boolean;
  onExecute: (cmd: string) => void;
  onPaste: (cmd: string) => void;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      {!isUser && (
        <div
          className={`relative w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2 ${
            isStreaming ? 'ai-avatar-working' : ''
          }`}
          style={{ backgroundColor: `${colors.cyan}20`, ['--ai-accent' as string]: colors.cyan }}
        >
          <Sparkles size={12} style={{ color: colors.cyan }} />
        </div>
      )}
      <div
        className="max-w-[96%] rounded-lg px-3 py-2 text-xs leading-relaxed overflow-hidden break-words"
        style={
          isUser
            ? { backgroundColor: `${colors.blue}30`, color: colors.foreground }
            : { backgroundColor: `${colors.foreground}08`, color: `${colors.foreground}dd` }
        }
      >
        {msg.content ? (
          renderContent(stripAnsi(msg.content), colors, onExecute, onPaste)
        ) : !isUser && isLoading ? (
          <span className="flex items-center gap-1.5" style={{ color: `${colors.foreground}50` }}>
            <Loader2 size={12} className="animate-spin" />
            Thinking...
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default MessageBubble;
