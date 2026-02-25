/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Filter,
  HomeIcon,
  MoreVertical,
  RefreshCwIcon,
  Upload,
} from "lucide-react";
import { FileList } from "./FileList";
import { useState, useEffect } from "react";
import { SFTP_FILES_LIST } from "./interface";

import { ApiCore } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { FilterDropdown } from "./FilterDropdown";
import EnhancedFileUploadPopup from "@/components/FileUpload";

import { useSFTPContext } from "../sftp-context";
import PathBreadcrumb from "./PathBreadcrumb";
import { ShowProgressBar } from "./DownloadProgress";
import { DownloadProgressType } from "./SFTPTabClient";
import { useSFTPStore } from "@/store/sftpStore";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { SftpFileTree } from "./SftpFileTree";

export function FilePane({
  title,
  files,
  path,
  handleSetCurrentDir,
  handleSetLoading,
  loading,
  hasError,
}: any) {
  const splitedPath = path.split("/") as string[];
  const { socket } = useSFTPContext();
  const sftpStore = useSFTPStore((state) => state);
  const [filteredFiles, setFilteredFiles] = useState(files);
  const [dragOver, setDragOver] = useState(false);
  const [open, setOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<File & { path?: string }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showHiddenFiles, setShowHiddenFiles] = useState<boolean>(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] =
    useState<DownloadProgressType | null>(null);
  const [treeCollapsed, setTreeCollapsed] = useState(false);

  const handleHiddenFilesFilter = () => {
    setShowHiddenFiles(!showHiddenFiles);
    if (!showHiddenFiles) {
      setFilteredFiles(files);
      return;
    }
    setFilteredFiles(
      files.filter((file: SFTP_FILES_LIST) => !file.name.startsWith(".")),
    );
  };
  const handleDragOver = (e: any) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];

    if (file) {
      setUploadFileName(file.name);
      startUpload(file);
    }
  };

  const startUpload = async (file: any) => {
    try {
      const data = await ApiCore.uploadFile(file, path);
      if (!data.status) {
        throw new Error(data.message);
      }
      setOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleFilterChange = (fileName: string) => {
    if (!fileName) {
      setFilteredFiles(files);
    } else {
      setFilteredFiles(
        files.filter((file: SFTP_FILES_LIST) => file.name.includes(fileName)),
      );
    }
  };
  const handleRetrySFTPConnect = () => {
    handleSetLoading(true);
    const session = sftpStore.sessions[sftpStore?.activeTabId as any];
    if (session) {
      const d = JSON.stringify({
        host: session.host,
        username: session.username,
        password: session.password || "",
        authMethod: session.authMethod || "password",
      });

      return socket?.emit(SocketEventConstants.SFTP_CONNECT, d);
    }
    return toast({
      title: "No session data",
      description:
        "Session data is missing, please refresh the page and try again",
    });
  };
  useEffect(() => {
    if (!socket) return;
    const onUploadProgress = (data: DownloadProgressType) => {
      setFileUploadProgress(data);
    };
    const onFileUploaded = () => {
      setUploadFileName(null);
      setFileUploadProgress(null);
    };
    socket.on(SocketEventConstants.SFTP_READY, (cwd: string) => {
      console.log("Ready");
      if (sftpStore.activeTabId) {
        sftpStore.updateSession(sftpStore.activeTabId!, {
          isConnected: true,
          isConnecting: false,
          error: undefined,
        });
      }
    });
    socket.on(SocketEventConstants.FILE_UPLOADED_PROGRESS, onUploadProgress);
    socket.on(SocketEventConstants.FILE_UPLOADED, onFileUploaded);
    socket.on(SocketEventConstants.SFTP_ENDED, (mesage: string) => {
      toast({
        title: "SFTP Session Ended",
        description: mesage,
      });
      setSessionClosed(true);
      if (sftpStore.activeTabId) {
        sftpStore.updateSession(sftpStore.activeTabId!, {
          isConnected: false,
          isConnecting: false,
          error: "Session Ended",
        });
      }
    });
    setFilteredFiles(
      showHiddenFiles
        ? files
        : files.filter((file: SFTP_FILES_LIST) => !file.name.startsWith(".")),
    );
    setTimeout(() => files.length > 0 && handleSetLoading(false), 1000);

    return () => {
      socket.off(SocketEventConstants.FILE_UPLOADED_PROGRESS, onUploadProgress);
      socket.off(SocketEventConstants.FILE_UPLOADED, onFileUploaded);
      socket.off(SocketEventConstants.SFTP_ENDED);
      socket.off(SocketEventConstants.SFTP_READY);
    };
  }, [files, handleSetLoading, socket, showHiddenFiles]);

  return (
    <>
      <EnhancedFileUploadPopup
        open={open}
        setOpen={setOpen}
        files={uploadedFiles}
        setFiles={setUploadedFiles}
        isUploading={isUploading}
        setIsUploading={setIsUploading}
        startUpload={startUpload}
      />
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* ── Left: File Tree Sidebar ── */}
          <ResizablePanel
            defaultSize={treeCollapsed ? 3 : 20}
            minSize={15}
            maxSize={40}
            collapsible
            onCollapse={() => setTreeCollapsed(true)}
            onExpand={() => setTreeCollapsed(false)}
          >
            <SftpFileTree
              currentDir={path}
              files={filteredFiles}
              onNavigate={(dirPath) => handleSetCurrentDir(dirPath)}
              collapsed={treeCollapsed}
              onCollapsedChange={setTreeCollapsed}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* ── Right: Existing file pane content ── */}
          <ResizablePanel defaultSize={80}>
            <div
              className="flex flex-col h-full"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex justify-between items-center p-2 bg-primary/10">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{title}</span>
                  <PathBreadcrumb
                    handleSetCurrentDir={handleSetCurrentDir}
                    loading={loading}
                    fetchFolderSuggestions={async (path: string) => [
                      "Comming Soon , till Then wait, hahahah",
                      "Busy in Jobs :)",
                    ]}
                    currentPath={path}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  {hasError ? (
                    <RefreshCwIcon
                      xlinkTitle="Refresh again"
                      className="h-4 w-4 cursor-pointer text-red-500"
                      onClick={handleRetrySFTPConnect}
                    />
                  ) : (
                    <RefreshCwIcon
                      xlinkTitle="Refresh"
                      className="h-4 w-4 cursor-pointer"
                      onClick={() =>
                        socket?.emit(SocketEventConstants.SFTP_GET_FILE, {
                          dirPath: path,
                        })
                      }
                    />
                  )}

                  {!loading && (
                    <>
                      <HomeIcon
                        className="h-4 w-4 cursor-pointer"
                        onClick={() => handleSetCurrentDir("")}
                      />
                      <Input
                        type="text"
                        placeholder="Filter"
                        onChange={(e) => handleFilterChange(e.target.value)}
                        className="h-8 w-40"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Filter className="h-4 w-4" />
                      </Button>

                      <FilterDropdown
                        menu={[
                          {
                            label: `${showHiddenFiles ? "Hide" : "Show"} Hidden Files`,
                            action: () => handleHiddenFilesFilter(),
                            disabled: false,
                          },
                          {
                            label: "New File",
                            action: () => console.log(""),
                            disabled: true,
                          },
                          {
                            label: "New Folder",
                            action: () => console.log(""),
                            disabled: true,
                          },
                          {
                            label: "Upload File/Folder",
                            action: () => setOpen(true),
                          },
                          {
                            label: "Download Current Dir Zip",
                            action: () => console.log(""),
                          },
                          {
                            label: "Refresh",
                            action: () =>
                              socket?.emit(SocketEventConstants.SFTP_GET_FILE, {
                                dirPath: path,
                              }),
                          },
                        ]}
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </FilterDropdown>
                    </>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-grow relative">
                {loading ? (
                  <div className="absolute inset-0 bg-black opacity-75 flex items-center justify-center">
                    <div className="text-white font-semibold">Loading...</div>
                  </div>
                ) : (
                  <FileList files={filteredFiles} currentDir={path} />
                )}
                {dragOver && (
                  <div
                    className={`absolute inset-0 border-2 border-dashed rounded-lg p-8  opacity-95 bg-black flex items-center justify-center transition-all duration-200 ease-in-out`}
                  >
                    <input
                      type="file"
                      multiple
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-gray-200 font-semibold">
                        Drop your files here
                      </p>
                      <p className="mt-1 text-gray-500">
                        File Will Upload to <b>{path}</b>
                      </p>
                    </div>
                  </div>
                )}
              </ScrollArea>

              {uploadFileName && fileUploadProgress && (
                <ShowProgressBar
                  index={1}
                  download={fileUploadProgress}
                  onCancel={() => {
                    socket?.emit(SocketEventConstants.CANCEL_UPLOADING, {
                      fileName: uploadFileName,
                    });
                  }}
                />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  );
}
