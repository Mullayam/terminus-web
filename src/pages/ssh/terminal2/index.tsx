import { Sidebar } from "./sidebar";
import React from "react";
import { CommandList } from "./commandList";
import { TopBar } from "./topbar";
export function TerminalLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [isCommandList, setIsCommandList] = React.useState(true);


    return (
        <div className="flex  bg-[#1a1b26] text-white overflow-hidden">
            {isSidebarOpen && <Sidebar />}
            <div className="flex-1 flex flex-col">
                <TopBar
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    onToggleCommandList={() => setIsCommandList(!isCommandList)}
                    isCommandList={isCommandList}
                />
                <div className="flex flex-1">
                    {children}
                    {isCommandList && <CommandList />}
                </div>
            </div>
        </div>
    );
}