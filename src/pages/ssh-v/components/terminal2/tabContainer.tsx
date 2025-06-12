import React from 'react';

import { Terminal, Share, Settings, Command } from 'lucide-react';
import { TabType, useTabStore } from '@/store/rightSidebarTabStore';

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

  return (
    <div className="h-full flex flex-col  border-l border-[#1a1b28]">
      {/* Tab Navigation */}
      <div className="flex border-b  border-[#1f2031] ">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center space-x-2 px-4 py-3 font-medium text-sm transition-all duration-200 relative flex-1 bg-[#1f2031]
                ${isActive
                  ? 'text-green-600  border-blue-600'
                  : 'text-orange-500 hover:text-orange-600 '
                }
              `}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{tab.name}</span>

              {/* Active tab indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto bg-[#1e1f2e]">
        {children}
      </div>
    </div>
  );
}