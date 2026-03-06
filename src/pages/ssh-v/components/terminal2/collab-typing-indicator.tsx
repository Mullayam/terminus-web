import { useEffect, useRef, useState, memo } from "react";
import type { Terminal } from "@xterm/xterm";
import type { Socket } from "socket.io-client";
import { CollabServerEvent } from "@/modules/collab-terminal/types/events";
import CursorTextOverlay from "./cursor-text-overlay";
import TypingOverlay from "./typing-overlay";
import TerminalPlaceholder from "./terminal-placeholder";

interface CollabTypingIndicatorProps {
  socket: Socket;
  termRef: React.RefObject<Terminal | null>;
  commandBuffer: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  placeholderHint?: string;
}

/**
 * Owns the collab-typing socket listeners and local state.
 * Renders the typing indicator OR the placeholder — without
 * re-rendering the parent Terminal component on state changes.
 */
const CollabTypingIndicator = memo(function CollabTypingIndicator({
  socket,
  termRef,
  commandBuffer,
  containerRef,
  placeholderHint = "💡 Like this project? Press ⭐ on GitHub to support it github.com/Mullayam",
}: CollabTypingIndicatorProps) {
  const [collabTyping, setCollabTyping] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onLocked = (data: { lockedBy: string; type: string; expiresIn?: number }) => {
      if (data.type === "auto" && data.lockedBy) {
        setCollabTyping(data.lockedBy);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCollabTyping(null), data.expiresIn || 5000);
      }
    };

    const onUnlocked = () => {
      setCollabTyping(null);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    socket.on(CollabServerEvent.PTY_LOCKED, onLocked);
    socket.on(CollabServerEvent.PTY_UNLOCKED, onUnlocked);

    return () => {
      socket.off(CollabServerEvent.PTY_LOCKED, onLocked);
      socket.off(CollabServerEvent.PTY_UNLOCKED, onUnlocked);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [socket]);

  return (
    <>
      {collabTyping ? (
        <CursorTextOverlay termRef={termRef} text="Someone is typing..." />
      ) : (
        <TerminalPlaceholder
          termRef={termRef}
          commandBuffer={commandBuffer}
          containerRef={containerRef}
          hint={placeholderHint}
        />
      )}
      {collabTyping && <TypingOverlay text="Someone is typing…" />}
    </>
  );
});

export default CollabTypingIndicator;
