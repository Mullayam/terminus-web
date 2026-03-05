/**
 * CollabRightSidebar — fixed right panel for the collab terminal.
 * Tabs: Settings (theme) + Admin (users, lock, blocked IPs).
 */
import { Settings, X, Shield } from 'lucide-react';
import React from 'react';
import { useCollabTheme } from '../hooks';
import { useCollabStore } from '../store';
import { CollabSettingsTab } from './CollabSettingsTab';
import { AdminPanel } from './AdminPanel';

interface CollabRightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminLock: (lock: boolean) => void;
  onChangePermission: (socketId: string, permission: '400' | '700') => void;
  onKick: (socketId: string) => void;
  onBlock: (socketId: string) => void;
  onUnblock: (ip: string) => void;
}

export function CollabRightSidebar({
  isOpen,
  onClose,
  onAdminLock,
  onChangePermission,
  onKick,
  onBlock,
  onUnblock,
}: CollabRightSidebarProps) {
  const { colors } = useCollabTheme();
  const isAdmin = useCollabStore((s) => s.isAdmin);
  const [activeTab, setActiveTab] = React.useState<'settings' | 'admin'>(
    isAdmin ? 'admin' : 'settings'
  );

  return (
    <div
      className={`
        fixed right-0 top-0 bottom-0 z-20
        transition-all duration-300 ease-in-out
        ${isOpen ? 'w-80 translate-x-0' : 'w-80 translate-x-full'}
        flex flex-col shadow-lg themed-scrollbar
      `}
      style={{
        backgroundColor: colors.background,
        borderLeft: `1px solid ${colors.foreground}15`,
        '--sb-thumb': `${colors.foreground}30`,
        '--sb-thumb-hover': `${colors.foreground}50`,
        '--sb-track': `${colors.foreground}08`,
      } as React.CSSProperties}
    >
      {/* Header with tabs */}
      <div className="shrink-0" style={{ borderBottom: `1px solid ${colors.foreground}20` }}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Settings size={13} />
              Settings
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'admin'
                    ? 'bg-purple-700/50 text-purple-200'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Shield size={13} />
                Admin
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X size={14} style={{ color: `${colors.foreground}80` }} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'settings' && <CollabSettingsTab />}
        {activeTab === 'admin' && isAdmin && (
          <AdminPanel
            onAdminLock={onAdminLock}
            onChangePermission={onChangePermission}
            onKick={onKick}
            onBlock={onBlock}
            onUnblock={onUnblock}
          />
        )}
      </div>
    </div>
  );
}
