import { LayoutDashboard, X, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface Tab {
  id: number;
  title: string;
}

interface TopBarProps {
  isCommandList: boolean;
  onToggleSidebar: () => void;
  onToggleCommandList: () => void;
  tabs: Tab[];
  handleActive: (id: number) => void;
  activeTab: number;
  onAddTab: () => void
  onRemoveTab: (id: number) => void

}

export function TopBar({ tabs, handleActive, activeTab, onAddTab, onRemoveTab, onToggleSidebar, isCommandList, onToggleCommandList }: TopBarProps) {

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
            {tabs.map((tab, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => handleActive(index + 1)}
                className={cn(
                  "px-3 h-8 transition-colors",
                  activeTab === index + 1
                    ? "text-green-500 bg-[#24253a]"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >

                Terminal {index + 1}
                {tabs.length > 1 && (
                  <span onClick={() => onRemoveTab(index)} className="ml-2 text-red-500 cursor-pointer">
                    ✕
                  </span>
                )}

              </Button>
            ))}
            {tabs.length < 10 && (
              <button onClick={onAddTab} className={"px-3 h-8 transition-colors text-gray-400 hover:text-gray-300"}>

                + New Tab
              </button>
            )}

          </div>
        </div>
        <div className="flex items-center space-x-4 mx-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCommandList}>
            {!isCommandList ? <LayoutDashboard className="h-4 w-4 text-gray-400" /> : <X className="h-4 w-4 text-gray-400" />}
          </Button>
        </div>
      </div>
    </div>
  );
}