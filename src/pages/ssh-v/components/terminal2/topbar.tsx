import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


import { HostDialog } from './hostDialog';
import { useState } from 'react';


import { useSSHStore } from '@/store/sshStore';
import { useTerminalStore } from '@/store/terminalStore';
import { useSidebarState } from '@/store/sidebarStore';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
export interface Tab {
  id: number;
  title: string;
}

interface TopBarProps {
  onToggleSidebar: () => void;
  onToggleRightSidebar: () => void;
  isRightSidebarOpen: boolean

}

export function TopBar({ onToggleSidebar, onToggleRightSidebar, isRightSidebarOpen }: TopBarProps) {
  const [open, setOpen] = useState(false)
  const {
    sessions,
    tabs,
    activeTabId,
    updateStatus,
    removeSession,
    removeTab,
    setActiveTab
  } = useSSHStore();

  const { removeLog } = useTerminalStore()
  const { activeItem } = useSidebarState()

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const current = activeTab ? sessions[activeTab.sessionId] : undefined;

  /**
   * Handle the event when a tab is removed.
   *
   * If the tab corresponds to an active SSH session, it will be disconnected.
   * @param {string} tabId - The id of the tab to be removed.
   */
  const handleRemoveTab = (tabId: string) => {
    const currentActiveTab = tabs.find((tab) => tab.id === tabId);
    const current = currentActiveTab ? sessions[currentActiveTab.sessionId] : undefined;


    removeTab(tabId);
    if (current?.sessionId) {
      disconnect(current?.sessionId, tabId)
    }
  }
  const disconnect = (sessionId: string, id: string) => {
    if (current?.sessionId) {
      updateStatus(sessionId, 'disconnected');
      removeSession(sessionId);
      removeTab(id);
      removeLog(sessionId)
    }
  };

  const retry = () => {
    if (current?.sessionId) {
      console.log('🔁 Retrying:', current.sessionId);
      updateStatus(current.sessionId, 'connecting');
      // TODO: re-emit socket event
    }
  };
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
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 h-8 transition-colors",
                  tab.id === (activeTabId || "")
                    ? "text-green-500 bg-[#24253a]"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >
                {tab.title}
                {tabs.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation(); // prevent triggering parent button's onClick
                      handleRemoveTab(tab.id);
                    }}
                    className="ml-2 text-red-500 cursor-pointer">
                    ✕
                  </span>
                )}
              </Button>
            ))}

            {tabs.length < 8 && (
              <Button variant={"outline"}
                onClick={() => setOpen(true)}
                className={"p-3 h-8  rounded-full transition-colors text-gray-400 hover:text-gray-300"}>
                <Plus className="h-4 w-4" />
              </Button>
            )}

          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <small className='text-gray-400 mx-2 cursor-pointer'>Shortcuts</small>

          </PopoverTrigger>
          <PopoverContent className="w-80 right-4">
            <p className="font-medium text-gray-400 mb-2">Shortcuts</p>
            <div className="flex flex-col space-y-1 text-sm text-gray-400">
              <small><kbd className="font-semibold">Ctrl + F</kbd> — Find</small>
              <small><kbd className="font-semibold">Escape</kbd> — Close Find</small>
              <small><kbd className="font-semibold">Ctrl + C</kbd> — Copy</small>
              <small><kbd className="font-semibold">Ctrl + V</kbd> — Paste</small>

            </div>

          </PopoverContent>
        </Popover>
        {activeItem === "Terminal" && <div
          className={`flex items-center space-x-4 cursor-pointer text-gray-400 hover:text-gray-300 transition-all duration-300 ease-in-out`}
          style={{ marginRight: isRightSidebarOpen ? '24rem' : '1rem' }} // 96 = 24rem, 4 = 1rem
          onClick={onToggleRightSidebar}
        >
          <Menu className="h-4 w-4 text-gray-400" />
        </div>
        }


        <HostDialog open={open} setOpen={setOpen} />
      </div>
    </div>
  );
}