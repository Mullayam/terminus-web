import { Copy, Plus, PlusCircle, Power, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSFTPStore } from '@/store/sftpStore';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { nanoid } from '../utils/nanoid';

interface SFTPTabBarProps {
  onAddTab: () => void;
}

export function SFTPTabBar({ onAddTab }: SFTPTabBarProps) {
  const { tabs, sessions, activeTabId, setActiveTab, removeTab, addTab, addSession } = useSFTPStore();

  /** Disconnect socket + remove tab + clean up session */
  const handleDisconnectAndClose = (e: React.MouseEvent | undefined, tabId: string) => {
    e?.stopPropagation();
    removeTab(tabId);
  };

  /** Duplicate: open a new tab pre-connected with same host/creds */
  const handleDuplicate = (tabId: string) => {
    const session = sessions[tabId];
    if (!session) return;
    const newId = nanoid();
    addTab({ id: newId, title: session.host || `SFTP ${tabs.length + 1}` });
    addSession({
      tabId: newId,
      host: session.host,
      username: session.username,
      status: 'idle',
      password: session.password,
      authMethod: session.authMethod,
      isConnecting: false,
      isConnected: false,
      isSftpConnected: false,
      loading: false,
      isError: false,
      currentDir: '',
      homeDir: '',
      title: session.host || '',
      remoteFiles: [],
    });
  };

  /** Create new session (blank form) */
  const handleNewSession = () => {
    onAddTab();
  };

  return (
    <div className="h-11 flex items-center px-4 border-b border-gray-800/50 bg-[#0A0A0A] shrink-0">
      <div className="flex-1 flex items-center space-x-2 overflow-x-auto">
        {tabs.map((tab) => {
          const session = sessions[tab.id];
          const isConnected = session?.isSftpConnected;
          const isActive = tab.id === activeTabId;
          return (
            <ContextMenu key={tab.id} modal>
              <ContextMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-3 h-8 transition-colors flex items-center gap-1.5 shrink-0',
                    isActive
                      ? 'text-green-500 bg-[#1a1b26]'
                      : 'text-gray-400 hover:text-gray-300'
                  )}
                >
                  {isConnected && (
                    <span className="size-1.5 rounded-full bg-green-500 shrink-0" />
                  )}
                  <span className="truncate max-w-[140px]">
                    {session?.host || tab.title}
                  </span>
                  {tabs.length > 0 && (
                    <span
                      onClick={(e) => handleDisconnectAndClose(e, tab.id)}
                      className="ml-1 text-red-500 cursor-pointer hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Button>
              </ContextMenuTrigger>
              <ContextMenuContent
                className="w-52 bg-[#1a1b26] border-gray-700"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                {isConnected && (
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
                  onClick={() => handleDisconnectAndClose(undefined, tab.id)}
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
          <Button
            variant="outline"
            onClick={onAddTab}
            className="p-3 h-8 rounded-full transition-colors text-gray-400 hover:text-gray-300"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
