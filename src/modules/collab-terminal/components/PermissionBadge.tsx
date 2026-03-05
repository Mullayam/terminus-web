/**
 * PermissionBadge — shows the current user's permission level.
 * Always visible in the collab terminal bar.
 */
import { useCollabStore } from '../store';
import type { CollabPermission } from '../types';

const LABELS: Record<CollabPermission, string> = {
  '400': 'Read-only',
  '700': 'Write',
  '777': 'Admin',
};

const COLORS: Record<CollabPermission, string> = {
  '400': 'bg-yellow-600/20 text-yellow-300 border-yellow-600/40',
  '700': 'bg-green-600/20 text-green-300 border-green-600/40',
  '777': 'bg-purple-600/20 text-purple-300 border-purple-600/40',
};

export function PermissionBadge() {
  const permission = useCollabStore((s) => s.permission);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${COLORS[permission]}`}
    >
      {LABELS[permission]}
    </span>
  );
}
