/**
 * CollabRightSidebar — fixed right panel for the collab terminal.
 * Contains the settings/theme picker tab.
 */
import { Settings, X } from 'lucide-react';
import { useCollabTheme } from '../hooks';
import { CollabSettingsTab } from './CollabSettingsTab';

interface CollabRightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CollabRightSidebar({ isOpen, onClose }: CollabRightSidebarProps) {
  const { colors } = useCollabTheme();

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
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${colors.foreground}20` }}
      >
        <div className="flex items-center gap-2">
          <Settings size={16} style={{ color: colors.green }} />
          <span className="text-sm font-medium" style={{ color: colors.foreground }}>Settings</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 transition-colors"
        >
          <X size={14} style={{ color: `${colors.foreground}80` }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <CollabSettingsTab />
      </div>
    </div>
  );
}
