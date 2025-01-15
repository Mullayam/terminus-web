import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SideBarSheet } from './sidebarSheet';
import { useStore } from '@/store';
import { HostDialog } from './hostDialog';
import React from 'react';
import { useSockets } from '@/hooks/use-sockets';
import { SocketEventConstants } from '@/lib/sockets/event-constants';

export interface Tab {
  id: number;
  title: string;
}

interface TopBarProps {
  onToggleSidebar: () => void;

}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const store = useStore();
  const [open, setOpen] = React.useState(false)
  const {socket}=useSockets()
const handleRemoveTab = (index: number) => {
  socket.emit(SocketEventConstants.SSH_DISCONNECTED,store.tabs[index].uid)
  store.removeTab(index)
}
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
            {store.tabs.map((tab, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => store.setActiveTab(index)}
                className={cn(
                  "px-3 h-8 transition-colors",
                  store.activeTab === index
                    ? "text-green-500 bg-[#24253a]"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >
                Terminal {index + 1}
                {store.tabs.length > 1 && (
                  <span onClick={() => handleRemoveTab(index)} className="ml-2 text-red-500 cursor-pointer">
                    ✕
                  </span>
                )}

              </Button>
            ))}
            {store.tabs.length < 10 && (
              <Button variant={"outline"} onClick={() => setOpen(true)} className={"p-3 h-8  rounded-full transition-colors text-gray-400 hover:text-gray-300"}>
                <Plus className="h-4 w-4" />
              </Button>
            )}

          </div>
        </div>
        <div className="flex items-center space-x-4 mx-4">
          <SideBarSheet />
        </div>
        <HostDialog open={open} setOpen={setOpen} />
      </div>
    </div>
  );
}