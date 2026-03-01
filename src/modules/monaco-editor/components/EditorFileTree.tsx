/**
 * @module components/EditorFileTree
 *
 * Lightweight file-system tree for the Monaco editor page.
 * Renders a recursive, collapsible tree populated from a flat
 * file-list (typically coming from SFTP socket events).
 *
 * Props allow the host to:
 *   - Provide initial files and current directory
 *   - Handle file open
 *   - Render custom children under any node
 *   - Collapse / expand the whole panel
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
} from "lucide-react";
import FileIcon from "@/components/FileIcon";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ── Tree data model ─────────────────────────────────────── */

export interface FileTreeNode {
  name: string;
  fullPath: string;
  /** "d" = directory, "-" = file, etc. */
  type: string;
  children: Map<string, FileTreeNode>;
  isLoaded: boolean;
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
      <div
        role="treeitem"
        aria-expanded={isDir ? isExpanded : undefined}
        className={cn(
          "group flex items-center gap-1 py-[3px] pr-2 cursor-pointer text-sm select-none whitespace-nowrap",
          "hover:bg-[#2a2d2e] rounded-sm transition-colors duration-100",
          isActive && "bg-[#37373d] text-white font-medium",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Branch connector */}
        {depth > 0 && (
          <span
            className="absolute text-[#3c3c3c] text-[11px] leading-none pointer-events-none select-none"
            style={{ left: `${(depth - 1) * 16 + 14}px` }}
            aria-hidden
          >
            {isLast ? "└" : "├"}
          </span>
        )}

        {/* Chevron */}
        {isDir ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform duration-150 cursor-pointer",
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
        <span className="truncate text-[12px] text-gray-300 group-hover:text-white">
          {node.name}
        </span>
      </div>

      {/* Children */}
      {isDir && hasChildren && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
        >
          <div role="group" className="relative overflow-hidden">
            <div
              className="absolute top-0 bottom-0 border-l border-[#3c3c3c] hover:border-blue-500/30 transition-colors"
              style={{ left: `${depth * 16 + 14}px` }}
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
              />
            ))}
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
}: EditorFileTreeProps) {
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
    <div className="flex flex-col h-full bg-[#1e1e1e] border-r border-[#3c3c3c] transition-all duration-200 ease-in-out">
      {collapsed ? (
        <div className="flex flex-col items-center py-2 h-full">
          <button
            onClick={() => onCollapsedChange?.(false)}
            className="p-1.5 rounded-md hover:bg-[#37373d] transition-colors"
            title="Show Explorer"
          >
            <PanelLeftOpen className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c] shrink-0">
            <div className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Explorer
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-1 rounded-md hover:bg-[#37373d] transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="h-3 w-3 text-gray-500" />
                </button>
              )}
              <button
                onClick={() => onCollapsedChange?.(true)}
                className="p-1 rounded-md hover:bg-[#37373d] transition-colors"
                title="Collapse Explorer"
              >
                <PanelLeftClose className="h-3.5 w-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Tree */}
          <ScrollArea className="flex-1">
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
                    onFileOpen={onFileOpen}
                    showHiddenFiles={showHiddenFiles}
                    isLast={idx === sortedRootChildren.length - 1}
                  />
                ))
              ) : (
                <div className="px-3 py-6 text-[11px] text-gray-500 text-center">
                  Navigate to a directory to populate the tree
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Custom children rendered below the tree */}
          {children}
        </>
      )}
    </div>
  );
}
