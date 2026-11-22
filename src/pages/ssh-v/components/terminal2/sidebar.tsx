import { Boxes, FileBadge, FolderOpen, SquareTerminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useActiveSessionId, useSessionView, useSidebarState } from "@/store/sidebarStore";
import { useTabStore } from "@/store/rightSidebarTabStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { Link } from "react-router-dom";

export function Sidebar() {
  const sessionId = useActiveSessionId();
  const activeItem = useSessionView(sessionId);
  const setView = useSidebarState((s) => s.setView);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const setRightSidebarOpen = useTabStore((s) => s.setRightSidebarOpen);
  const rightSidebarOpen = useTabStore((s) => s.rightSidebarOpen);
  const activeTab = useTabStore((s) => s.activeTab);
  const { colors } = useSessionTheme();

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
      {/* SSH <-> SFTP switch for the current tab. The icon shows where it
          takes you: a folder on the terminal, a terminal on the SFTP tab. */}
      <Button
        variant="ghost"
        size="icon"
        title={activeItem === "SFTP" ? "Back to SSH (terminal)" : "Open SFTP tab (files)"}
        disabled={!sessionId}
        className="mb-4 relative group"
        onClick={() => sessionId && setView(sessionId, activeItem === "SFTP" ? "Terminal" : "SFTP")}
      >
        {activeItem === "SFTP"
          ? <SquareTerminal className="h-5 w-5 text-green-500" />
          : <FolderOpen className="h-5 w-5 text-sky-400" />}
      </Button>

      {/* Quick link to the standalone SFTP page — always visible */}
      <Link to="/ssh/sftp">
        <Button
          variant="ghost"
          size="icon"
          title="Open SFTP page"
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
