import { Sidebar } from "./sidebar";
import React from "react";
import { TopBar } from "./topbar";
import { RightSidebar } from "./rightSidebar";
import { AIChatPanel } from "./ai-chat";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useSSHStore } from "@/store/sshStore";
import { useTabStore } from "@/store/rightSidebarTabStore";
import { useAIChatStore } from "@/store/aiChatStore";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = React.useState(false);
    const setRightSidebarOpen = useTabStore((s) => s.setRightSidebarOpen);
    const isAIChatOpen = useAIChatStore((s) => s.isOpen);
    const closeAIChat = useAIChatStore((s) => s.close);
    const { colors } = useSessionTheme();
    const activeTabId = useSSHStore((s) => s.activeTabId);
    const activeTab = useSSHStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
    const sessionId = activeTab?.sessionId;

    // Close sidebar when AI chat opens
    React.useEffect(() => {
        if (isAIChatOpen && isRightSidebarOpen) {
            setIsRightSidebarOpen(false);
            setRightSidebarOpen(false);
        }
    }, [isAIChatOpen]);

    const handleToggleRightSidebar = () => {
        const next = !isRightSidebarOpen;
        setIsRightSidebarOpen(next);
        setRightSidebarOpen(next);
        // Close AI chat when opening sidebar
        if (next && isAIChatOpen) {
            closeAIChat();
        }
    };

    return (
        <>
            <div className="hidden lg:flex h-full text-white overflow-hidden" style={{ backgroundColor: colors.background }}>
                <div className="flex h-full">
                    {isSidebarOpen && <Sidebar />}
                </div>
                <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <TopBar
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        onToggleRightSidebar={handleToggleRightSidebar}
                        isRightSidebarOpen={isRightSidebarOpen}
                    />
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        <div className="w-full h-full flex min-h-0 overflow-hidden">
                            {children}
                        </div>
                    </div>
                    <RightSidebar isRightSidebarOpen={isRightSidebarOpen} onClose={() => { setIsRightSidebarOpen(false); setRightSidebarOpen(false); }} />
                    {/* AI Chat Panel — overlays the terminal without shrinking it */}
                    {sessionId && <AIChatPanel sessionId={sessionId} />}
                </div>
            </div>
            <div className="flex lg:hidden items-center justify-center w-full h-full text-center p-4" style={{ backgroundColor: colors.background }}>
                <p className="text-sm" style={{ color: colors.foreground }}>This layout is best viewed on a larger screen.</p>
            </div>
        </>
    );
}
