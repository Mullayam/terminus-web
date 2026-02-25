import { FileBadge, FilesIcon, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import { useSidebarState } from "@/store/sidebarStore";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { Link, useNavigate } from "react-router-dom";

interface NavItem {
  icon: typeof Terminal;
  label: "Terminal" | "SFTP";
  color?: string;
  url?: string;
  state: boolean;
}

export function Sidebar() {
  const { sessions, activeTabId } = useSSHStore();
  const { activeItem, setActiveItem } = useSidebarState();
  const { colors } = useSessionTheme();
  const navigate = useNavigate();

  const [navItems, setNavItems] = useState<NavItem[]>([
    { icon: Terminal, label: "Terminal", state: true },
  ]);

  useEffect(() => {
    if (sessions && activeTabId && sessions[activeTabId]) {
      const mySession = sessions[activeTabId];
      // Only add SFTP if it isn't already in the list
      const hasSftp = navItems.some((item) => item.label === "SFTP");
      if (!hasSftp && mySession.sftp_enabled) {
        setNavItems((prev) => [
          ...prev,
          {
            label: "SFTP",
            icon: FilesIcon,
            url: "/ssh/sftp",
            state: mySession.sftp_enabled,
          },
        ]);
      }
    }
  }, [sessions, activeTabId]);

  const handleClick = (item: NavItem) => {
    setActiveItem(item.label as any);
    if (item.url) navigate(item.url);
  };

  return (
    <div
      className="w-16 flex flex-col items-center py-4 border-r border-gray-800/50 shrink-0"
      style={{ backgroundColor: `${colors.background}ee` }}
    >
      {navItems.map((item) => (
        <Button
          key={item.label}
          variant="ghost"
          size="icon"
          title={item.label}
          className={cn(
            "mb-4 relative group",
            activeItem === item.label && "bg-[#24253a]",
          )}
          onClick={() => handleClick(item)}
        >
          <item.icon
            className={cn(
              "h-5 w-5",
              item.color || "text-gray-400",
              activeItem === item.label && "text-orange-500",
            )}
          />
        </Button>
      ))}

      {/* Quick link to SFTP page — always visible */}
      <Link to="/ssh/sftp">
        <Button
          variant="ghost"
          size="icon"
          title="Open SFTP"
          className={cn("mb-4 relative group")}
        >
          <FileBadge className="h-5 w-5 text-gray-400" />
        </Button>
      </Link>
    </div>
  );
}
