/**
 * InputBufferBar — shows buffered keystrokes when user types while locked.
 * When the lock releases, shows Send / Discard buttons.
 */
import { Send, Trash2 } from 'lucide-react';
import { useCollabStore } from '../store';

interface InputBufferBarProps {
  onSend: (buffer: string) => void;
}

export function InputBufferBar({ onSend }: InputBufferBarProps) {
  const inputBuffer = useCollabStore((s) => s.inputBuffer);
  const showBufferPrompt = useCollabStore((s) => s.showBufferPrompt);
  const clearBuffer = useCollabStore((s) => s.clearBuffer);

  if (!inputBuffer && !showBufferPrompt) return null;

  const handleSend = () => {
    onSend(inputBuffer);
    clearBuffer();
  };

  const handleDiscard = () => {
    clearBuffer();
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e2e] border-t border-gray-700 text-xs">
      <span className="text-gray-500 shrink-0">Buffer:</span>
      <code className="flex-1 text-yellow-300 truncate font-mono bg-[#181818] px-2 py-0.5 rounded">
        {inputBuffer || '(empty)'}
      </code>
      {showBufferPrompt && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-gray-400">Send?</span>
          <button
            onClick={handleSend}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-700/80 text-green-100 hover:bg-green-600 transition-colors"
          >
            <Send size={12} />
            Send
          </button>
          <button
            onClick={handleDiscard}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-700/80 text-red-100 hover:bg-red-600 transition-colors"
          >
            <Trash2 size={12} />
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
