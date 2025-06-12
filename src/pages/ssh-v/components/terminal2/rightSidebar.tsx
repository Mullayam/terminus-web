import { useTabStore } from "@/store/rightSidebarTabStore";

import { CommandList } from "./commandList";

import TerminalShare from "./share";
import TabContainer from "./tabContainer";
import SettingsTab from "./settingsTab";

interface RightSidebarProps {
    onClose: () => void;
    isRightSidebarOpen: boolean;
}

export function RightSidebar({
    onClose,
    isRightSidebarOpen,
}: RightSidebarProps) {
    const { activeTab } = useTabStore();

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'commands':
                return <CommandList />;
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
fixed right-0 top-14 bottom-12  bg-[#1a1b26] z-20
transition-all duration-300 ease-in-out
${isRightSidebarOpen ? "w-90 translate-x-0" : "w-80 translate-x-full"}
flex flex-col shadow-lg
`}
        >
            <div className="flex items-center justify-between p-2.5 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-orange-400">{activeTab}</h2>
            </div>

            {/* Tab Container */}
            <div className="h-full overflow-hidden">
                <TabContainer>
                    {renderActiveTab()}
                </TabContainer>
            </div>
        </div>
    );
}
