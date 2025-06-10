import { Sidebar } from "./sidebar";
import React from "react";
import { TopBar } from "./topbar";
import { useLocation } from "react-router-dom";

export function TerminalLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const location = useLocation()


    return (
        <div className="flex bg-[#1a1b26] text-white overflow-hidden">
            {/* <div className="hidden lg:flex">
                {isSidebarOpen && <Sidebar />}
            </div> */}
            <div className="flex-1 flex flex-col">
                {!location.pathname.includes("/ssh/terminal") && (
                    <TopBar
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    />
                )}
                <div className="flex flex-1">
                    <div className="w-full lg:flex">
                        {children}
                    </div>
                </div>
            </div>
            {/* Message for mobile and small devices */}
            <div className="lg:hidden flex items-center justify-center w-full h-full bg-[#1a1b26] text-center p-4">
                <p className="text-sm text-gray-400">This layout is best viewed on a larger screen.</p>
            </div>
        </div>
    );
}