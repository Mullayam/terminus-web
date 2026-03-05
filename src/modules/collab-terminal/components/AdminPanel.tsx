/**
 * AdminPanel — full admin control panel for the collab session.
 * Contains: lock toggle, user list with actions, blocked IPs.
 *
 * Only rendered when store.isAdmin is true.
 */
import { Lock, Unlock, Users, ShieldBan } from 'lucide-react';
import { useCollabStore } from '../store';
import { AdminUserList } from './AdminUserList';
import { AdminUnblockList } from './AdminUnblockList';

interface AdminPanelProps {
  onAdminLock: (lock: boolean) => void;
  onChangePermission: (socketId: string, permission: '400' | '700') => void;
  onKick: (socketId: string) => void;
  onBlock: (socketId: string) => void;
  onUnblock: (ip: string) => void;
}

export function AdminPanel({
  onAdminLock,
  onChangePermission,
  onKick,
  onBlock,
  onUnblock,
}: AdminPanelProps) {
  const isAdmin = useCollabStore((s) => s.isAdmin);
  const isLocked = useCollabStore((s) => s.isLocked);
  const lockType = useCollabStore((s) => s.lockType);
  const userCount = useCollabStore((s) => s.userCount);

  if (!isAdmin) return null;

  const isAdminLocked = isLocked && lockType === 'admin';

  return (
    <div className="flex flex-col gap-4 p-4 text-gray-200">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-gray-100">Admin Controls</h3>
        <p className="text-[11px] text-gray-500">{userCount} user(s) connected</p>
      </div>

      {/* Terminal lock toggle */}
      <div className="rounded-lg p-3 border border-gray-700/50 bg-[#181818]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAdminLocked ? (
              <Lock size={14} className="text-red-400" />
            ) : (
              <Unlock size={14} className="text-green-400" />
            )}
            <span className="text-xs font-medium">
              Terminal {isAdminLocked ? 'Locked' : 'Unlocked'}
            </span>
          </div>
          <button
            onClick={() => onAdminLock(!isAdminLocked)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              isAdminLocked
                ? 'bg-green-700/60 text-green-200 hover:bg-green-600/70'
                : 'bg-red-700/60 text-red-200 hover:bg-red-600/70'
            }`}
          >
            {isAdminLocked ? 'Unlock' : 'Lock'}
          </button>
        </div>
      </div>

      {/* User list */}
      <div className="rounded-lg p-3 border border-gray-700/50 bg-[#181818]">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-blue-400" />
          <span className="text-xs font-medium">Connected Users</span>
        </div>
        <AdminUserList
          onChangePermission={onChangePermission}
          onKick={onKick}
          onBlock={onBlock}
        />
      </div>

      {/* Blocked IPs */}
      <div className="rounded-lg p-3 border border-gray-700/50 bg-[#181818]">
        <div className="flex items-center gap-2 mb-3">
          <ShieldBan size={14} className="text-red-400" />
          <span className="text-xs font-medium">Blocked IPs</span>
        </div>
        <AdminUnblockList onUnblock={onUnblock} />
      </div>
    </div>
  );
}
