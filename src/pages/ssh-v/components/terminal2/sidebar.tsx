import { Boxes, FileBadge, FolderOpen, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useActiveSessionId, useSessionView, useSidebarState, type SessionView } from "@/store/sidebarStore";
import { useTabStore } from "@/store/rightSidebarTabStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { Link } from "react-router-dom";

interface NavItem {
  icon: typeof Terminal;
  view: SessionView;
  title: string;
}

/** Both views live inside the current SSH tab; switching never leaves the page. */
const NAV_ITEMS: NavItem[] = [
  { icon: Terminal, view: "Terminal", title: "Terminal" },
  { icon: FolderOpen, view: "SFTP", title: "Files (SFTP) in this tab" },
];

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
      {NAV_ITEMS.map((item) => (
        <Button
          key={item.view}
          variant="ghost"
          size="icon"
          title={item.title}
          disabled={!sessionId}
          className={cn(
            "mb-4 relative group",
            activeItem === item.view && "bg-[#24253a]",
          )}
          onClick={() => sessionId && setView(sessionId, item.view)}
        >
          <item.icon
            className={cn(
              "h-5 w-5 text-gray-400",
              activeItem === item.view && "text-orange-500",
            )}
          />
        </Button>
      ))}

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
