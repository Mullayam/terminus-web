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

function UserRow({
  user,
  onChangePermission,
  onKick,
  onBlock,
}: { user: CollabUser } & AdminUserListProps) {
  const isWriter = user.permission === '700';

  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded bg-[#181818] border border-gray-700/50">
      <div className="min-w-0 flex-1">
        <code className="text-[11px] text-gray-300 truncate block font-mono">
          {user.socketId}
        </code>
        {user.ip && (
          <span className="text-[10px] text-gray-500">{user.ip}</span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Permission toggle */}
        <button
          onClick={() =>
            onChangePermission(user.socketId, isWriter ? '400' : '700')
          }
          title={isWriter ? 'Set read-only' : 'Grant write'}
          className={`p-1 rounded transition-colors ${
            isWriter
              ? 'bg-green-800/50 text-green-300 hover:bg-green-700/60'
              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/60'
          }`}
        >
          {isWriter ? <Shield size={14} /> : <ShieldOff size={14} />}
        </button>

        {/* Kick */}
        <button
          onClick={() => onKick(user.socketId)}
          title="Kick user"
          className="p-1 rounded bg-yellow-800/40 text-yellow-300 hover:bg-yellow-700/60 transition-colors"
        >
          <UserX size={14} />
        </button>

        {/* Block */}
        <button
          onClick={() => onBlock(user.socketId)}
          title="Block user (IP ban)"
          className="p-1 rounded bg-red-800/40 text-red-300 hover:bg-red-700/60 transition-colors"
        >
          <Ban size={14} />
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
    <div className="space-y-1.5">
      {users.map((user) => (
        <UserRow key={user.socketId} user={user} {...props} />
      ))}
    </div>
  );
}
