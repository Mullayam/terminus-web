import { Sidebar } from "./sidebar";
import React from "react";
import { TopBar } from "./topbar";
import { useLocation } from "react-router-dom";
import { RightSidebar } from "./rightSidebar";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = React.useState(false);
    const location = useLocation()
    
    return (
        <div className="flex h-screen bg-[#1a1b26] text-white overflow-hidden">  
            <div className="hidden lg:flex">
                {isSidebarOpen && <Sidebar />}
            </div>
            <div className="flex-1 flex flex-col min-w-0">                        
                <TopBar
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                    isRightSidebarOpen={isRightSidebarOpen}
                />
                <div className="flex flex-1 min-h-0">                          
                    <div className="w-full flex min-h-0">                    
                        {children}
                    </div>
                </div>
                <RightSidebar isRightSidebarOpen={isRightSidebarOpen} onClose={() => setIsRightSidebarOpen(false)} />
            </div>
            <div className="lg:hidden flex items-center justify-center w-full h-full bg-[#1a1b26] text-center p-4">
                <p className="text-sm text-gray-400">This layout is best viewed on a larger screen.</p>
            </div>
        </div>
    );
}
