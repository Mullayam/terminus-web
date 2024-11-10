import { Sidebar } from "./sidebar";
import React from "react";
import { Tab, TopBar } from "./topbar";
import { useLocation } from "react-router-dom";
import { SidebarTabs } from "./sidebar-tabs";

export function TerminalLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [isCommandList, setIsCommandList] = React.useState(true);
    const [tabs, setTabs] = React.useState<Tab[]>([{ id: 1, title: "Terminal 1" }]); // Initial tab
    const [activeTab, setActiveTab] = React.useState(1);
    const location = useLocation()
    // Add a new tab
    const addTab = () => {
        const newTabId = tabs.length + 1;
        setTabs([...tabs, { id: newTabId, title: `Terminal ${tabs.length + 1}` }]);
        setActiveTab(newTabId); // Set the new tab as active
    };

    // Remove a tab
    const removeTab = (id: number) => {
        setTabs(tabs.filter((tab) => tab.id !== id));
        setActiveTab(id);

    };
    const handleActive = (id: number) => {
        setActiveTab(id);
    };

    return (
        <div className="flex bg-[#1a1b26] text-white overflow-hidden">
        <div className="hidden lg:flex">
            {isSidebarOpen && <Sidebar />}
        </div>
        <div className="flex-1 flex flex-col">
            {!location.pathname.includes("/ssh/terminal") && (
                <TopBar
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    onToggleCommandList={() => setIsCommandList(!isCommandList)}
                    isCommandList={isCommandList}
                    tabs={tabs}
                    handleActive={handleActive}
                    activeTab={activeTab}
                    onAddTab={addTab}
                    onRemoveTab={removeTab}
                />
            )}
            <div className="flex flex-1">
                <div className="w-full lg:flex">
                    {children}
                    {isCommandList && <SidebarTabs />}
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