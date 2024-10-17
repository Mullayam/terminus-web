/* eslint-disable @typescript-eslint/no-explicit-any */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Folder } from "lucide-react"
import { FileContextMenu } from "./FileContextMenu"
import { Files, FileType } from "./interface"

export function FileList({ files, isLocal }: {
    files: Files[],
    isLocal: boolean  // Indicates whether the files are local or remote (e.g., SFTP)

}) {
    const handleContextMenuAction = (action: string, file: FileType) => {
        isLocal ? console.log(`${action} action triggered for local file:`, file) :
            console.log(`${action} action triggered for file:`, file)
        // Implement actual functionality here
    }
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40%]">Name</TableHead>
                    <TableHead className="w-[25%]">Date Modified</TableHead>
                    <TableHead className="w-[15%]">Size</TableHead>
                    <TableHead className="w-[20%]">Kind</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {files.map((file: any) => (
                    // <FileContextMenu
                    //     key={file.name}
                    //     onCopy={() => handleContextMenuAction('copy', file)}
                    //     onRename={() => handleContextMenuAction('rename', file)}
                    //     onDelete={() => handleContextMenuAction('delete', file)}
                    //     onNewFile={() => handleContextMenuAction('newFile', file)}
                    //     onNewFolder={() => handleContextMenuAction('newFolder', file)}
                    // >
                        <TableRow key={file.name} className="hover:bg-primary/10">
                            <TableCell className="font-medium">
                                {file.kind === "folder" ? <Folder className="inline mr-2 h-4 w-4" /> : null}
                                {file.name}
                            </TableCell>
                            <TableCell>{file.dateModified}</TableCell>
                            <TableCell>{file.size}</TableCell>
                            <TableCell>{file.kind}</TableCell>
                        </TableRow>
                    // </FileContextMenu>
                ))}
            </TableBody>
        </Table>
    )
}