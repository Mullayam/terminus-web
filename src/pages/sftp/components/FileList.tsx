/* eslint-disable @typescript-eslint/no-explicit-any */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { File, Folder } from "lucide-react"
import { SFTP_FILES_LIST, RIGHT_CLICK_ACTIONS } from './interface';
import { formatPermissions } from "@/lib/utils";
import { useState } from "react";
import { ContextMenu } from "./FileContextMenu";
import { useToast } from "@/hooks/use-toast";

export function FileList({ files, currentDir }: {
    files: SFTP_FILES_LIST[],
    currentDir: string
}) {
    const { toast } = useToast()
    const [contextMenu, setContextMenu] = useState<any>({
        visible: false,
        x: 0,
        y: 0,
        options: [],
    });
    const displayMesasge = (description: string) => {
        toast({
            title: "Success",
            description: description,
            duration: 2000,
        })
    }
    const handleContextClick = (event: any, file: SFTP_FILES_LIST) => {
        event.preventDefault();

        const options = [
            { label: "Edit", onClick: () => handleContextClickAction("edit", file.name) },
            { label: "Copy", onClick: () => handleContextClickAction("copy", file.name) },
            { label: "Rename", onClick: () => handleContextClickAction("rename", file.name) },
            { label: "Move", onClick: () => handleContextClickAction("move", file.name) },
            { label: "Delete", onClick: () => handleContextClickAction("delete", file.name) },
            { label: "Properties", onClick: () => handleContextClickAction("properties", file.name) },
            { label: "Refresh", onClick: () => handleContextClickAction("refresh", file.name) },
            { label: "New Folder", onClick: () => handleContextClickAction("createFile", file.name) },
            { label: "New File", onClick: () => handleContextClickAction("createFile", file.name) },
            { label: "Upload", onClick: () => handleContextClickAction("upload", file.name) },
        ];

        setContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            options,
        });

    };
    const handleCloseContextMenu = () => {
        setContextMenu({ ...contextMenu, visible: false });
    };
    const handleDoubleClick = (file: SFTP_FILES_LIST) => {
        if (file.type === "d") {
            handleDirectoryChange(file.name);
        }
    };
    const handleDirectoryChange = (path: string) => {
        console.log(currentDir + path)
        // socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path })
    }
    const handleContextClickAction = (action: RIGHT_CLICK_ACTIONS, fileName: string) => {
        switch (action) {
            case "edit":
                displayMesasge("edit file: " + fileName)

                break;
            case "copy":
                displayMesasge("copy file: " + fileName)

                break;
            case "rename":
                displayMesasge("rename file: " + fileName)

                break;
            case "move":
                displayMesasge("move file: " + fileName)
                break;
            case "delete":
                displayMesasge("delete file: " + fileName)
                break;
            case "properties":
                displayMesasge("properties file: " + fileName)
                break;
            case "refresh":
                displayMesasge("refresh file: " + fileName)
                break;
            case "createFile":
                displayMesasge("createFile file: " + fileName)
                break;
            case "upload":
                displayMesasge("upload file: " + fileName)
                break;
            default:
                break;

        }
    }
    return (
        <div onClick={handleCloseContextMenu} style={{ position: "relative" }}>
            <Table
                className="w-full select-none table-fixed "

            >
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[40%]">Name</TableHead>
                        <TableHead className="w-[15%]">Size</TableHead>
                        <TableHead className="w-[20%]">Kind</TableHead>
                        <TableHead className="w-[20%]">Permissions</TableHead>
                        <TableHead className="w-[25%]">Date Modified</TableHead>
                        <TableHead className="w-[25%]">Date Created</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {files.map((file: any) => (

                        <TableRow key={file.name}
                            onContextMenu={(e) => handleContextClick(e, file)}
                            className="hover:bg-primary/10 cursor-pointer">
                            <TableCell className="font-medium" onDoubleClick={() => handleDoubleClick(file)}>
                                {file.type === "d" ? <Folder className="inline mr-2 h-4 w-4" /> :
                                    <File className="inline mr-2 h-4 w-4" />}
                                {file.name}
                            </TableCell>
                            <TableCell>{file.size} bytes</TableCell>
                            <TableCell>{file.type === "d" ? "Folder" : "File"}</TableCell>
                            <TableCell>{formatPermissions(file.rights)}</TableCell>
                            <TableCell>{new Date(file.modifyTime).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(file.accessTime).toLocaleDateString()}</TableCell>

                        </TableRow>

                    ))}
                </TableBody>
            </Table>
            {contextMenu.visible && <ContextMenu options={contextMenu.options} position={{ x: contextMenu.x, y: contextMenu.y }} onClose={handleCloseContextMenu} />}

        </div>
    )
}