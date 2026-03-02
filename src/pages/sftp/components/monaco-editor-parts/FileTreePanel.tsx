/**
 * File tree sidebar panel for the Monaco editor page.
 * Memoized — only re-renders when tree data changes (not on editor state).
 */
import React, { useRef } from "react";
import { FolderTree } from "lucide-react";
import { EditorFileTree } from "@/modules/monaco-editor";
import { ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import type { EditorSftpStatus } from "@/store/editorSftpStore";
import type { FileOperations } from "@/modules/monaco-editor/components/file-tree/useFileOperations";

interface FileTreePanelProps {
    treeDir: string;
    treeFiles: any[];
    treeCollapsed: boolean;
    onFileOpen: (fullPath: string, name: string) => void;
    onNavigate: (path: string) => void;
    onRefresh: () => void;
    onCollapsedChange: (collapsed: boolean) => void;
    /** SFTP connection props — forwarded to EditorFileTree */
    sftpStatus?: EditorSftpStatus;
    sftpError?: string;
    onConnect?: () => void;
    hostLabel?: string;
    /** File operations — forwarded to EditorFileTree for context menu */
    fileOps?: FileOperations;
}

function FileTreePanelInner({
    treeDir,
    treeFiles,
    treeCollapsed,
    onFileOpen,
    onNavigate,
    onRefresh,
    onCollapsedChange,
    sftpStatus,
    sftpError,
    onConnect,
    hostLabel,
    fileOps,
}: FileTreePanelProps) {
    const panelRef = useRef<ImperativePanelHandle>(null);

    return (
        <>
            <ResizablePanel
                ref={panelRef}
                defaultSize={18}
                minSize={12}
                maxSize={35}
                collapsible
                collapsedSize={3}
                onCollapse={() => onCollapsedChange(true)}
                onExpand={() => onCollapsedChange(false)}
                className="h-full"
            >
                {treeCollapsed ? (
                    <div
                        className="flex items-start justify-center h-full pt-2"
                        style={{ background: "var(--editor-sidebar-bg, #252526)" }}
                    >                        <button
                            onClick={() => panelRef.current?.expand()}
                            className="p-1 rounded-md hover:bg-[#37373d] transition-colors"
                            title="Show Explorer"
                        >
                            <FolderTree className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>
                ) : (
                    <EditorFileTree
                        currentDir={treeDir}
                        files={treeFiles}
                        onFileOpen={onFileOpen}
                        onNavigate={onNavigate}
                        onRefresh={onRefresh}
                        collapsed={treeCollapsed}
                        onCollapsedChange={(collapsed) => {
                            if (collapsed) panelRef.current?.collapse();
                            else panelRef.current?.expand();
                        }}
                        showHiddenFiles={false}
                        sftpStatus={sftpStatus}
                        sftpError={sftpError}
                        onConnect={onConnect}
                        hostLabel={hostLabel}
                        fileOps={fileOps}
                    />
                )}
            </ResizablePanel>
            <ResizableHandle withHandle className="hover:bg-blue-500/40 transition-colors" style={{ background: "var(--editor-border, #3c3c3c)" }} />
        </>
    );
}

export const FileTreePanel = React.memo(FileTreePanelInner);
