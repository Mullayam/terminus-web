import { Copy, Menu, Plus, PlusCircle, Power, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import { HostDialog } from './hostDialog';
import { useState } from 'react';
import { v4 as uuid } from 'uuid';


import { useSSHStore } from '@/store/sshStore';
import { useTerminalStore } from '@/store/terminalStore';
import { useSidebarState } from '@/store/sidebarStore';
import { useSessionTheme } from '@/hooks/useSessionTheme';
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
  const { colors } = useSessionTheme();
  const {
    sessions,
    tabs,
    activeTabId,
    updateStatus,
    removeSession,
    removeTab,
    setActiveTab,
    addSession,
    addTab,
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
    const closingTab = tabs.find((tab) => tab.id === tabId);
    const closingSession = closingTab ? sessions[closingTab.sessionId] : undefined;

    // Disconnect & clean up the session
    if (closingSession?.sessionId) {
      closingSession.socket?.disconnect();
      updateStatus(closingSession.sessionId, 'disconnected');
      removeSession(closingSession.sessionId);
      removeLog(closingSession.sessionId);
    }

    // Remove the tab (also updates activeTabId)
    removeTab(tabId);
  };

  const retry = () => {
    if (current?.sessionId) {
      console.log('🔁 Retrying:', current.sessionId);
      updateStatus(current.sessionId, 'connecting');
      // TODO: re-emit socket event
    }
  };

  /** Duplicate: open a new tab that connects to the same host */
  const handleDuplicate = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const session = sessions[tab.sessionId];
    if (!session) return;

    const newId = uuid();
    const baseHost = session.host;
    const existingTitles = tabs.map((t) => t.title);
    let title = baseHost;
    if (existingTitles.includes(baseHost)) {
      let max = 0;
      const re = new RegExp(`^${baseHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\((\\d+)\\)$`);
      existingTitles.forEach((t) => {
        if (t === baseHost) max = Math.max(max, 0);
        const m = t.match(re);
        if (m) max = Math.max(max, parseInt(m[1]));
      });
      title = `${baseHost}(${max + 1})`;
    }

    addSession({
      sessionId: newId,
      host: session.host,
      username: session.username,
      status: 'connecting',
      sftp_enabled: false,
    });
    addTab({ id: newId, title, sessionId: newId });
  };

  /** Open the host dialog for a fresh connection */
  const handleNewSession = () => setOpen(true);
  return (
    <div className="flex flex-col border-b border-gray-800/50 shrink-0" style={{ backgroundColor: `${colors.background}dd` }}>
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
            {tabs.map((tab, index) => {
              const tabSession = sessions[tab.sessionId];
              const isActive = tab.id === (activeTabId || "");
              return (
              <ContextMenu key={index} modal>
                <ContextMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-3 h-8 transition-colors",
                      isActive
                        ? "text-green-500 bg-[#24253a]"
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    {tabSession?.status === 'connected' && (
                      <span className="size-1.5 rounded-full bg-green-500 mr-1.5 shrink-0" />
                    )}
                    {tab.title}
                    {tabs.length > 1 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTab(tab.id);
                        }}
                        className="ml-2 text-red-500 cursor-pointer hover:text-red-400">
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </Button>
                </ContextMenuTrigger>
                <ContextMenuContent
                  className="w-52 bg-[#1a1b26] border-gray-700"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {tabSession?.status === 'connected' && (
                    <>
                      <ContextMenuItem
                        onClick={() => handleDuplicate(tab.id)}
                        className="cursor-pointer"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate Tab
                      </ContextMenuItem>
                      <ContextMenuSeparator className="bg-gray-700/50" />
                    </>
                  )}
                  <ContextMenuItem
                    onClick={handleNewSession}
                    className="cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Connection
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-gray-700/50" />
                  <ContextMenuItem
                    onClick={() => handleRemoveTab(tab.id)}
                    className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                  >
                    <Power className="h-4 w-4 mr-2" />
                    Disconnect & Close
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              );
            })}

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
          style={{ marginRight: isRightSidebarOpen ? '24rem' : '1rem' }}
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