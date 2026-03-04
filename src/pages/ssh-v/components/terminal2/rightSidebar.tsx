import { useTabStore } from "@/store/rightSidebarTabStore";
import { useEffect } from "react";

import { CommandList } from "./commandList";
import CommandHistory from "./commandHistory";
import CommandPacks from "./commandPacks";

import TerminalShare from "./share";
import TabContainer from "./tabContainer";
import SettingsTab from "./settingsTab";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { getInstalledCategories } from "@/lib/context-engine/contextEngineStorage";

interface RightSidebarProps {
    onClose: () => void;
    isRightSidebarOpen: boolean;
}

export function RightSidebar({
    onClose,
    isRightSidebarOpen,
}: RightSidebarProps) {
    const { activeTab, checkForUpdate, setInstalledPacksCount } = useTabStore();
    const { colors } = useSessionTheme();

    // On first mount: fetch version info + installed packs count
    useEffect(() => {
        checkForUpdate();
        getInstalledCategories().then((cats) => setInstalledPacksCount(cats.length)).catch(() => {});
    }, []);

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'commands':
                return <CommandList />;
            case 'history':
                return <CommandHistory />;
            case 'extensions':
                return <CommandPacks />;
            case 'sharing':
                return <TerminalShare />;
            case 'settings':
                return <SettingsTab />;
            default:
                return <CommandList />;
        }
    };

    return (
        <div
            className={`
fixed right-0 top-14 bottom-12 z-20
transition-all duration-300 ease-in-out
${isRightSidebarOpen ? "w-96 translate-x-0" : "w-96 translate-x-full"}
flex flex-col shadow-lg themed-scrollbar
`}
            style={{
                backgroundColor: colors.background,
                "--sb-thumb": `${colors.foreground}30`,
                "--sb-thumb-hover": `${colors.foreground}50`,
                "--sb-track": `${colors.foreground}08`,
            } as React.CSSProperties}
        >
            {/* Tab Container */}
            <div className="h-full overflow-hidden">
                <TabContainer>
                    {renderActiveTab()}
                </TabContainer>
            </div>
        </div>
    );
}
