/**
 * UserCountBadge — shows "N users connected" in the top/status bar.
 */
import { Users } from 'lucide-react';
import { useCollabStore } from '../store';

export function UserCountBadge() {
  const userCount = useCollabStore((s) => s.userCount);

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-600/20 text-blue-300 border border-blue-600/40">
      <Users size={12} />
      {userCount}
    </span>
  );
}
