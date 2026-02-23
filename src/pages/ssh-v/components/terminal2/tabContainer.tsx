import React from 'react';

import { Terminal, Share, Settings, Command } from 'lucide-react';
import { TabType, useTabStore } from '@/store/rightSidebarTabStore';
import { useSessionTheme } from '@/hooks/useSessionTheme';

const tabs = [
  { id: 'commands' as TabType, name: 'Commands', icon: Command },
  { id: 'sharing' as TabType, name: 'Sharing', icon: Share },
  { id: 'settings' as TabType, name: 'Settings', icon: Settings }
];

interface TabContainerProps {
  children: React.ReactNode;
}

export default function TabContainer({ children }: TabContainerProps) {
  const { activeTab, setActiveTab } = useTabStore();
  const { colors } = useSessionTheme();

  return (
    <div className="h-full flex flex-col" style={{ borderLeftColor: `${colors.foreground}15`, borderLeftWidth: 1 }}>
      {/* Tab Navigation */}
      <div className="flex" style={{ borderBottomColor: `${colors.foreground}20`, borderBottomWidth: 1 }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center space-x-2 px-4 py-3 font-medium text-sm transition-all duration-200 relative flex-1
              `}
              style={{
                backgroundColor: isActive ? `${colors.background}` : `${colors.background}cc`,
                color: isActive ? colors.green : colors.yellow,
              }}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{tab.name}</span>

              {/* Active tab indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(to right, ${colors.blue}, ${colors.cyan})` }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto" style={{ backgroundColor: colors.background }}>
        {children}
      </div>
    </div>
  );
}