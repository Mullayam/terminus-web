import React from 'react';

import { Terminal, Share, Settings, Command, History, Package } from 'lucide-react';
import { TabType, useTabStore } from '@/store/rightSidebarTabStore';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const tabs = [
  { id: 'commands' as TabType, name: 'Commands', icon: Command },
  { id: 'history' as TabType, name: 'History', icon: History },
  { id: 'extensions' as TabType, name: 'Command Packs', icon: Package },
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
        <TooltipProvider delayDuration={200}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center justify-center px-3 py-3 transition-all duration-200 relative flex-1"
                    style={{
                      backgroundColor: isActive ? `${colors.background}` : `${colors.background}cc`,
                      color: isActive ? colors.green : colors.yellow,
                    }}
                  >
                    <Icon size={16} />

                    {/* Active tab indicator */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(to right, ${colors.blue}, ${colors.cyan})` }} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {tab.name}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto" style={{ backgroundColor: colors.background }}>
        {children}
      </div>
    </div>
  );
}