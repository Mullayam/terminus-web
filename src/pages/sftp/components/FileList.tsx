/* eslint-disable @typescript-eslint/no-explicit-any */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SFTP_FILES_LIST, RIGHT_CLICK_ACTIONS } from './interface';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import FileIcon from "@/components/FileIcon";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, formatPermissions } from "@/lib/utils";
import EnhancedFileUploadPopup from "@/components/FileUpload";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import {
  Pencil,
  RefreshCw,
  Type,
  FolderInput,
  Trash2,
  FilePlus2,
  FolderPlus,
  Download,
  Info,
  ShieldCheck,
} from "lucide-react";
import { DeleteFolderDialog } from "./DeleteDialog";
import { NewFolderDialog } from "./NewDialog";
import { useSFTPContext } from "../sftp-context";
import { ContextModal } from "@/components/ui/context-modal";
import { FilePermissions } from "./edit-permission";
import { StatsInfoCard } from "./StatsInfoCards";
import { FileEditor } from "./FileEditor";
import { ApiCore } from "@/lib/api";
import { useDialogState, useLoadingState } from "@/store";
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
  const { socket, tabId } = useSFTPContext()
  const [rowSelection, setRowSelection] = useState({})
  const { setLoading } = useLoadingState()
  const [stats, setStats] = useState<null | RootObject>(null)
  const { openDialog, setOpenDialog } = useDialogState()

  // Refs keep latest values so memoized callbacks never go stale
  const socketRef = useRef(socket)
  const currentDirRef = useRef(currentDir)
  useEffect(() => { socketRef.current = socket }, [socket])
  useEffect(() => { currentDirRef.current = currentDir }, [currentDir])

  const displayMesasge = useCallback((description: string) => {
    toast({
      title: "Success",
      description: description,
      duration: 2000,
    })
  }, [toast])

  const handleDirectoryChange = useCallback((path: string) => {
    setLoading(true)
    const newDir = `${currentDirRef.current}/${path}`
    localStorage.setItem(`sftp_current_dir_${tabId}`, newDir)
    socketRef.current?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: newDir })
  }, [setLoading, tabId])
  // Memoize columns so react-table doesn't re-render all cells on every state change
  const columns: ColumnDef<SFTP_FILES_LIST>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 cursor-pointer select-none"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (row.original.type === "d") {
              handleDirectoryChange(row.getValue("name"));
            }
          }}
        >
          <FileIcon name={row.getValue("name")} isDirectory={row.original.type === "d"} size={16} />
          <span className="truncate">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      accessorKey: "size",
      header: "Size",
      cell: ({ row }) => <span className="text-muted-foreground">{formatBytes(row.getValue("size"))}</span>,
    },
    {
      accessorKey: "modifyTime",
      header: "Modified",
      cell: ({ row }) => (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground">{new Date(row.getValue("modifyTime")).toLocaleDateString()}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {new Date(row.getValue("modifyTime")).toLocaleString()}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      accessorKey: "accessTime",
      header: "Accessed",
      cell: ({ row }) => (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground">{new Date(row.getValue("accessTime")).toLocaleDateString()}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {new Date(row.getValue("accessTime")).toLocaleString()}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      accessorKey: "rights",
      header: "Permissions",
      cell: ({ row }) => (
        <code className="text-[11px] text-muted-foreground font-mono">
          {formatPermissions(row.getValue("rights"))}
        </code>
      ),
    },
  ], [handleDirectoryChange]);
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
          socket?.emit(SocketEventConstants.SFTP_DELETE_DIR, { path: fullPath })
        } else {
          socket?.emit(SocketEventConstants.SFTP_DELETE_FILE, { path: fullPath })
        }
        handleRefreshSftp()
        setOpenDialog(false)
        break;
      case "properties":
        socket?.emit(SocketEventConstants.SFTP_FILE_STATS, { path: fullPath })
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
  // Memoize sorted data — never mutate the files prop in-place
  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => (a.type === "d" && b.type !== "d" ? -1 : 1)),
    [files]
  );
  const table = useReactTable({
    data: sortedFiles,
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
  const handleRefreshSftp = useCallback(() => {
    socketRef.current?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: currentDirRef.current })
  }, [])
  const handleCreateFileOrDir = (path: string, type: FileOperations, newPath?: string) => {
    const fullPath = `${currentDir}/${path}`
    if (type === "file") {
      socket?.emit(SocketEventConstants.SFTP_CREATE_FILE, { filePath: fullPath })
    } else if (type === "folder") {
      socket?.emit(SocketEventConstants.SFTP_DELETE_DIR, { folderPath: fullPath })
    }
    else if (type === "move") {
      socket?.emit(SocketEventConstants.SFTP_MOVE_FILE, { folderPath: fullPath })
    }
    else if (type === "rename") {
      const payload = { oldPath: `${currentDir}/${path}`, newPath: `${currentDir}/${newPath}` }
      socket?.emit(SocketEventConstants.SFTP_RENAME_FILE, payload)
    }
    handleRefreshSftp()

  }

  useEffect(() => {
    const onStats = (data: RootObject) => setStats(data);
    socket?.on(SocketEventConstants.SFTP_FILE_STATS, onStats)
    document.addEventListener("keydown", handleKeydown);
    return () => {
      socket?.off(SocketEventConstants.SFTP_FILE_STATS, onStats)
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [socket]);
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

                    <ContextModal key={cell.id}

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
                          icon: <Pencil className="w-4 h-4" />,
                          disabled: row.original.type === 'd',
                          content: row.original.type !== 'd' ? (
                            <FileEditor
                              filePath={`${currentDir}/${row.getValue('name')}`}
                              fileName={row.getValue('name')}
                              socket={socket}
                            />
                          ) : undefined,
                        },
                        {
                          label: 'Refresh',
                          icon: <RefreshCw className="w-4 h-4" />,
                          action: () => handleContextClickAction("refresh", row.original),
                          separator: true,
                        },
                        {
                          label: 'Rename',
                          icon: <Type className="w-4 h-4" />,
                          content: <NewFolderDialog type="rename" data={row.original} onClick={handleCreateFileOrDir} />,
                        },
                        {
                          label: 'Move',
                          icon: <FolderInput className="w-4 h-4" />,
                          content: <NewFolderDialog type="move" data={row.original} onClick={handleCreateFileOrDir} />,
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 className="w-4 h-4 text-red-400" />,
                          content: <DeleteFolderDialog
                            folderName={row.getValue('name')} type={row.original.type} onDelete={() => handleContextClickAction("delete", row.original)} />,
                          separator: true,
                        },
                        {
                          label: 'New File',
                          icon: <FilePlus2 className="w-4 h-4" />,
                          content: <NewFolderDialog type="file" data={row.original} onClick={handleCreateFileOrDir} />,
                        },
                        {
                          label: 'New Folder',
                          icon: <FolderPlus className="w-4 h-4" />,
                          content: <NewFolderDialog type="folder" data={row.original} onClick={handleCreateFileOrDir} />,
                          separator: true,
                        },
                        {
                          label: 'Download',
                          icon: <Download className="w-4 h-4" />,
                          action: () => handleContextClickAction("download", row.original),
                          separator: true,
                        },
                        {
                          label: 'Properties',
                          icon: <Info className="w-4 h-4" />,
                          action: () => handleContextClickAction("properties", row.original),
                          content: <StatsInfoCard data={stats} />,
                        },
                        {
                          label: 'Check Permissions',
                          icon: <ShieldCheck className="w-4 h-4" />,
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