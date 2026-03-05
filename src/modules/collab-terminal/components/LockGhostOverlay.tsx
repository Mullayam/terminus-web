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
  const lockedBy = useCollabStore((s) => s.lockedBy);
  const mySocketId = useCollabStore((s) => s.mySocketId);
  const permission = useCollabStore((s) => s.permission);
  const { colors } = useCollabTheme();

  // Admin is immune to locks but gets a soft warning for auto-locks
  if (permission === '777') {
    if (!isLocked || lockType !== 'auto') return null;
    if (lockedBy && lockedBy === mySocketId) return null;
    return (
      <div className="absolute inset-0 z-10 flex items-start justify-center pt-4 pointer-events-none">
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{
            backgroundColor: `${colors.background}80`,
            backdropFilter: 'blur(1px)',
          }}
        >
          <Lock size={14} style={{ color: `${colors.yellow}90` }} />
          <span
            className="text-xs font-medium"
            style={{ color: `${colors.yellow}BB`, fontFamily: 'monospace' }}
          >
            Someone is typing — avoid input to prevent overlap
          </span>
        </div>
      </div>
    );
  }
  // Read-only users don't need a lock overlay (they can never type)
  if (!isLocked || permission === '400') return null;
  // Don't show overlay to the user who holds the lock
  if (lockedBy && lockedBy === mySocketId) return null;

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
