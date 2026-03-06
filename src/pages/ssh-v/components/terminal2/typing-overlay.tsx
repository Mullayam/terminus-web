import { memo } from "react";

interface TypingOverlayProps {
  text: string;
}

const TypingOverlay = memo(function TypingOverlay({ text }: TypingOverlayProps) {
  return (
    <div className="absolute bottom-1 left-3 z-10 flex items-center gap-2 px-3 py-1 rounded bg-[#1a1b26]/90 border border-gray-700/50 pointer-events-none">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
      </span>
      <span className="text-xs text-gray-400">{text}</span>
    </div>
  );
});

export default TypingOverlay;
