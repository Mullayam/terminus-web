/* eslint-disable @typescript-eslint/no-explicit-any */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SFTP_FILES_LIST, RIGHT_CLICK_ACTIONS } from './interface';
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";


/* eslint-disable @typescript-eslint/no-explicit-any */
import { ColumnDef } from "@tanstack/react-table";

import { File, Folder } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPermissions } from "@/lib/utils";
import EnhancedFileUploadPopup from "@/components/FileUpload";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { socket } from "@/lib/sockets";
import { DeleteFolderDialog } from "./DeleteDialog";
import { NewFolderDialog } from "./NewDialog";
import { SocketEmitters } from "@/lib/sockets/emitter";
import { ContextModal } from "@/components/ui/context-modal";
import { FilePermissions } from "./edit-permission";
import { StatsInfoCard } from "./StatsInfoCards";
import { ApiCore } from "@/lib/api";
export type FileOperations = "file" | "folder" | "rename" | "move"

export interface RootObject {
  mode: number;
  uid: number;
  gid: number;
  size: number;
  accessTime: number;
  modifyTime: number;
  isDirectory: boolean;
  isFile: boolean;
  isBlockDevice: boolean;
  isCharacterDevice: boolean;
  isSymbolicLink: boolean;
  isFIFO: boolean;
  isSocket: boolean;
}
export function FileList({ files, currentDir }: {
  files: SFTP_FILES_LIST[],
  currentDir: string
}) {
  const { toast } = useToast()
  const [rowSelection, setRowSelection] = useState({})
  const [stats, setStats] = useState<null | RootObject>(null)


  const displayMesasge = (description: string) => {
    toast({
      title: "Success",
      description: description,
      duration: 2000,
    })
  }

  const handleDirectoryChange = (path: string) => {
    socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: `${currentDir}/${path}` })
  }
  const columns: ColumnDef<SFTP_FILES_LIST>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="p-2 flex space-x-2 cursor-pointer"
          onClick={row.original.type === "d" ? () => handleDirectoryChange((row.getValue("name"))) : () => {
            toast({
              title: "Not A Valid Directory",
              description: "Live Editing Feature Comming Soon",
              variant: "destructive",


            })
          }}
        >

          {row.original.type === "d" ? (
            <Folder size={18} strokeWidth={1.5} />
          ) : (
            <File size={18} strokeWidth={1.5} />
          )}
          <span>{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      accessorKey: "size",
      header: "Size",
      cell: ({ row }) => <div className="p-2 cursor-pointer">{row.getValue("size")} bytes</div>,
    },
    {
      accessorKey: "modifyTime",
      header: "Modified",
      cell: ({ row }) => (
        <div className="p-2 cursor-pointer">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{new Date(row.getValue("modifyTime")).toLocaleString()}</div>
              </TooltipTrigger>
              <TooltipContent>
                <div>{new Date(row.getValue("modifyTime")).toLocaleString()}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
    {
      accessorKey: "accessTime",
      header: "Accessed",
      cell: ({ row }) => (
        <div className="p-2 cursor-pointer">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{new Date(row.getValue("accessTime")).toLocaleString()}</div>
              </TooltipTrigger>
              <TooltipContent>
                <div>{new Date(row.getValue("accessTime")).toLocaleString()}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },

    {
      accessorKey: "rights",
      header: "Permissions",
      cell: ({ row }) => {

        return (
          <div className="p-2 cursor-pointer">
            {formatPermissions(row.getValue("rights"))}
          </div>
        );
      },
    },
  ];
  const shortcutMap: Record<string, RIGHT_CLICK_ACTIONS> = {
    "Ctrl+E": "edit",
    "Ctrl+C": "copy",
    "Ctrl+R": "rename",
    "Ctrl+M": "move",
    "Ctrl+D": "delete",
    "Ctrl+P": "properties",
    "Ctrl+N": "createFile",
    "Ctrl+U": "upload"
  };
  // Listen for keyboard events
  const handleKeydown = (event: KeyboardEvent) => {

    const keyCombo = `${event.ctrlKey ? "Ctrl+" : ""}${event.shiftKey ? "Shift+" : ""}${event.key.toUpperCase()}`;

    if (shortcutMap[keyCombo]) {
      event.preventDefault();
      if (rowSelection && Object.keys(rowSelection).length === 0) {
        toast({
          title: "Error",
          description: "Please select a File First",
          duration: 2000,
          variant: "destructive",
        })
      }
      // handleContextClickAction(shortcutMap[keyCombo], rowSelection);
    }
  };
  const handleDownload = async (data: { remotePath: string } & SFTP_FILES_LIST) => {

    try {
      const response = await ApiCore.download({
        remotePath: data.remotePath,
        type: data.type === "d" ? "dir" : "file",
        name: data.name
      })
      
      if (!response.ok) {
        throw new Error("Failed to download file");
      }
      // Convert the response into a Blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;  
      link.setAttribute('download', data.name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.log(error)
      toast({
        title: "Error",
        description: (error as Error).message,
        duration: 2000,
        variant: "destructive",
      })
    }
  }
  const handleContextClickAction = async (action: RIGHT_CLICK_ACTIONS, data: SFTP_FILES_LIST) => {
    const fullPath = `${currentDir}/${data.name}`
    switch (action) {
      case "rename":
        displayMesasge("rename file: " + data)
        break;
      case "move":
        displayMesasge("move file: " + data)
        break;
      case "delete":
        if (data.type === "d") {
          SocketEmitters.emit(SocketEventConstants.SFTP_DELETE_DIR, { path: fullPath })
        } else {
          SocketEmitters.emit(SocketEventConstants.SFTP_DELETE_FILE, { path: fullPath })
        }
        handleRefreshSftp()
        break;
      case "properties":
        SocketEmitters.emit(SocketEventConstants.SFTP_FILE_STATS, { path: fullPath })
        break;
      case "refresh":
        handleRefreshSftp()
        break;
      case "download":
        handleDownload({
          remotePath: fullPath,
          ...data
        })
        break;
      default:
        break;

    }
  }
  const table = useReactTable({
    data: files.sort((a, b) => (a.type === "d" && b.type !== "d" ? -1 : 1)),
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });
  const handleRefreshSftp = () => {
    SocketEmitters.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: currentDir })
  }
  const handleCreateFileOrDir = (path: string, type: FileOperations, newPath?: string) => {
    const fullPath = `${currentDir}/${path}`
    if (type === "file") {
      SocketEmitters.emit(SocketEventConstants.SFTP_CREATE_FILE, { filePath: fullPath })
    } else if (type === "folder") {
      SocketEmitters.emit(SocketEventConstants.SFTP_DELETE_DIR, { folderPath: fullPath })
    }
    else if (type === "move") {
      SocketEmitters.emit(SocketEventConstants.SFTP_MOVE_FILE, { folderPath: fullPath })
    }
    else if (type === "rename") {
      const payload = { oldPath: `${currentDir}/${path}`, newPath: `${currentDir}/${newPath}` }
      SocketEmitters.emit(SocketEventConstants.SFTP_RENAME_FILE, payload)
    }
    handleRefreshSftp()

  }
  document.addEventListener("keydown", handleKeydown);

  useEffect(() => {
    socket.on(SocketEventConstants.SFTP_FILE_STATS, (data: RootObject) => setStats(data))
    document.addEventListener("keydown", handleKeydown);
    return () => {
      socket.off(SocketEventConstants.SFTP_FILE_STATS)
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);
  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>

            {table.getCoreRowModel().rows?.length ? (
              table.getCoreRowModel().rows.map((row: any, index) => (
                <TableRow
                  key={index}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell: any) => (

                    <ContextModal
                      trigger={<TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>}
                      title={row.getValue('name')}
                      contextItems={[
                        {
                          label: 'Edit',
                          action: () => console.log('Editing user:'),
                          disabled: true
                        },
                        {
                          label: 'Refresh',
                          action: () => handleContextClickAction("refresh", row.original),

                        },
                        {
                          label: 'Rename',
                          action: () => handleContextClickAction("refresh", row.original),
                          content: <NewFolderDialog type="rename" data={row.original} onClick={handleCreateFileOrDir} />,
                        },
                        {
                          label: 'Move',
                          content: <NewFolderDialog type="move" data={row.original} onClick={handleCreateFileOrDir} />,
                        },
                        {
                          label: 'Delete',
                          content: <DeleteFolderDialog
                            folderName={row.getValue('name')} type={row.original.type} onDelete={() => handleContextClickAction("delete", row.original)} />,
                        },
                        {
                          label: 'New File',
                          content: <NewFolderDialog type="file" data={row.original} onClick={handleCreateFileOrDir} />,
                        },
                        {
                          label: 'New Folder',
                          content: <NewFolderDialog type="folder" data={row.original} onClick={handleCreateFileOrDir} />,
                        },
                        {
                          label: 'Upload',
                          content: <EnhancedFileUploadPopup />,
                        },
                        {
                          label: 'Download',
                          action: () => handleContextClickAction("download", row.original),
                        },
                        {
                          label: 'Properties',
                          action: () => handleContextClickAction("properties", row.original),
                          content: <StatsInfoCard data={stats} />,
                        },

                        {
                          label: 'Check Permissions',
                          content: <FilePermissions data={row.original} />,
                        },
                      ]}
                    >
                    </ContextModal>

                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 