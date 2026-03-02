/**
 * @module FileTreeContextMenu
 *
 * VS Code-style right-click context menu for the editor file tree.
 * Uses Radix ContextMenu primitives and matches the editor theme
 * via CSS custom properties.
 *
 * Menu items adapt based on whether the target is a file or directory:
 *   Directories  → New File, New Folder, Upload File, Upload Folder, …
 *   Files        → Open, Copy Path, Rename, Delete, …
 *   Both         → Copy, Cut, Paste, Rename, Delete, Copy Path
 *
 * This component is purely presentational — all actions are fired
 * through the `actions` prop callback map.
 */
import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  FileIcon,
  FilePlus2,
  FolderInput,
  FolderPlus,
  Move,
  PenLine,
  Scissors,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import type { FileTreeNode } from "../EditorFileTree";

/* ── Types ──────────────────────────────────────────────── */

export interface ContextMenuActions {
  onNewFile?: (parentDir: string) => void;
  onNewFolder?: (parentDir: string) => void;
  onRename?: (node: FileTreeNode) => void;
  onDelete?: (node: FileTreeNode) => void;
  onCopyPath?: (fullPath: string) => void;
  onCut?: (node: FileTreeNode) => void;
  onCopy?: (node: FileTreeNode) => void;
  onPaste?: (targetDir: string) => void;
  onMove?: (node: FileTreeNode) => void;
  onUploadFile?: (targetDir: string) => void;
  onUploadFolder?: (targetDir: string) => void;
  onOpen?: (node: FileTreeNode) => void;
}

export interface FileTreeContextMenuProps {
  /** The tree node that was right-clicked */
  node: FileTreeNode;
  /** All action callbacks */
  actions: ContextMenuActions;
  /** Whether the clipboard has a node to paste */
  hasClipboard?: boolean;
  /** Wrap children with context menu trigger */
  children: React.ReactNode;
}

/* ── Helpers ──────────────────────────────────────────────── */

/** Get parent directory from a full path */
function parentDir(fullPath: string): string {
  return fullPath.substring(0, fullPath.lastIndexOf("/")) || "/";
}

/** Context dir: self for dirs, parent for files */
function contextDir(node: FileTreeNode): string {
  return node.type === "d" ? node.fullPath : parentDir(node.fullPath);
}

/* ── Shared styles ───────────────────────────────────────── */

const menuContentStyle: React.CSSProperties = {
  background: "var(--editor-sidebar-bg, #252526)",
  border: "1px solid var(--editor-border, #3c3c3c)",
  color: "var(--editor-fg, #cccccc)",
  minWidth: 200,
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

const shortcutClass = "ml-auto text-[11px] opacity-50";

/* ── Component ───────────────────────────────────────────── */

export const FileTreeContextMenu = React.memo(function FileTreeContextMenu({
  node,
  actions,
  hasClipboard = false,
  children,
}: FileTreeContextMenuProps) {
  const isDir = node.type === "d";
  const dir = contextDir(node);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent
        className="rounded-md p-1 backdrop-blur-sm"
        style={menuContentStyle}
      >
        {/* ── Open (files only) ──────────────────────────── */}
        {!isDir && actions.onOpen && (
          <>
            <ContextMenuItem
              className={menuItemClass}
              onClick={() => actions.onOpen?.(node)}
            >
              <FileIcon className="h-3.5 w-3.5 opacity-70" />
              Open
            </ContextMenuItem>
            <ContextMenuSeparator style={separatorStyle} />
          </>
        )}

        {/* ── New File / New Folder ──────────────────────── */}
        {isDir && (
          <>
            <ContextMenuItem
              className={menuItemClass}
              onClick={() => actions.onNewFile?.(dir)}
            >
              <FilePlus2 className="h-3.5 w-3.5 opacity-70" />
              New File
            </ContextMenuItem>
            <ContextMenuItem
              className={menuItemClass}
              onClick={() => actions.onNewFolder?.(dir)}
            >
              <FolderPlus className="h-3.5 w-3.5 opacity-70" />
              New Folder
            </ContextMenuItem>
            <ContextMenuSeparator style={separatorStyle} />
          </>
        )}

        {/* ── Cut / Copy / Paste ─────────────────────────── */}
        <ContextMenuItem
          className={menuItemClass}
          onClick={() => actions.onCut?.(node)}
        >
          <Scissors className="h-3.5 w-3.5 opacity-70" />
          Cut
          <ContextMenuShortcut className={shortcutClass}>Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          className={menuItemClass}
          onClick={() => actions.onCopy?.(node)}
        >
          <Copy className="h-3.5 w-3.5 opacity-70" />
          Copy
          <ContextMenuShortcut className={shortcutClass}>Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>

        {isDir && (
          <ContextMenuItem
            className={menuItemClass}
            disabled={!hasClipboard}
            onClick={() => actions.onPaste?.(dir)}
          >
            <ClipboardPaste className="h-3.5 w-3.5 opacity-70" />
            Paste
            <ContextMenuShortcut className={shortcutClass}>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator style={separatorStyle} />

        {/* ── Copy Path ──────────────────────────────────── */}
        <ContextMenuItem
          className={menuItemClass}
          onClick={() => actions.onCopyPath?.(node.fullPath)}
        >
          <ClipboardCopy className="h-3.5 w-3.5 opacity-70" />
          Copy Path
          <ContextMenuShortcut className={shortcutClass}>Shift+Alt+C</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator style={separatorStyle} />

        {/* ── Rename ─────────────────────────────────────── */}
        <ContextMenuItem
          className={menuItemClass}
          onClick={() => actions.onRename?.(node)}
        >
          <PenLine className="h-3.5 w-3.5 opacity-70" />
          Rename
          <ContextMenuShortcut className={shortcutClass}>F2</ContextMenuShortcut>
        </ContextMenuItem>

        {/* ── Move ───────────────────────────────────────── */}
        <ContextMenuItem
          className={menuItemClass}
          onClick={() => actions.onMove?.(node)}
        >
          <Move className="h-3.5 w-3.5 opacity-70" />
          Move to…
        </ContextMenuItem>

        {/* ── Delete ─────────────────────────────────────── */}
        <ContextMenuItem
          className={menuItemClass}
          onClick={() => actions.onDelete?.(node)}
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400 opacity-80" />
          <span className="text-red-400">Delete</span>
          <ContextMenuShortcut className={shortcutClass}>Del</ContextMenuShortcut>
        </ContextMenuItem>

        {/* ── Upload ─────────────────────────────────────── */}
        {isDir && (
          <>
            <ContextMenuSeparator style={separatorStyle} />
            <ContextMenuItem
              className={menuItemClass}
              onClick={() => actions.onUploadFile?.(dir)}
            >
              <Upload className="h-3.5 w-3.5 opacity-70" />
              Upload File
            </ContextMenuItem>
            <ContextMenuItem
              className={menuItemClass}
              onClick={() => actions.onUploadFolder?.(dir)}
            >
              <UploadCloud className="h-3.5 w-3.5 opacity-70" />
              Upload Folder
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});
