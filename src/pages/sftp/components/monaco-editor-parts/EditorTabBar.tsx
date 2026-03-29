/**
 * Tab bar for an editor split group.
 * Memoized — only re-renders when tabs in this group change.
 * Includes VS Code-style right-click context menu with:
 *   Close, Close to the Left, Close to the Right, Close All,
 *   Close Saved, Split Right.
 */
import React from "react";
import { Loader2, XIcon, ArrowLeftToLine, ArrowRightToLine, XCircle, SplitSquareHorizontal, CheckCircle2 } from "lucide-react";
import FileIcon from "@/components/FileIcon";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

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
    onCloseToLeft?: (tabId: string) => void;
    onCloseToRight?: (tabId: string) => void;
    onCloseAll?: () => void;
    onCloseSaved?: () => void;
    onSplitRight?: (tabId: string) => void;
    /** Extra content rendered at the end of the tab bar (e.g. view panel tabs) */
    children?: React.ReactNode;
}

/* ── Shared styles ───────────────────────────────────────── */

const menuContentStyle: React.CSSProperties = {
    background: "var(--editor-sidebar-bg, #252526)",
    border: "1px solid var(--editor-border, #3c3c3c)",
    color: "var(--editor-fg, #cccccc)",
    minWidth: 180,
    zIndex: 100,
    boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
};

const menuItemClass =
    "flex items-center gap-2 px-2.5 py-1.5 text-[12px] cursor-pointer rounded-sm outline-none " +
    "transition-colors duration-75 " +
    "focus:bg-[var(--editor-hover-bg,#37373d)] focus:text-[var(--editor-fg,#ffffff)] " +
    "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none";

const separatorStyle: React.CSSProperties = {
    background: "var(--editor-border, #3c3c3c)",
};

function EditorTabBarInner({
    tabIds,
    tabs,
    activeTabId,
    pinnedTabId,
    groupId,
    onSwitch,
    onClose,
    onCloseToLeft,
    onCloseToRight,
    onCloseAll,
    onCloseSaved,
    onSplitRight,
    children,
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
                const isPinned = tid === pinnedTabId;
                return (
                    <ContextMenu key={tid}>
                        <ContextMenuTrigger asChild>
                            <div
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
                                {!isPinned && (
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
                        </ContextMenuTrigger>

                        <ContextMenuContent
                            className="rounded-md p-1 backdrop-blur-sm"
                            style={menuContentStyle}
                        >
                            {/* Close */}
                            <ContextMenuItem
                                className={menuItemClass}
                                disabled={isPinned}
                                onSelect={() => { if (!isPinned) onClose(tid); }}
                            >
                                <XIcon className="h-3.5 w-3.5 opacity-70" />
                                Close
                            </ContextMenuItem>

                            <ContextMenuSeparator style={separatorStyle} />

                            {/* Close to the Left */}
                            <ContextMenuItem
                                className={menuItemClass}
                                onSelect={() => onCloseToLeft?.(tid)}
                            >
                                <ArrowLeftToLine className="h-3.5 w-3.5 opacity-70" />
                                Close to the Left
                            </ContextMenuItem>

                            {/* Close to the Right */}
                            <ContextMenuItem
                                className={menuItemClass}
                                onSelect={() => onCloseToRight?.(tid)}
                            >
                                <ArrowRightToLine className="h-3.5 w-3.5 opacity-70" />
                                Close to the Right
                            </ContextMenuItem>

                            <ContextMenuSeparator style={separatorStyle} />

                            {/* Close All */}
                            <ContextMenuItem
                                className={menuItemClass}
                                onSelect={() => onCloseAll?.()}
                            >
                                <XCircle className="h-3.5 w-3.5 opacity-70" />
                                Close All
                            </ContextMenuItem>

                            {/* Close Saved */}
                            <ContextMenuItem
                                className={menuItemClass}
                                onSelect={() => onCloseSaved?.()}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 opacity-70" />
                                Close Saved
                            </ContextMenuItem>

                            <ContextMenuSeparator style={separatorStyle} />

                            {/* Split Right */}
                            <ContextMenuItem
                                className={menuItemClass}
                                onSelect={() => onSplitRight?.(tid)}
                            >
                                <SplitSquareHorizontal className="h-3.5 w-3.5 opacity-70" />
                                Split Right
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>
                );
            })}
            {children}
        </div>
    );
}

export const EditorTabBar = React.memo(EditorTabBarInner);
