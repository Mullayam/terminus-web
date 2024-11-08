import { useState } from 'react';
import { LayoutDashboard, X, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  title: string;
}

interface TopBarProps {
  onToggleSidebar: () => void;
  onToggleCommandList: () => void;
  isCommandList: boolean;

}

export function TopBar({ onToggleSidebar, isCommandList, onToggleCommandList }: TopBarProps) {
  const [activeTab, setActiveTab] = useState('1');
  const [tabs] = useState<Tab[]>([
    { id: '1', title: 'ttest' },
    { id: '2', title: 'Terminal' },
    { id: '3', title: 'Tasks' }
  ]);

  return (
    <div className="flex flex-col border-b border-gray-800 bg-[#1a1b26] shrink-0">
      <div className="h-12 flex items-center px-4">
        <div className="flex-1 flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleSidebar}
          >
            <Menu className="h-4 w-4 text-gray-400" />
          </Button>
          <div className="flex space-x-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 h-8 transition-colors",
                  activeTab === tab.id
                    ? "text-green-500 bg-[#24253a]"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >
                {tab.title}
                <X
                  className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();

                  }}
                />
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCommandList}>
            {!isCommandList ? <LayoutDashboard className="h-4 w-4 text-gray-400" /> : <X className="h-4 w-4 text-gray-400" />}
          </Button>
        </div>
      </div>
    </div>
  );
}