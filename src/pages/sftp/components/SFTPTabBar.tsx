import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSFTPStore } from '@/store/sftpStore';

export function SFTPTabBar({ onAddTab }: { onAddTab: () => void }) {
  const { tabs, activeTabId, setActiveTab, removeTab, removeSession } = useSFTPStore();

  const handleRemoveTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const session = useSFTPStore.getState().sessions[tabId];
    if (session?.socket) {
      session.socket.disconnect();
    }
    removeSession(tabId);
    removeTab(tabId);
  };

  return (
    <div className="h-11 flex items-center px-4 border-b border-gray-800/50 bg-[#0A0A0A] shrink-0">
      <div className="flex-1 flex items-center space-x-2 overflow-x-auto">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 h-8 transition-colors flex items-center gap-1.5 shrink-0',
              tab.id === activeTabId
                ? 'text-green-500 bg-[#1a1b26]'
                : 'text-gray-400 hover:text-gray-300'
            )}
          >
            <span className="truncate max-w-[140px]">{tab.title}</span>
            {tabs.length > 1 && (
              <span
                onClick={(e) => handleRemoveTab(e, tab.id)}
                className="ml-1 text-red-500 cursor-pointer hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </Button>
        ))}

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
