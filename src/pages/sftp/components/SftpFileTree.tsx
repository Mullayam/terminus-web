import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SFTP_FILES_LIST } from "./interface";
import FileIcon from "@/components/FileIcon";
import {
  ChevronRight,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ─── Tree data model ─── */
export interface TreeNode {
  name: string;
  fullPath: string;
  type: string; // "d" = directory, "-" = file, etc.
  children: Map<string, TreeNode>;
  isLoaded: boolean; // true once we've fetched this dir's contents
}

interface SftpFileTreeProps {
  currentDir: string;
  files: Partial<SFTP_FILES_LIST>[];
  onNavigate: (path: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  showHiddenFiles?: boolean;
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

/* ─── Recursive tree item ─── */
function TreeItem({
  node,
  depth,
  currentDir,
  expandedPaths,
  onToggle,
  onNavigate,
  showHiddenFiles,
}: {
  node: TreeNode;
  depth: number;
  currentDir: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onNavigate: (path: string) => void;
  showHiddenFiles: boolean;
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
      // If already expanded, just collapse — don't reload
      if (isExpanded) {
        onToggle(node.fullPath);
      } else {
        // Expanding: toggle open + navigate to load contents
        onToggle(node.fullPath);
        onNavigate(node.fullPath);
      }
    }
  };

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={isDir ? isExpanded : undefined}
        className={cn(
          "flex items-center gap-1 py-[3px] pr-2 cursor-pointer text-sm select-none whitespace-nowrap",
          "hover:bg-muted/50 rounded-sm transition-colors duration-100",
          isActive && "bg-primary/15 text-primary font-medium",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Chevron */}
        {isDir ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-150",
              isExpanded && "rotate-90",
            )}
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

      {/* Children with indent guide line */}
      {isDir && isExpanded && hasChildren && (
        <div role="group" className="relative">
          {/* Vertical indent guide line */}
          <div
            className="absolute top-0 bottom-0 border-l border-border/40"
            style={{ left: `${depth * 16 + 16}px` }}
          />
          {sortedChildren.map((child) => (
            <TreeItem
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              currentDir={currentDir}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onNavigate={onNavigate}
              showHiddenFiles={showHiddenFiles}
            />
          ))}
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

      // Merge children: keep existing, add new
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

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2 h-full bg-background border-r border-border/40">
        <button
          onClick={() => onCollapsedChange?.(false)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          title="Show Explorer"
        >
          <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background border-r border-border/40">
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
      <ScrollArea className="flex-1">
        <div role="tree" className="py-1 min-w-max">
          {sortedRootChildren.length > 0 ? (
            sortedRootChildren.map((child) => (
              <TreeItem
                key={child.fullPath}
                node={child}
                depth={0}
                currentDir={currentDir}
                expandedPaths={expandedPaths}
                onToggle={handleToggle}
                onNavigate={onNavigate}
                showHiddenFiles={showHiddenFiles}
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
    </div>
  );
}
