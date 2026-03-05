/**
 * AdminUserList — shows all connected users with per-user actions.
 * Only rendered when isAdmin is true.
 */
import { Shield, ShieldOff, UserX, Ban } from 'lucide-react';
import { useCollabStore } from '../store';
import type { CollabUser } from '../types';

interface AdminUserListProps {
  onChangePermission: (socketId: string, permission: '400' | '700') => void;
  onKick: (socketId: string) => void;
  onBlock: (socketId: string) => void;
}

const PERM_STYLES: Record<string, string> = {
  '400': 'bg-yellow-600/20 text-yellow-300 border-yellow-600/40',
  '700': 'bg-green-600/20 text-green-300 border-green-600/40',
};

const PERM_LABELS: Record<string, string> = {
  '400': 'Read-only',
  '700': 'Write',
};

function UserRow({
  user,
  onChangePermission,
  onKick,
  onBlock,
}: { user: CollabUser } & AdminUserListProps) {
  const isWriter = user.permission === '700';
  const permStyle = PERM_STYLES[user.permission] || PERM_STYLES['400'];
  const permLabel = PERM_LABELS[user.permission] || 'Read-only';

  return (
    <div className="rounded-lg border border-gray-700/50 bg-[#141414] overflow-hidden">
      {/* User info row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <code className="text-[11px] text-gray-300 truncate block font-mono">
            {user.socketId.slice(0, 12)}\u2026
          </code>
          {user.ip && (
            <span className="text-[10px] text-gray-500 block">{user.ip}</span>
          )}
        </div>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${permStyle}`}
        >
          {permLabel}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center border-t border-gray-700/40 divide-x divide-gray-700/40">
        <button
          onClick={() => onChangePermission(user.socketId, isWriter ? '400' : '700')}
          title={isWriter ? 'Set read-only' : 'Grant write'}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium transition-colors ${
            isWriter
              ? 'text-yellow-300 hover:bg-yellow-800/30'
              : 'text-green-300 hover:bg-green-800/30'
          }`}
        >
          {isWriter ? <ShieldOff size={12} /> : <Shield size={12} />}
          {isWriter ? 'Read-only' : 'Write'}
        </button>
        <button
          onClick={() => onKick(user.socketId)}
          title="Kick user"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-yellow-300 hover:bg-yellow-800/30 transition-colors"
        >
          <UserX size={12} />
          Kick
        </button>
        <button
          onClick={() => onBlock(user.socketId)}
          title="Block user (IP ban)"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-800/30 transition-colors"
        >
          <Ban size={12} />
          Block
        </button>
      </div>
    </div>
  );
}

export function AdminUserList(props: AdminUserListProps) {
  const users = useCollabStore((s) => s.users);

  if (users.length === 0) {
    return (
      <p className="text-xs text-gray-500 text-center py-4">
        No collaborators connected yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <UserRow key={user.socketId} user={user} {...props} />
      ))}
    </div>
  );
}
