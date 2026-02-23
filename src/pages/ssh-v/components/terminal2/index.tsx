import { Sidebar } from "./sidebar";
import React from "react";
import { TopBar } from "./topbar";
import { RightSidebar } from "./rightSidebar";
import { useSessionTheme } from "@/hooks/useSessionTheme";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = React.useState(false);
    const { colors } = useSessionTheme();

    return (
        <>
            <div className="hidden lg:flex h-full text-white overflow-hidden" style={{ backgroundColor: colors.background }}>
                <div className="flex h-full">
                    {isSidebarOpen && <Sidebar />}
                </div>
                <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <TopBar
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                        isRightSidebarOpen={isRightSidebarOpen}
                    />
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        <div className="w-full h-full flex min-h-0 overflow-hidden">
                            {children}
                        </div>
                    </div>
                    <RightSidebar isRightSidebarOpen={isRightSidebarOpen} onClose={() => setIsRightSidebarOpen(false)} />
                </div>
            </div>
            <div className="flex lg:hidden items-center justify-center w-full h-full text-center p-4" style={{ backgroundColor: colors.background }}>
                <p className="text-sm" style={{ color: colors.foreground }}>This layout is best viewed on a larger screen.</p>
            </div>
        </>
    );
}
