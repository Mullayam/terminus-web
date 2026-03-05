/**
 * LockIndicator — overlay shown on the terminal when locked.
 */
import { Lock, ShieldAlert } from 'lucide-react';
import { useCollabStore } from '../store';

export function LockIndicator() {
  const isLocked = useCollabStore((s) => s.isLocked);
  const lockType = useCollabStore((s) => s.lockType);
  const permission = useCollabStore((s) => s.permission);

  // Admin is immune to all locks — don't show overlay
  if (!isLocked || permission === '777') return null;
  // Read-only users don't need a lock overlay (they can never type)
  if (permission === '400') return null;

  const isAdminLock = lockType === 'admin';

  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 py-1.5 bg-red-900/80 text-red-200 text-xs backdrop-blur-sm">
      {isAdminLock ? (
        <>
          <ShieldAlert size={14} />
          <span>Terminal locked by admin</span>
        </>
      ) : (
        <>
          <Lock size={14} />
          <span>Someone else is typing…</span>
        </>
      )}
    </div>
  );
}
