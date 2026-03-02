/**
 * @module components/EditorFileTree
 *
 * Lightweight file-system tree for the Monaco editor page.
 * Renders a recursive, collapsible tree populated from a flat
 * file-list (typically coming from SFTP socket events).
 *
 * Now includes VS Code-style right-click context menu with:
 *   New File / New Folder, Cut / Copy / Paste, Rename, Move,
 *   Delete, Upload File / Upload Folder, Copy Path.
 *
 * All file-tree sub-components live in `./file-tree/` and are
 * wired through the `FileOperations` callback interface passed
 * via props.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FolderTree,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import FileIcon from "@/components/FileIcon";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { EditorSftpStatus } from "@/store/editorSftpStore";
import type { FileOperations } from "./file-tree/useFileOperations";
import type { ContextMenuActions } from "./file-tree/FileTreeContextMenu";
import { FileTreeContextMenu } from "./file-tree/FileTreeContextMenu";
import { InlineTreeInput } from "./file-tree/InlineTreeInput";
import { ConfirmDeleteDialog } from "./file-tree/ConfirmDeleteDialog";
import { MoveToDialog } from "./file-tree/MoveToDialog";
import { FileUploadDialog } from "./file-tree/FileUploadDialog";

/* ── Tree data model ─────────────────────────────────────── */

export interface FileTreeNode {
  name: string;
  fullPath: string;
  /** "d" = directory, "-" = file, etc. */
  type: string;
  children: Map<string, FileTreeNode>;
  isLoaded: boolean;
}

/* ── Clipboard model for cut/copy/paste ───────────────────── */
interface ClipboardEntry {
  node: FileTreeNode;
  mode: "cut" | "copy";
}

export interface EditorFileTreeProps {
  /** Current directory path */
  currentDir: string;
  /** Flat list of items in currentDir */
  files: { name?: string; type?: string; [k: string]: any }[];
  /** Called when user clicks a file (not a directory) */
  onFileOpen?: (fullPath: string, name: string) => void;
  /** Called when user navigates into a directory */
  onNavigate?: (path: string) => void;
  /** Called when user clicks refresh */
  onRefresh?: () => void;
  /** Collapsed state */
  collapsed?: boolean;
  /** Collapsed state change */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Whether to show dot-prefixed files */
  showHiddenFiles?: boolean;
  /** Optional render custom children below the tree */
  children?: React.ReactNode;

  /* ── SFTP connection props ─────────────────────────────── */
  /** Current SFTP connection status for the editor tree */
  sftpStatus?: EditorSftpStatus;
  /** Error message when sftpStatus === "error" */
  sftpError?: string;
  /** Called when user confirms they want to connect */
  onConnect?: () => void;
  /** The host name to display in the connect dialog */
  hostLabel?: string;

  /* ── File operations (context menu) ────────────────────── */
  /** Socket-backed file operations from useFileOperations hook */
  fileOps?: FileOperations;
}

/* ── Helpers ──────────────────────────────────────────────── */

function pathSegments(p: string): string[] {
  return p.split("/").filter(Boolean);
}

function cloneTree(node: FileTreeNode): FileTreeNode {
  const clone: FileTreeNode = { ...node, children: new Map() };
  for (const [k, v] of node.children) {
    clone.children.set(k, cloneTree(v));
  }
  return clone;
}

function ensurePath(root: FileTreeNode, absPath: string): FileTreeNode {
  const segs = pathSegments(absPath);
  let cursor = root;
  let accum = "";
  for (const seg of segs) {
    accum += "/" + seg;
    if (!cursor.children.has(seg)) {
      cursor.children.set(seg, {
        name: seg,
        fullPath: accum,
        type: "d",
        children: new Map(),
        isLoaded: false,
      });
    }
    cursor = cursor.children.get(seg)!;
  }
  return cursor;
}

/* ── Recursive tree item ─────────────────────────────────── */

function TreeItem({
  node,
  depth,
  currentDir,
  expandedPaths,
  onToggle,
  onNavigate,
  onFileOpen,
  showHiddenFiles,
  isLast,
  contextActions,
  hasClipboard,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  newItemState,
  onNewItemSubmit,
  onNewItemCancel,
}: {
  node: FileTreeNode;
  depth: number;
  currentDir: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onNavigate?: (path: string) => void;
  onFileOpen?: (fullPath: string, name: string) => void;
  showHiddenFiles: boolean;
  isLast: boolean;
  contextActions: ContextMenuActions;
  hasClipboard: boolean;
  renamingPath: string | null;
  onRenameSubmit: (oldPath: string, newName: string) => void;
  onRenameCancel: () => void;
  newItemState: { parentDir: string; type: "file" | "folder" } | null;
  onNewItemSubmit: (name: string) => void;
  onNewItemCancel: () => void;
}) {
  const isDir = node.type === "d";
  const isActive = node.fullPath === currentDir;
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = node.children.size > 0;

  const sortedChildren = useMemo(() => {
    const arr = Array.from(node.children.values()).filter((child) => {
      if (!showHiddenFiles && child.name.startsWith(".")) return false;
      return true;
    });
    return arr.sort((a, b) => {
      if (a.type === "d" && b.type !== "d") return -1;
      if (a.type !== "d" && b.type === "d") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [node.children, showHiddenFiles]);

  const handleClick = () => {
    if (isDir) {
      onToggle(node.fullPath);
      onNavigate?.(node.fullPath);
    } else {
      onFileOpen?.(node.fullPath, node.name);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.fullPath);
  };

  return (
    <>
      {/* Show inline rename input when renaming this node */}
      {renamingPath === node.fullPath ? (
        <InlineTreeInput
          defaultValue={node.name}
          isDirectory={isDir}
          depth={depth}
          onSubmit={(newName) => onRenameSubmit(node.fullPath, newName)}
          onCancel={onRenameCancel}
          placeholder="Enter new name…"
        />
      ) : (
        <FileTreeContextMenu
          node={node}
          actions={contextActions}
          hasClipboard={hasClipboard}
        >
          <div
            role="treeitem"
            aria-expanded={isDir ? isExpanded : undefined}
            className={cn(
              "group flex items-center gap-1 py-[3px] pr-2 cursor-pointer text-sm select-none whitespace-nowrap",
              "hover:bg-[var(--editor-hover-bg,#2a2d2e)] rounded-sm transition-colors duration-100",
              isActive && "bg-[var(--editor-hover-bg,#37373d)] font-medium",
            )}
            style={{
              paddingLeft: `${depth * 16 + 8}px`,
              color: isActive ? "var(--editor-fg, white)" : undefined,
            }}
            onClick={handleClick}
          >
            {/* Branch connector */}
            {depth > 0 && (
              <span
                className="absolute text-[11px] leading-none pointer-events-none select-none"
                style={{ left: `${(depth - 1) * 16 + 14}px`, color: "var(--editor-border, #3c3c3c)" }}
                aria-hidden
              >
                {isLast ? "└" : "├"}
              </span>
            )}

            {/* Chevron */}
            {isDir ? (
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-150 cursor-pointer",
                  isExpanded && "rotate-90",
                )}
                style={{ color: "var(--editor-fg, #808080)", opacity: 0.6 }}
                onClick={handleChevronClick}
              />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {/* Icon */}
            <FileIcon
              name={node.name}
              isDirectory={isDir}
              isOpen={isDir && isExpanded}
              size={15}
            />

            {/* Name */}
            <span
              className="truncate text-[12px] group-hover:opacity-100"
              style={{ color: "var(--editor-fg, #d4d4d4)", opacity: 0.85 }}
            >
              {node.name}
            </span>
          </div>
        </FileTreeContextMenu>
      )}

      {/* Children */}
      {isDir && hasChildren && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
        >
          <div role="group" className="relative overflow-hidden">
            <div
              className="absolute top-0 bottom-0 border-l hover:border-blue-500/30 transition-colors"
              style={{ left: `${depth * 16 + 14}px`, borderColor: "var(--editor-border, #3c3c3c)" }}
            />
            {sortedChildren.map((child, idx) => (
              <TreeItem
                key={child.fullPath}
                node={child}
                depth={depth + 1}
                currentDir={currentDir}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                onNavigate={onNavigate}
                onFileOpen={onFileOpen}
                showHiddenFiles={showHiddenFiles}
                isLast={idx === sortedChildren.length - 1}
                contextActions={contextActions}
                hasClipboard={hasClipboard}
                renamingPath={renamingPath}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                newItemState={newItemState}
                onNewItemSubmit={onNewItemSubmit}
                onNewItemCancel={onNewItemCancel}
              />
            ))}
            {/* Inline input for new file/folder inside this directory */}
            {newItemState && newItemState.parentDir === node.fullPath && (
              <InlineTreeInput
                isDirectory={newItemState.type === "folder"}
                depth={depth + 1}
                onSubmit={onNewItemSubmit}
                onCancel={onNewItemCancel}
                placeholder={
                  newItemState.type === "folder"
                    ? "Folder name…"
                    : "File name…"
                }
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Main Component ──────────────────────────────────────── */

export function EditorFileTree({
  currentDir,
  files,
  onFileOpen,
  onNavigate,
  onRefresh,
  collapsed = false,
  onCollapsedChange,
  showHiddenFiles = false,
  children,
  sftpStatus = "idle",
  sftpError,
  onConnect,
  hostLabel,
  fileOps,
}: EditorFileTreeProps) {
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [root, setRoot] = useState<FileTreeNode>(() => ({
    name: "/",
    fullPath: "/",
    type: "d",
    children: new Map(),
    isLoaded: false,
  }));

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["/"]));
  const rootRef = useRef(root);
  rootRef.current = root;
  const lastMergeRef = useRef<{ dir: string; filesRef: any }>({ dir: "", filesRef: null });

  /* ── Context-menu state ────────────────────────────────── */
  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [newItemState, setNewItemState] = useState<{
    parentDir: string;
    type: "file" | "folder";
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileTreeNode | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileTreeNode | null>(null);
  const [uploadState, setUploadState] = useState<{
    dir: string;
    mode: "file" | "folder";
  } | null>(null);

  /* ── Context-menu actions (passed to every TreeItem) ───── */
  const contextActions = useMemo<ContextMenuActions>(() => {
    if (!fileOps) return {};
    return {
      onOpen: (node) => {
        if (node.type !== "d") onFileOpen?.(node.fullPath, node.name);
      },
      onNewFile: (parentDir) => {
        setNewItemState({ parentDir, type: "file" });
        // Ensure the parent is expanded
        setExpandedPaths((prev) => new Set(prev).add(parentDir));
      },
      onNewFolder: (parentDir) => {
        setNewItemState({ parentDir, type: "folder" });
        setExpandedPaths((prev) => new Set(prev).add(parentDir));
      },
      onRename: (node) => {
        setRenamingPath(node.fullPath);
      },
      onDelete: (node) => {
        setDeleteTarget(node);
      },
      onCopyPath: (fullPath) => {
        navigator.clipboard.writeText(fullPath).catch(() => {});
      },
      onCut: (node) => {
        setClipboard({ node, mode: "cut" });
      },
      onCopy: (node) => {
        setClipboard({ node, mode: "copy" });
      },
      onPaste: (targetDir) => {
        if (!clipboard) return;
        const destPath = `${targetDir === "/" ? "" : targetDir}/${clipboard.node.name}`;
        if (clipboard.mode === "copy") {
          fileOps.copy(clipboard.node.fullPath, destPath);
        } else {
          fileOps.move(clipboard.node.fullPath, destPath);
        }
        setClipboard(null);
      },
      onMove: (node) => {
        setMoveTarget(node);
      },
      onUploadFile: (dir) => {
        setUploadState({ dir, mode: "file" });
      },
      onUploadFolder: (dir) => {
        setUploadState({ dir, mode: "folder" });
      },
    };
  }, [fileOps, clipboard, onFileOpen]);

  /* ── Rename handler ────────────────────────────────────── */
  const handleRenameSubmit = useCallback(
    (oldPath: string, newName: string) => {
      fileOps?.rename(oldPath, newName);
      setRenamingPath(null);
    },
    [fileOps],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
  }, []);

  /* ── New item handler ──────────────────────────────────── */
  const handleNewItemSubmit = useCallback(
    (name: string) => {
      if (!newItemState || !fileOps) return;
      if (newItemState.type === "file") {
        fileOps.createFile(newItemState.parentDir, name);
      } else {
        fileOps.createDir(newItemState.parentDir, name);
      }
      setNewItemState(null);
    },
    [newItemState, fileOps],
  );

  const handleNewItemCancel = useCallback(() => {
    setNewItemState(null);
  }, []);

  /* ── Delete handler ────────────────────────────────────── */
  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget || !fileOps) return;
    if (deleteTarget.type === "d") {
      fileOps.deleteDir(deleteTarget.fullPath);
    } else {
      fileOps.deleteFile(deleteTarget.fullPath);
    }
    setDeleteTarget(null);
  }, [deleteTarget, fileOps]);

  /* ── Move handler ──────────────────────────────────────── */
  const handleMoveConfirm = useCallback(
    (destPath: string) => {
      if (!moveTarget || !fileOps) return;
      fileOps.move(moveTarget.fullPath, destPath);
      setMoveTarget(null);
    },
    [moveTarget, fileOps],
  );

  /* ── Upload complete handler ───────────────────────────── */
  const handleUploadComplete = useCallback(
    (dir: string) => {
      fileOps?.refresh(dir);
    },
    [fileOps],
  );

  /* ── Merge incoming files into tree ── */
  useEffect(() => {
    if (!currentDir || !files || files.length === 0) return;
    if (lastMergeRef.current.filesRef === files) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.add("/");
        const segs = pathSegments(currentDir);
        let accum = "";
        for (const seg of segs) {
          accum += "/" + seg;
          next.add(accum);
        }
        return next;
      });
      return;
    }
    lastMergeRef.current = { dir: currentDir, filesRef: files };

    setRoot((prev) => {
      const newRoot = cloneTree(prev);
      const dirNode = ensurePath(newRoot, currentDir);
      const freshNames = new Set<string>();
      for (const f of files) {
        if (!f.name || f.name === "." || f.name === "..") continue;
        freshNames.add(f.name);
      }
      for (const existingName of Array.from(dirNode.children.keys())) {
        if (!freshNames.has(existingName)) dirNode.children.delete(existingName);
      }
      for (const f of files) {
        if (!f.name || f.name === "." || f.name === "..") continue;
        const childPath = `${currentDir === "/" ? "" : currentDir}/${f.name}`;
        if (!dirNode.children.has(f.name)) {
          dirNode.children.set(f.name, {
            name: f.name,
            fullPath: childPath,
            type: f.type || "-",
            children: new Map(),
            isLoaded: false,
          });
        } else {
          const existing = dirNode.children.get(f.name)!;
          existing.type = f.type || existing.type;
        }
      }
      dirNode.isLoaded = true;
      return newRoot;
    });

    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.add("/");
      const segs = pathSegments(currentDir);
      let accum = "";
      for (const seg of segs) {
        accum += "/" + seg;
        next.add(accum);
      }
      return next;
    });
  }, [currentDir, files]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    // When expanding a directory, notify parent so it can fetch contents
    onNavigate?.(path);
  }, [onNavigate]);

  const sortedRootChildren = useMemo(() => {
    const arr = Array.from(root.children.values()).filter((child) => {
      if (!showHiddenFiles && child.name.startsWith(".")) return false;
      return true;
    });
    return arr.sort((a, b) => {
      if (a.type === "d" && b.type !== "d") return -1;
      if (a.type !== "d" && b.type === "d") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [root, showHiddenFiles]);

  return (
    <div
      className="flex flex-col h-full transition-all duration-200 ease-in-out"
      style={{
        background: "var(--editor-bg, #1e1e1e)",
        borderRight: "1px solid var(--editor-border, #3c3c3c)",
      }}
    >
      {collapsed ? (
        <div className="flex flex-col items-center py-2 h-full">
          <button
            onClick={() => onCollapsedChange?.(false)}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "var(--editor-fg, #d4d4d4)" }}
            title="Show Explorer"
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--editor-hover-bg, #37373d)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <PanelLeftOpen className="h-4 w-4 opacity-60" />
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 shrink-0"
            style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}
          >
            <div className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5" style={{ color: "var(--editor-fg, #808080)", opacity: 0.6 }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--editor-fg, #808080)", opacity: 0.7 }}>
                Explorer
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-1 rounded-md transition-colors"
                  title="Refresh"
                  style={{ color: "var(--editor-fg, #808080)", opacity: 0.6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--editor-hover-bg, #37373d)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => onCollapsedChange?.(true)}
                className="p-1 rounded-md transition-colors"
                title="Collapse Explorer"
                style={{ color: "var(--editor-fg, #808080)", opacity: 0.6 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--editor-hover-bg, #37373d)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Tree */}
          <ScrollArea className="flex-1">
            <div role="tree" className="py-1 min-w-max">
              {sortedRootChildren.length > 0 ? (
                <>
                  {sortedRootChildren.map((child, idx) => (
                    <React.Fragment key={child.fullPath}>
                      <TreeItem
                        node={child}
                        depth={0}
                        currentDir={currentDir}
                        expandedPaths={expandedPaths}
                        onToggle={handleToggle}
                        onNavigate={onNavigate}
                        onFileOpen={onFileOpen}
                        showHiddenFiles={showHiddenFiles}
                        isLast={idx === sortedRootChildren.length - 1}
                        contextActions={contextActions}
                        hasClipboard={!!clipboard}
                        renamingPath={renamingPath}
                        onRenameSubmit={handleRenameSubmit}
                        onRenameCancel={handleRenameCancel}
                        newItemState={newItemState}
                        onNewItemSubmit={handleNewItemSubmit}
                        onNewItemCancel={handleNewItemCancel}
                      />
                    </React.Fragment>
                  ))}
                  {/* New item at root level when parentDir is "/" */}
                  {newItemState && newItemState.parentDir === "/" && (
                    <InlineTreeInput
                      isDirectory={newItemState.type === "folder"}
                      depth={0}
                      onSubmit={handleNewItemSubmit}
                      onCancel={handleNewItemCancel}
                      placeholder={
                        newItemState.type === "folder"
                          ? "Folder name…"
                          : "File name…"
                      }
                    />
                  )}
                </>
              ) : (
                <div className="px-3 py-6 text-center space-y-3">
                  {sftpStatus === "connected" ? (
                    /* Connected but no files yet — normal empty state */
                    <p className="text-[11px]" style={{ color: "var(--editor-fg, #808080)", opacity: 0.6 }}>
                      Navigate to a directory to populate the tree
                    </p>
                  ) : sftpStatus === "connecting" ? (
                    /* Connecting spinner */
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                      <p className="text-[11px]" style={{ color: "var(--editor-fg, #aaa)" }}>Connecting to SFTP…</p>
                    </div>
                  ) : sftpStatus === "error" ? (
                    /* Error state — allow retry */
                    <div className="flex flex-col items-center gap-2">
                      <WifiOff className="h-5 w-5 text-red-400" />
                      <p className="text-[11px] text-red-400">
                        {sftpError || "Connection failed"}
                      </p>
                      {onConnect && (
                        <button
                          onClick={() => setShowConnectDialog(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Idle — show connect button */
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 rounded-full bg-blue-500/10">
                        <PlugZap className="h-6 w-6 text-blue-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[12px] font-medium" style={{ color: "var(--editor-fg, #ccc)" }}>
                          SFTP Tree
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--editor-fg, #808080)", opacity: 0.6 }}>
                          Connect to browse remote files
                        </p>
                      </div>
                      {onConnect && (
                        <button
                          onClick={() => setShowConnectDialog(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                        >
                          <Wifi className="h-3 w-3" />
                          Connect to SFTP
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Custom children rendered below the tree */}
          {children}
        </>
      )}

      {/* ── Connect confirmation dialog ──────────────────────── */}
      <AlertDialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <AlertDialogContent className="sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-blue-400" />
              Connect to SFTP
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hostLabel ? (
                <>
                  You are about to open an SFTP session to{" "}
                  <span className="font-semibold text-foreground">{hostLabel}</span>.
                  This will let you browse and edit files on the remote server from
                  this editor.
                </>
              ) : (
                <>
                  Are you sure you want to connect here and work here?
                  This will open a new SFTP session for the file tree.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConnectDialog(false);
                onConnect?.();
              }}
            >
              Yes, Connect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete confirmation dialog ───────────────────────── */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        name={deleteTarget?.name ?? ""}
        isDirectory={deleteTarget?.type === "d"}
        onConfirm={handleDeleteConfirm}
      />

      {/* ── Move-to dialog ───────────────────────────────────── */}
      <MoveToDialog
        open={!!moveTarget}
        onOpenChange={(open) => { if (!open) setMoveTarget(null); }}
        sourcePath={moveTarget?.fullPath ?? ""}
        name={moveTarget?.name ?? ""}
        onConfirm={handleMoveConfirm}
      />

      {/* ── Upload dialog (file or folder) ───────────────────── */}
      <FileUploadDialog
        open={!!uploadState}
        onOpenChange={(open) => { if (!open) setUploadState(null); }}
        mode={uploadState?.mode ?? "file"}
        targetDir={uploadState?.dir ?? "/"}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
