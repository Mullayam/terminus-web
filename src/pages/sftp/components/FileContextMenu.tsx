/* eslint-disable @typescript-eslint/no-explicit-any */
import { Copy, File, Folder, Trash, Type } from "lucide-react"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"

export function FileContextMenu({ children, onCopy, onRename, onDelete, onNewFile, onNewFolder }: any) {
    return (
        <ContextMenu>
            <ContextMenuTrigger className="cursor-pointer min-w-full">{children}</ContextMenuTrigger>
            <ContextMenuContent className="w-48">
                <ContextMenuItem onSelect={onCopy} className=" cursor-pointer">
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Copy</span>
                </ContextMenuItem>
                <ContextMenuItem onSelect={onRename}  className=" cursor-pointer">
                    <Type className="mr-2 h-4 w-4" />
                    <span>Rename</span>
                </ContextMenuItem>
                <ContextMenuItem onSelect={onDelete}  className=" cursor-pointer">
                    <Trash className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={onNewFile}  className=" cursor-pointer">
                    <File className="mr-2 h-4 w-4" />
                    <span>New File</span>
                </ContextMenuItem>
                <ContextMenuItem onSelect={onNewFolder}  className=" cursor-pointer">
                    <Folder className="mr-2 h-4 w-4" />
                    <span>New Folder</span>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}

