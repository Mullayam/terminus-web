/**
 * TypingIndicator — subtle bar below the terminal showing "X is typing…"
 * Visible only during auto-lock when another user is typing.
 */
import { useCollabStore } from '../store';

export function TypingIndicator() {
  const isLocked = useCollabStore((s) => s.isLocked);
  const lockType = useCollabStore((s) => s.lockType);
  const lockedBy = useCollabStore((s) => s.lockedBy);

  if (!isLocked || lockType !== 'auto' || !lockedBy) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-[#1a1b26]/90 text-gray-400 text-xs border-t border-gray-700/50">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
      </span>
      <span>{lockedBy.slice(0, 8)}… is typing</span>
    </div>
  );
}
