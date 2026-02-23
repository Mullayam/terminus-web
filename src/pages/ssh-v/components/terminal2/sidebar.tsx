import { FilesIcon, KeyIcon, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

import { useSidebarState } from '@/store/sidebarStore';
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from '@/hooks/useSessionTheme';

interface NavItem {
  icon: typeof Terminal;
  label: 'Terminal' | 'SFTP';
  color?: string;
  state: boolean
}

export function Sidebar() {
  const { sessions, activeTabId } = useSSHStore()
  const { activeItem, setActiveItem } = useSidebarState()
  const { colors } = useSessionTheme();
  const [navItems, setNavItems] = useState<NavItem[]>([
    { icon: Terminal, label: 'Terminal', state: true },
  ]);
  useEffect(() => {
    if (sessions && activeTabId && sessions[activeTabId]) {
      const mySession = sessions[activeTabId]
      const sftpItem = navItems.some((item) => item.label !== "SFTP")
      sftpItem && mySession.sftp_enabled && setNavItems([...navItems, {
        label: "SFTP",
        icon: FilesIcon,
        state: mySession.sftp_enabled
      }])

    }
  }, [sessions, activeTabId])


  return (
    <div className="w-16 flex flex-col items-center py-4 border-r border-gray-800/50 shrink-0" style={{ backgroundColor: `${colors.background}ee` }}>
      {navItems.map((item) => (
        <Button
          key={item.label}
          variant="ghost"
          size="icon"
          className={cn(
            "mb-4 relative group",
            activeItem === item.label && "bg-[#24253a]"
          )}
          onClick={() => setActiveItem(item.label as any)}
        >
          <item.icon
            className={cn(
              "h-5 w-5",
              item.color || "text-gray-400",
              activeItem === item.label && "text-orange-500"
            )}
          />
        </Button>
      ))}
      <Button
      
      variant="ghost"
      size="icon"
      className={cn(
        "mb-4 relative group")}

      >
        <KeyIcon />
      </Button>
    </div>
  );
}