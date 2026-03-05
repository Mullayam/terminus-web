/**
 * LockGhostOverlay — semi-transparent ghost text overlay shown on xterm when PTY is locked.
 *
 * Positioned at the center of the terminal container with pointer-events: none
 * so the terminal remains visible and scrollable underneath.
 * Replaces the old solid-bar LockIndicator with a more subtle ghost-text style.
 */
import { Lock, ShieldAlert } from 'lucide-react';
import { useCollabStore } from '../store';
import { useCollabTheme } from '../hooks';

export function LockGhostOverlay() {
  const isLocked = useCollabStore((s) => s.isLocked);
  const lockType = useCollabStore((s) => s.lockType);
  const permission = useCollabStore((s) => s.permission);
  const { colors } = useCollabTheme();

  // Admin is immune to locks
  if (!isLocked || permission === '777') return null;
  // Read-only users don't need a lock overlay (they can never type)
  if (permission === '400') return null;

  const isAdminLock = lockType === 'admin';
  const Icon = isAdminLock ? ShieldAlert : Lock;
  const message = isAdminLock ? 'Terminal locked by admin' : 'Someone else is typing…';

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
    >
      <div
        className="flex flex-col items-center gap-3 px-8 py-6 rounded-lg"
        style={{
          backgroundColor: `${colors.background}90`,
          backdropFilter: 'blur(2px)',
        }}
      >
        <Icon
          size={32}
          style={{ color: `${colors.red}80` }}
        />
        <span
          className="text-sm font-medium tracking-wide"
          style={{
            color: `${colors.foreground}60`,
            fontFamily: 'monospace',
            textShadow: `0 0 8px ${colors.red}40`,
          }}
        >
          {message}
        </span>
        <span
          className="text-xs"
          style={{ color: `${colors.foreground}40` }}
        >
          Your input is being buffered
        </span>
      </div>
    </div>
  );
}
