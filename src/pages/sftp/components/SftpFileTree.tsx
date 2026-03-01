import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SFTP_FILES_LIST } from "./interface";
import FileIcon from "@/components/FileIcon";
import {
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FilePlus2,
  FolderInput,
  FolderPlus,
  FolderTree,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Type,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ContextModal } from "@/components/ui/context-modal";

/* ─── Tree data model ─── */
export interface TreeNode {
  name: string;
  fullPath: string;
  type: string; // "d" = directory, "-" = file, etc.
  children: Map<string, TreeNode>;
  isLoaded: boolean; // true once we've fetched this dir's contents
}

export interface TreeContextActions {
  onEdit?: (fullPath: string, name: string, isDir: boolean) => void;
  onEditWithEditor?: (fullPath: string, name: string) => void;
  onPreview?: (fullPath: string, name: string) => void;
  onRename?: (node: TreeNode) => void;
  onMove?: (node: TreeNode) => void;
  onDelete?: (node: TreeNode) => void;
  onRefresh?: () => void;
  onDownload?: (node: TreeNode) => void;
  onProperties?: (fullPath: string) => void;
  onPermissions?: (node: TreeNode) => void;
  onNewFile?: (node: TreeNode) => void;
  onNewFolder?: (node: TreeNode) => void;
  onCopy?: (node: TreeNode) => void;
  /** Render custom content for context items that need dialogs */
  renderEdit?: (fullPath: string, name: string) => React.ReactNode;
  renderRename?: (node: TreeNode) => React.ReactNode;
  renderMove?: (node: TreeNode) => React.ReactNode;
  renderDelete?: (node: TreeNode) => React.ReactNode;
  renderNewFile?: (node: TreeNode) => React.ReactNode;
  renderNewFolder?: (node: TreeNode) => React.ReactNode;
  renderCopy?: (node: TreeNode) => React.ReactNode;
  renderProperties?: () => React.ReactNode;
  renderPermissions?: (node: TreeNode) => React.ReactNode;
  isPreviewable?: (name: string) => boolean;
}

interface SftpFileTreeProps {
  currentDir: string;
  files: Partial<SFTP_FILES_LIST>[];
  onNavigate: (path: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  showHiddenFiles?: boolean;
  contextActions?: TreeContextActions;
}

/* ─── Helpers ─── */

/** Split an absolute path into segments, e.g. "/home/user" → ["home","user"] */
function pathSegments(p: string): string[] {
  return p.split("/").filter(Boolean);
}

/** Deep-clone a tree so React detects changes */
function cloneTree(node: TreeNode): TreeNode {
  const clone: TreeNode = { ...node, children: new Map() };
  for (const [k, v] of node.children) {
    clone.children.set(k, cloneTree(v));
  }
  return clone;
}

/** Ensure a node exists at the given absolute path, creating intermediaries */
function ensurePath(root: TreeNode, absPath: string): TreeNode {
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

/* ─── Build context menu items for a node ─── */
function buildContextItems(node: TreeNode, actions?: TreeContextActions) {
  if (!actions) return [];

  const isDir = node.type === "d";
  const items: any[] = [];

  // Edit
  items.push({
    label: "Edit",
    icon: <Pencil className="w-4 h-4" />,
    disabled: isDir,
    content: !isDir
      ? actions.renderEdit?.(node.fullPath, node.name)
      : undefined,
  });

  // Edit with Editor
  items.push({
    label: "Edit with Editor",
    icon: <ExternalLink className="w-4 h-4" />,
    disabled: isDir,
    action: () => actions.onEditWithEditor?.(node.fullPath, node.name),
  });

  // Preview
  items.push({
    label: "Preview",
    icon: <Eye className="w-4 h-4" />,
    disabled: isDir || !actions.isPreviewable?.(node.name),
    action: () => actions.onPreview?.(node.fullPath, node.name),
  });

  // Refresh
  items.push({
    label: "Refresh",
    icon: <RefreshCw className="w-4 h-4" />,
    action: () => actions.onRefresh?.(),
    separator: true,
  });

  // Rename
  items.push({
    label: "Rename",
    icon: <Type className="w-4 h-4" />,
    content: actions.renderRename?.(node),
  });

  // Move
  items.push({
    label: "Move",
    icon: <FolderInput className="w-4 h-4" />,
    content: actions.renderMove?.(node),
  });

  // Copy
  items.push({
    label: "Copy",
    icon: <Copy className="w-4 h-4" />,
    content: actions.renderCopy?.(node),
  });

  // Delete
  items.push({
    label: "Delete",
    icon: <Trash2 className="w-4 h-4 text-red-400" />,
    content: actions.renderDelete?.(node),
    separator: true,
  });

  // New File
  items.push({
    label: "New File",
    icon: <FilePlus2 className="w-4 h-4" />,
    content: actions.renderNewFile?.(node),
  });

  // New Folder
  items.push({
    label: "New Folder",
    icon: <FolderPlus className="w-4 h-4" />,
    content: actions.renderNewFolder?.(node),
    separator: true,
  });

  // Download
  items.push({
    label: "Download",
    icon: <Download className="w-4 h-4" />,
    action: () => actions.onDownload?.(node),
    separator: true,
  });

  // Properties
  items.push({
    label: "Properties",
    icon: <Info className="w-4 h-4" />,
    action: () => actions.onProperties?.(node.fullPath),
    content: actions.renderProperties?.(),
  });

  // Permissions
  items.push({
    label: "Check Permissions",
    icon: <ShieldCheck className="w-4 h-4" />,
    content: actions.renderPermissions?.(node),
  });

  return items;
}

/* ─── Recursive tree item ─── */
function TreeItem({
  node,
  depth,
  currentDir,
  expandedPaths,
  onToggle,
  onNavigate,
  showHiddenFiles,
  isLast,
  contextActions,
}: {
  node: TreeNode;
  depth: number;
  currentDir: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onNavigate: (path: string) => void;
  showHiddenFiles: boolean;
  isLast: boolean;
  contextActions?: TreeContextActions;
}) {
  const isDir = node.type === "d";
  const isActive = node.fullPath === currentDir;
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = node.children.size > 0;

  // Sort & filter children: directories first, then alphabetical; respect hidden files
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
      onNavigate(node.fullPath);
    }
  };

  /** Chevron click: only toggle expand/collapse, don't navigate */
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.fullPath);
  };

  const contextItems = useMemo(
    () => buildContextItems(node, contextActions),
    [node, contextActions],
  );

  const treeItemContent = (
    <div
      role="treeitem"
      aria-expanded={isDir ? isExpanded : undefined}
      className={cn(
        "group flex items-center gap-1 py-[3px] pr-2 cursor-pointer text-sm select-none whitespace-nowrap",
        "hover:bg-muted/50 rounded-sm transition-colors duration-100",
        isActive && "bg-primary/15 text-primary font-medium",
      )}
      style={{ paddingLeft: `${depth * 18 + 8}px` }}
      onClick={handleClick}
    >
      {/* Branch connector: ├── or └── */}
      {depth > 0 && (
        <span
          className="absolute text-border/70 text-[11px] leading-none pointer-events-none select-none"
          style={{ left: `${(depth - 1) * 18 + 14}px` }}
          aria-hidden
        >
          {isLast ? "└" : "├"}
        </span>
      )}

      {/* Chevron */}
      {isDir ? (
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-150 cursor-pointer",
            isExpanded && "rotate-90",
          )}
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
      <span className="truncate text-[13px]">{node.name}</span>
    </div>
  );

  return (
    <>
      {contextActions ? (
        <ContextModal
          trigger={treeItemContent}
          title={node.name}
          contextItems={contextItems}
        />
      ) : (
        treeItemContent
      )}

      {/* Children with indent guide lines — animated slide */}
      {isDir && hasChildren && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{
            gridTemplateRows: isExpanded ? "1fr" : "0fr",
          }}
        >
          <div role="group" className="relative overflow-hidden">
            {/* Vertical indent guide line — like Facebook comments */}
            <div
              className="absolute top-0 bottom-0 border-l-2 border-border/30 hover:border-primary/30 transition-colors"
              style={{ left: `${depth * 18 + 14}px` }}
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
                showHiddenFiles={showHiddenFiles}
                isLast={idx === sortedChildren.length - 1}
                contextActions={contextActions}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Main component ─── */
export function SftpFileTree({
  currentDir,
  files,
  onNavigate,
  collapsed = false,
  onCollapsedChange,
  showHiddenFiles = false,
  contextActions,
}: SftpFileTreeProps) {
  // Root of the accumulated tree
  const [root, setRoot] = useState<TreeNode>(() => ({
    name: "/",
    fullPath: "/",
    type: "d",
    children: new Map(),
    isLoaded: false,
  }));

  // Tracks which dirs are visually expanded
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(["/"]),
  );

  // Ref to avoid stale closure in merge
  const rootRef = useRef(root);
  rootRef.current = root;

  // Track what we last merged to avoid stale merges
  const lastMergeRef = useRef<{ dir: string; filesRef: any }>({
    dir: "",
    filesRef: null,
  });

  // ── Merge new file listing into tree ──
  useEffect(() => {
    if (!currentDir || !files || files.length === 0) return;

    // Guard: if currentDir changed but files is still the OLD reference,
    // skip — we'd be merging parent's files into the child directory.
    if (lastMergeRef.current.filesRef === files) {
      // files ref unchanged — only auto-expand, don't re-merge
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

    // Fresh files arrived — safe to merge
    lastMergeRef.current = { dir: currentDir, filesRef: files };

    setRoot((prev) => {
      const newRoot = cloneTree(prev);
      const dirNode = ensurePath(newRoot, currentDir);

      // Build a set of the fresh file names so we can detect removals
      const freshNames = new Set<string>();
      for (const f of files) {
        if (!f.name || f.name === "." || f.name === "..") continue;
        freshNames.add(f.name);
      }

      // Remove children that no longer exist in the updated listing
      for (const existingName of Array.from(dirNode.children.keys())) {
        if (!freshNames.has(existingName)) {
          dirNode.children.delete(existingName);
        }
      }

      // Add new / update existing children
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
          // Update type in case it changed
          const existing = dirNode.children.get(f.name)!;
          existing.type = f.type || existing.type;
        }
      }
      dirNode.isLoaded = true;
      return newRoot;
    });

    // Auto-expand the current directory and its ancestors
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
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Sort & filter root-level children
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
    <div className="flex flex-col h-full bg-background border-r border-border/40 transition-all duration-200 ease-in-out">
      {collapsed ? (
        /* Collapsed state — thin strip */
        <div className="flex flex-col items-center py-2 h-full animate-in fade-in duration-150">
          <button
            onClick={() => onCollapsedChange?.(false)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Show Explorer"
          >
            <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ) : (
        /* Expanded state */
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
            <div className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Explorer
              </span>
            </div>
            <button
              onClick={() => onCollapsedChange?.(true)}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              title="Collapse Explorer"
            >
              <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Tree — ScrollArea with both vertical + horizontal scrollbars */}
          <ScrollArea className="flex-1 animate-in fade-in slide-in-from-left-2 duration-200">
            <div role="tree" className="py-1 min-w-max">
              {sortedRootChildren.length > 0 ? (
                sortedRootChildren.map((child, idx) => (
                  <TreeItem
                    key={child.fullPath}
                    node={child}
                    depth={0}
                    currentDir={currentDir}
                    expandedPaths={expandedPaths}
                    onToggle={handleToggle}
                    onNavigate={onNavigate}
                    showHiddenFiles={showHiddenFiles}
                    isLast={idx === sortedRootChildren.length - 1}
                    contextActions={contextActions}
                  />
                ))
              ) : (
                <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                  Navigate to a directory to populate the tree
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </>
      )}
    </div>
  );
}
