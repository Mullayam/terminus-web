/**
 * Tab bar for an editor split group.
 * Memoized — only re-renders when tabs in this group change.
 */
import React from "react";
import { Loader2, XIcon } from "lucide-react";
import FileIcon from "@/components/FileIcon";

export interface EditorTab {
    id: string;
    filePath: string;
    fileName: string;
    content: string | null;
    originalContent: string;
    modified: boolean;
    loading: boolean;
    error: string | null;
}

interface EditorTabBarProps {
    tabIds: string[];
    tabs: Record<string, EditorTab>;
    activeTabId: string | null;
    pinnedTabId: string;
    groupId: string;
    onSwitch: (groupId: string, tabId: string) => void;
    onClose: (tabId: string) => void;
}

function EditorTabBarInner({
    tabIds,
    tabs,
    activeTabId,
    pinnedTabId,
    groupId,
    onSwitch,
    onClose,
}: EditorTabBarProps) {
    return (
        <div
            className="flex items-center shrink-0 overflow-x-auto tab-bar-scroll"
            style={{
                background: "var(--editor-sidebar-bg, #252526)",
                borderBottom: "1px solid var(--editor-border, #3c3c3c)",
            }}
        >
            {tabIds.map((tid) => {
                const tab = tabs[tid];
                if (!tab) return null;
                const isActive = tid === activeTabId;
                return (
                    <div
                        key={tid}
                        className={`group/tab flex items-center gap-1.5 px-3 py-1 cursor-pointer text-[12px] shrink-0 transition-colors ${
                            isActive
                                ? "text-gray-200"
                                : "text-gray-500 hover:text-gray-300"
                        }`}
                        style={{
                            background: isActive ? "var(--editor-bg, #1e1e1e)" : "transparent",
                            borderRight: "1px solid var(--editor-border, #3c3c3c)",
                        }}
                        onClick={() => onSwitch(groupId, tid)}
                        onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = "var(--editor-hover-bg, #2a2d2e)";
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = "transparent";
                        }}
                    >
                        <FileIcon name={tab.fileName} isDirectory={false} size={14} />
                        <span className="truncate max-w-[120px]">{tab.fileName}</span>
                        {tab.modified && (
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                        )}
                        {tab.loading && (
                            <Loader2 className="w-3 h-3 animate-spin shrink-0 text-blue-400" />
                        )}
                        {tid !== pinnedTabId && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose(tid);
                                }}
                                className="ml-1 p-0.5 rounded opacity-0 group-hover/tab:opacity-100 hover:bg-[#3c3c3c] transition-all"
                                title="Close"
                            >
                                <XIcon className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export const EditorTabBar = React.memo(EditorTabBarInner);
