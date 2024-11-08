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

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
// import { FilePermissions } from "./edit-permission";
import { NewFolderDialog } from "./NewDialog";
import { CusotmDialog } from "@/components/CustomDialog";
import { SocketEmitters } from "@/lib/sockets/emitter";
export function FileList({ files, currentDir }: {
  files: SFTP_FILES_LIST[],
  currentDir: string
}) {
  const { toast } = useToast()
  const [rowSelection, setRowSelection] = useState({})

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

  const handleContextClickAction = (action: RIGHT_CLICK_ACTIONS, fileName: SFTP_FILES_LIST) => {
    switch (action) {
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
        SocketEmitters.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: currentDir })
        break;
      case "createFolder":
        displayMesasge("createFolder file: " + fileName)
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

  document.addEventListener("keydown", handleKeydown);

  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    return () => {
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
              table.getCoreRowModel().rows.map((row: any) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell: any) => (
                    <TableCell key={cell.id}>
                      <ContextMenu>
                        <ContextMenuTrigger>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-64">
                          <ContextMenuLabel inset>
                            {row.getValue('name')}
                          </ContextMenuLabel>
                          <ContextMenuSeparator />
                          <ContextMenuItem inset disabled onClick={() => handleContextClickAction("edit", row.original)}>
                            Edit
                            
                          </ContextMenuItem>
                         
                          <ContextMenuItem inset className="cursor-pointer" onClick={() => handleContextClickAction("refresh", row.original)}>
                            Refresh
                                                </ContextMenuItem>
                          
                          <ContextMenuItem inset className="cursor-pointer" onClick={() => handleContextClickAction("move", row.original)}>
                            Move
                            
                          </ContextMenuItem>

                          <ContextMenuItem inset className="cursor-pointer text-red-600">
                            <CusotmDialog trigger={"Delete"}>
                              <DeleteFolderDialog folderName={row.getValue('name')} onDelete={() => { }} />
                            </CusotmDialog>
                           
                          </ContextMenuItem>

                          <ContextMenuItem inset className="cursor-pointer" >
                            <CusotmDialog trigger={"Rename"}>
                              <NewFolderDialog />
                            </CusotmDialog>
                          </ContextMenuItem>
                          <ContextMenuItem inset className="cursor-pointer" onClick={() => handleContextClickAction("download", row.original)}>
                            Download
                          </ContextMenuItem>
                          <EnhancedFileUploadPopup>
                            <CustomTextMenu text={"Upload"} />
                          </EnhancedFileUploadPopup>
                              {
                                row.original.type === "d" &&
                                <ContextMenuItem inset className="cursor-pointer" onClick={() => handleContextClickAction("properties", row.original)}>
                                  Properties
                                </ContextMenuItem>
                              }
                          <ContextMenuItem inset className="cursor-pointer" onClick={() => handleContextClickAction("createFolder", row.original)}>
                            New Folder
                          </ContextMenuItem>
                          <ContextMenuItem inset className="cursor-pointer" onClick={() => handleContextClickAction("createFile", row.original)}>
                            New File
                            {/* <ContextMenuShortcut>⌘R</ContextMenuShortcut> */}
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </TableCell>
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
        {/* <NewFolderDialog /> */}

        {/* <FilePermissions/> */}



      </div>
    </div>

  )
}
const CustomTextMenu = ({ text }: { text: string }) => {
  return (
    <div role="menuitem"
      className="relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 pl-8 cursor-pointer"
      data-orientation="vertical"
      data-radix-collection-item="">
      {text}</div>
  )
}