import { Sidebar } from "./sidebar";
import React from "react";
import { CommandList } from "./commandList";
import { TopBar } from "./topbar";
import XTerminal from "../Terminal";
export function Terminal2() {
    const [isSidebarOpen, setIsSidebarOpen] =React.useState(true);
    const [isCommandList, setIsCommandList] =React.useState(true);


    return (
        <div className="flex h-screen bg-[#1a1b26] text-white overflow-hidden">
            {isSidebarOpen && <Sidebar />}
            <div className="flex-1 flex flex-col min-h-0">
                <TopBar 
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
                onToggleCommandList={() => setIsCommandList(!isCommandList)} 
                isCommandList={isCommandList}
                />
                <div className="flex flex-1">
                    <XTerminal backgroundColor={"#1a1b26"}/>
                    {isCommandList && <CommandList />}   
                </div>
            </div>
        </div>
    );
}