import { Boxes, FileBadge, FilesIcon, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import { useSidebarState } from "@/store/sidebarStore";
import { useSSHStore } from "@/store/sshStore";
import { useTabStore } from "@/store/rightSidebarTabStore";
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
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const setRightSidebarOpen = useTabStore((s) => s.setRightSidebarOpen);
  const rightSidebarOpen = useTabStore((s) => s.rightSidebarOpen);
  const activeTab = useTabStore((s) => s.activeTab);
  const { colors } = useSessionTheme();
  const navigate = useNavigate();

  const [navItems, setNavItems] = useState<NavItem[]>([
    { icon: Terminal, label: "Terminal", state: true },
  ]);

  useEffect(() => {
    if (sessions && activeTabId && sessions[activeTabId]) {
      const currentHost = sessions[activeTabId]?.host;
      // Show SFTP if any session connected to the same host has SFTP enabled
      const anySftpEnabled = Object.values(sessions).some(
        (s) => s.host === currentHost && s.sftp_enabled
      );
      const hasSftp = navItems.some((item) => item.label === "SFTP");
      if (!hasSftp && anySftpEnabled) {
        setNavItems((prev) => [
          ...prev,
          {
            label: "SFTP",
            icon: FilesIcon,
            url: "/ssh/sftp",
            state: true,
          },
        ]);
      }
    }
  }, [sessions, activeTabId]);

  const handleClick = (item: NavItem) => {
    setActiveItem(item.label as any);
    if (item.url) navigate(item.url);
  };

  const widgetsActive = rightSidebarOpen && activeTab === "widgets";
  const openWidgets = () => {
    setActiveTab("widgets");
    setRightSidebarOpen(!widgetsActive);
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

      {/* Widget Center launcher */}
      <Button
        variant="ghost"
        size="icon"
        title="Widgets"
        className={cn("mb-4 relative group", widgetsActive && "bg-[#24253a]")}
        onClick={openWidgets}
      >
        <Boxes className={cn("h-5 w-5", widgetsActive ? "text-orange-500" : "text-gray-400")} />
      </Button>
    </div>
  );
}
