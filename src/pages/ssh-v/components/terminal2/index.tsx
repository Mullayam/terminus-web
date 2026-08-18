import { Sidebar } from "./sidebar";
import React from "react";
import { LayoutGrid, X } from "lucide-react";
import { TopBar } from "./topbar";
import { RightSidebar } from "./rightSidebar";
import { AIChatPanel } from "./ai-chat";
import ResourceMonitor from "./resource-monitor";
import DockerWidget from "./docker-widget";
import KubernetesWidget from "./kubernetes-widget";
import CustomWidget from "./custom-widget";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useSSHStore } from "@/store/sshStore";
import { useTabStore } from "@/store/rightSidebarTabStore";
import { useAIChatStore } from "@/store/aiChatStore";
import { useMonitorStore } from "@/store/monitorStore";
import { useDockerStore } from "@/store/dockerStore";
import { useKubernetesStore } from "@/store/kubernetesStore";
import { useWidgetStore } from "@/store/widgetStore";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = React.useState(false);
    const setRightSidebarOpen = useTabStore((s) => s.setRightSidebarOpen);
    const storeRightSidebarOpen = useTabStore((s) => s.rightSidebarOpen);
    const isAIChatOpen = useAIChatStore((s) => s.isOpen);
    const closeAIChat = useAIChatStore((s) => s.close);
    const isMonitorOpen = useMonitorStore((s) => s.isOpen);
    const closeMonitor = useMonitorStore((s) => s.close);
    const isDockerOpen = useDockerStore((s) => s.isOpen);
    const closeDocker = useDockerStore((s) => s.close);
    const isKubernetesOpen = useKubernetesStore((s) => s.isOpen);
    const closeKubernetes = useKubernetesStore((s) => s.close);
    const widgetDefs = useWidgetStore((s) => s.defs);
    const openWidgetIds = useWidgetStore((s) => s.openIds);
    const loadWidgets = useWidgetStore((s) => s.load);
    const closeWidget = useWidgetStore((s) => s.close);
    const dashboard = useWidgetStore((s) => s.dashboard);
    const toggleDashboard = useWidgetStore((s) => s.toggleDashboard);
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

    React.useEffect(() => { loadWidgets(); }, [loadWidgets]);

    // Let external triggers (e.g. the left-sidebar Widgets button) open the panel.
    React.useEffect(() => { setIsRightSidebarOpen(storeRightSidebarOpen); }, [storeRightSidebarOpen]);

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
                    {/* Floating resource monitor */}
                    {sessionId && isMonitorOpen && <ResourceMonitor sessionId={sessionId} onClose={closeMonitor} />}
                    {/* Floating docker panel */}
                    {sessionId && isDockerOpen && <DockerWidget sessionId={sessionId} onClose={closeDocker} />}
                    {/* Floating kubernetes panel */}
                    {sessionId && isKubernetesOpen && <KubernetesWidget sessionId={sessionId} onClose={closeKubernetes} />}
                    {/* Floating custom widgets */}
                    {sessionId && !dashboard && openWidgetIds.map((id, i) => {
                        const def = widgetDefs.find((d) => d.id === id);
                        return def ? <CustomWidget key={id} def={def} sessionId={sessionId} index={i} onClose={() => closeWidget(id)} /> : null;
                    })}
                    {/* Dashboard grid — tiles all open widgets into a snap grid */}
                    {sessionId && dashboard && (
                        <div
                            style={{
                                position: "fixed", inset: 0, zIndex: 55,
                                background: `${colors.background}f2`,
                                backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
                                display: "flex", flexDirection: "column",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${colors.foreground}22` }}>
                                <LayoutGrid size={16} style={{ color: colors.cyan }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: colors.foreground }}>Dashboard</span>
                                <span style={{ fontSize: 11, color: `${colors.foreground}66` }}>{openWidgetIds.length} widget{openWidgetIds.length === 1 ? "" : "s"}</span>
                                <div style={{ flex: 1 }} />
                                <button onClick={toggleDashboard} title="Exit dashboard" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.foreground, background: `${colors.foreground}12`, border: `1px solid ${colors.foreground}22`, borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>
                                    <X size={14} /> Exit
                                </button>
                            </div>
                            {openWidgetIds.length === 0 ? (
                                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: `${colors.foreground}77` }}>
                                    No open widgets. Open some from the Widget Center to fill the dashboard.
                                </div>
                            ) : (
                                <div
                                    className="scrollbar-green"
                                    style={{
                                        flex: 1, overflow: "auto", padding: 16,
                                        display: "grid", gap: 16,
                                        gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                                        gridAutoRows: "minmax(220px, auto)",
                                        alignContent: "start",
                                    }}
                                >
                                    {openWidgetIds.map((id, i) => {
                                        const def = widgetDefs.find((d) => d.id === id);
                                        return def ? <CustomWidget key={id} def={def} sessionId={sessionId} index={i} docked onClose={() => closeWidget(id)} /> : null;
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex lg:hidden items-center justify-center w-full h-full text-center p-4" style={{ backgroundColor: colors.background }}>
                <p className="text-sm" style={{ color: colors.foreground }}>This layout is best viewed on a larger screen.</p>
            </div>
        </>
    );
}
