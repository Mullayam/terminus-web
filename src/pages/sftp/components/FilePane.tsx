/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  FileIcon,
  Filter,
  FolderCode,
  HomeIcon,
  Loader2,
  MoreVertical,
  RefreshCwIcon,
  Upload,
} from "lucide-react";
import { FileList } from "./FileList";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { useResumableUpload } from "../hooks/useResumableUpload";
import { UploadManagerPanel } from "./upload";
import { ArchiveProgress } from "./ArchiveProgress";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { SftpFileTree, TreeContextActions } from "./SftpFileTree";
import { DeleteFolderDialog } from "./DeleteDialog";
import { NewFolderDialog } from "./NewDialog";
import { FilePermissions } from "./edit-permission";
import { StatsInfoCard } from "./StatsInfoCards";
import { FileEditor } from "./FileEditor";
import type { RootObject } from "./FileList";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

type DroppedFile = File & { path?: string };

/**
 * Reads everything from a drop, expanding dropped folders recursively via the
 * webkitGetAsEntry API so nested files keep their relative path (folder upload).
 * Falls back to the flat file list when the entries API is unavailable.
 */
async function readDroppedFiles(dataTransfer: DataTransfer): Promise<DroppedFile[]> {
  const items = dataTransfer.items;
  // Entries must be captured synchronously while the drop event is still live.
  const entries: any[] = [];
  if (items && items.length) {
    for (let i = 0; i < items.length; i++) {
      const entry = (items[i] as any).webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
  }
  if (!entries.length) {
    return Array.from(dataTransfer.files ?? []) as DroppedFile[];
  }

  const out: DroppedFile[] = [];
  const walk = (entry: any): Promise<void> =>
    new Promise((resolve) => {
      if (entry.isFile) {
        entry.file(
          (file: File) => {
            const withPath = file as DroppedFile;
            withPath.path = (entry.fullPath || file.name).replace(/^\//, "");
            out.push(withPath);
            resolve();
          },
          () => resolve(),
        );
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const pending: Promise<void>[] = [];
        const readBatch = () => {
          // readEntries returns at most 100 entries per call — loop until empty.
          reader.readEntries(
            (batch: any[]) => {
              if (!batch.length) {
                Promise.all(pending).then(() => resolve());
                return;
              }
              for (const child of batch) pending.push(walk(child));
              readBatch();
            },
            () => resolve(),
          );
        };
        readBatch();
      } else {
        resolve();
      }
    });

  await Promise.all(entries.map((entry) => walk(entry)));
  return out;
}

/** Archives the classic endpoint extracts server-side — kept off the resumable path. */
function isExtractableArchive(name: string): boolean {
  return /\.(zip|tar\.gz|tgz|gz)$/i.test(name);
}

/** Relative path for folder detection (drag sets `.path`, folder-select sets `webkitRelativePath`). */
function relPath(f: { path?: string; webkitRelativePath?: string }): string {
  return f.path || f.webkitRelativePath || "";
}

/**
 * Returns the files eligible for resumable upload — a single file or several
 * loose (non-nested) non-archive files. Folders and extractable archives return
 * null so they keep the classic `/api/upload` path.
 */
function resumableFiles(file: unknown): File[] | null {
  const arr = (Array.isArray(file) ? file : [file]) as Array<File & { path?: string }>;
  if (arr.length === 0) return null;
  const allEligible = arr.every(
    (f) => f instanceof File && !relPath(f).includes("/") && !isExtractableArchive(f.name),
  );
  return allEligible ? (arr as File[]) : null;
}

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
  const { socket, tabId } = useSFTPContext();
  const session = useSFTPStore((s) => tabId ? s.sessions[tabId] : undefined);
  const updateSession = useSFTPStore((s) => s.updateSession);
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
  const [isExtracting, setIsExtracting] = useState(false);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [treeStats, setTreeStats] = useState<RootObject | null>(null);
  const [newItemDialog, setNewItemDialog] = useState<{ open: boolean; type: "file" | "folder" }>({ open: false, type: "file" });

  // ── Directory tree for path suggestions ──
  const dirTreeRef = useRef<Set<string>>(new Set());
  const [dirTreePaths, setDirTreePaths] = useState<string[]>([]);

  // Get homeDir from the store — always use own tabId, never activeTabId
  const homeDir = session?.homeDir || "/";

  // ── Resumable, multi-file uploads (loose non-archive files) ──
  const refreshAfterUpload = useCallback(() => {
    socket?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path });
  }, [socket, path]);

  const {
    enqueue: enqueueResumable,
    retry: retryUpload,
    pause: pauseUpload,
    resume: resumeUpload,
    abort: abortUpload,
    dismiss: dismissUpload,
  } = useResumableUpload({
    sessionId: tabId ?? "",
    socket,
    onComplete: refreshAfterUpload,
  });

  /** Navigate to parent directory, clamped to homeDir */
  const handleGoBack = useCallback(() => {
    if (!path || path === "/" || path === homeDir) return;
    // Prevent going above home directory
    const parentDir = path.substring(0, path.lastIndexOf("/")) || "/";
    // Check that parentDir starts with homeDir (or IS homeDir)
    if (parentDir.length < homeDir.length && homeDir.startsWith(parentDir) === false) return;
    handleSetCurrentDir(parentDir);
  }, [path, homeDir, handleSetCurrentDir]);

  const canGoBack = path !== "/" && path !== homeDir && path.length > homeDir.length;

  /** Create file/folder from toolbar (in current directory) */
  const handleToolbarCreate = useCallback(
    (name: string, type: "file" | "folder" | "rename" | "move" | "copy") => {
      const fullPath = `${path}/${name}`;
      if (type === "file") {
        socket?.emit(SocketEventConstants.SFTP_CREATE_FILE, { filePath: fullPath });
      } else if (type === "folder") {
        socket?.emit(SocketEventConstants.SFTP_CREATE_DIR, { folderPath: fullPath });
      }
      socket?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path });
      setNewItemDialog({ open: false, type: "file" });
    },
    [socket, path],
  );

  /** Create/rename/move/copy handler for tree context menu.
   *  `fullPath` is the absolute path of the target node (or new file path for create). */
  const handleTreeCreateFileOrDir = useCallback(
    (fullPath: string, type: "file" | "folder" | "rename" | "move" | "copy", newPath?: string) => {
      if (type === "file") {
        socket?.emit(SocketEventConstants.SFTP_CREATE_FILE, { filePath: fullPath });
      } else if (type === "folder") {
        socket?.emit(SocketEventConstants.SFTP_CREATE_DIR, { folderPath: fullPath });
      } else if (type === "rename") {
        const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/")) || "/";
        socket?.emit(SocketEventConstants.SFTP_RENAME_FILE, {
          oldPath: fullPath,
          newPath: `${parentDir}/${newPath}`,
        });
      } else if (type === "move") {
        socket?.emit(SocketEventConstants.SFTP_MOVE_FILE, {
          oldPath: fullPath,
          newPath: newPath,
        });
      } else if (type === "copy") {
        socket?.emit(SocketEventConstants.SFTP_COPY_FILE, {
          currentPath: fullPath,
          destinationPath: newPath,
        });
      }
      socket?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path });
    },
    [socket, path],
  );

  // Listen for stats events for tree context menu
  useEffect(() => {
    if (!socket) return;
    const onStats = (data: RootObject) => setTreeStats(data);
    socket.on(SocketEventConstants.SFTP_FILE_STATS, onStats);
    return () => { socket.off(SocketEventConstants.SFTP_FILE_STATS, onStats); };
  }, [socket]);

  // ── Fetch dir tree on SFTP ready & on every directory change ──
  useEffect(() => {
    if (!socket || !path) return;

    // Emit request for 2-depth tree from the current path
    socket.emit(SocketEventConstants.SFTP_GET_DIR_TREE, { dirPath: path, depth: 2 });
  }, [socket, path]);

  // ── Listen for dir tree response and merge without duplicates ──
  useEffect(() => {
    if (!socket) return;

    /** Recursively collect all directory paths from `{ name, path, children }` nodes */
    const flattenTree = (nodes: any[], collected: string[]) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const nodePath: string = node.path || "";
        if (nodePath) collected.push(nodePath);
        if (Array.isArray(node.children)) {
          flattenTree(node.children, collected);
        }
      }
    };

    const onDirTree = (data: { root: any; dirPath: string; depth: number }) => {
      const collected: string[] = [];

      // root can be a single node or an array of nodes
      const nodes = Array.isArray(data.root) ? data.root : [data.root];
      flattenTree(nodes, collected);

      // Merge into existing set (no duplicates)
      const set = dirTreeRef.current;
      let added = false;
      for (const p of collected) {
        if (!set.has(p)) {
          set.add(p);
          added = true;
        }
      }
      if (added) {
        setDirTreePaths(Array.from(set).sort());
      }
    };

    socket.on(SocketEventConstants.SFTP_DIR_TREE, onDirTree);
    return () => { socket.off(SocketEventConstants.SFTP_DIR_TREE, onDirTree); };
  }, [socket]);

  const treeContextActions = useMemo<TreeContextActions>(
    () => ({
      onEditWithEditor: (fullPath) => {
        const host = session?.host ?? "";
        window.open(
          `/ssh/sftp/editor?path=${encodeURIComponent(fullPath)}&tabId=${encodeURIComponent(tabId ?? "")}&user=${encodeURIComponent(host)}`,
          "_blank",
        );
      },
      onPreview: (fullPath) => {
        window.open(
          `/ssh/sftp/preview?path=${encodeURIComponent(fullPath)}&tabId=${encodeURIComponent(tabId ?? "")}`,
          "_blank",
        );
      },
      onRefresh: () => {
        socket?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path });
      },
      onDownload: async (node) => {
        try {
          await ApiCore.downloadToDisk({
            remotePath: node.fullPath,
            type: node.type === "d" ? "dir" : "file",
            name: node.name,
            sessionId: tabId,
          });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message,
            duration: 2000,
          });
        }
      },
      onProperties: (fullPath) => {
        socket?.emit(SocketEventConstants.SFTP_FILE_STATS, { path: fullPath });
      },
      onDelete: (node) => {
        if (node.type === "d") {
          socket?.emit(SocketEventConstants.SFTP_DELETE_DIR, {
            path: node.fullPath,
          });
        } else {
          socket?.emit(SocketEventConstants.SFTP_DELETE_FILE, {
            path: node.fullPath,
          });
        }
        socket?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path });
      },
      isPreviewable: (name) => {
        const ext = name.includes(".")
          ? name.split(".").pop()?.toLowerCase()
          : "";
        return [
          "jpg",
          "jpeg",
          "png",
          "gif",
          "svg",
          "webp",
          "bmp",
          "ico",
          "mp4",
          "webm",
          "mp3",
          "wav",
          "ogg",
          "pdf",
          "md",
          "txt",
          "log",
          "html",
          "htm",
        ].includes(ext || "");
      },
      /* ── Render functions for tree context menu dialogs ── */
      renderEdit: (fullPath, name) => (
        <FileEditor filePath={fullPath} fileName={name} socket={socket} />
      ),
      renderRename: (node) => (
        <NewFolderDialog
          type="rename"
          data={{ name: node.name, type: node.type } as SFTP_FILES_LIST}
          onClick={(_name, type, newName) => {
            handleTreeCreateFileOrDir(node.fullPath, type, newName);
          }}
        />
      ),
      renderMove: (node) => (
        <NewFolderDialog
          type="move"
          data={{ name: node.name, type: node.type } as SFTP_FILES_LIST}
          currentDir={path}
          homeDir={homeDir}
          onClick={(_name, type, destPath) => {
            handleTreeCreateFileOrDir(node.fullPath, type, destPath);
          }}
        />
      ),
      renderCopy: (node) => (
        <NewFolderDialog
          type="copy"
          data={{ name: node.name, type: node.type } as SFTP_FILES_LIST}
          currentDir={path}
          homeDir={homeDir}
          onClick={(_name, _type, destPath) => {
            handleTreeCreateFileOrDir(node.fullPath, "copy", destPath);
          }}
        />
      ),
      renderDelete: (node) => (
        <DeleteFolderDialog
          folderName={node.name}
          type={node.type}
          onDelete={() => {
            if (node.type === "d") {
              socket?.emit(SocketEventConstants.SFTP_DELETE_DIR, { path: node.fullPath });
            } else {
              socket?.emit(SocketEventConstants.SFTP_DELETE_FILE, { path: node.fullPath });
            }
            socket?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path });
          }}
        />
      ),
      renderNewFile: (node) => (
        <NewFolderDialog
          type="file"
          data={{ name: node.name, type: node.type } as SFTP_FILES_LIST}
          onClick={(enteredName, type) => {
            const parentDir = node.type === "d" ? node.fullPath : node.fullPath.substring(0, node.fullPath.lastIndexOf("/"));
            handleTreeCreateFileOrDir(`${parentDir}/${enteredName}`, type);
          }}
        />
      ),
      renderNewFolder: (node) => (
        <NewFolderDialog
          type="folder"
          data={{ name: node.name, type: node.type } as SFTP_FILES_LIST}
          onClick={(enteredName, type) => {
            const parentDir = node.type === "d" ? node.fullPath : node.fullPath.substring(0, node.fullPath.lastIndexOf("/"));
            handleTreeCreateFileOrDir(`${parentDir}/${enteredName}`, type);
          }}
        />
      ),
      renderProperties: () => <StatsInfoCard data={treeStats} />,
      renderPermissions: (node) => (
        <FilePermissions
          data={{ name: node.name, type: node.type, rights: { user: "", group: "", other: "" } } as SFTP_FILES_LIST}
        />
      ),
    }),
    [socket, tabId, path, homeDir, session?.host, handleTreeCreateFileOrDir, treeStats],
  );

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
  // Track nested drag enter/leave so the overlay doesn't flicker when the
  // pointer moves between child rows/cells (dragenter/dragleave fire per node).
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    // Ignore drags that aren't files (e.g. text selection, internal elements)
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragCounterRef.current += 1;
    setDragOver(true);
  };

  const handleDragOver = (e: any) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragOver(false);
    }
  };

  const handleDrop = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragOver(false);

    const dataTransfer = e.dataTransfer;
    if (!dataTransfer) return;

    const collected = await readDroppedFiles(dataTransfer);
    if (collected.length === 0) return;

    // A single loose file keeps the simple single-upload path; anything with a
    // nested path (folder) or multiple files goes through the batch uploader.
    if (collected.length === 1 && !collected[0].path?.includes("/")) {
      startUpload(collected[0]);
    } else {
      startUpload(collected);
    }
  };

  const startUpload = async (file: any) => {
    // Loose non-archive files (single or many) go through the resumable
    // uploader; folders, multi-selections with nested paths and extractable
    // archives keep the classic path.
    const resumable = resumableFiles(file);
    if (resumable) {
      enqueueResumable(resumable, path);
      setUploadedFiles([]);
      setIsUploading(false);
      setOpen(false);
      return;
    }

    const label = Array.isArray(file)
      ? file.length === 1
        ? file[0].name
        : `${file.length} items`
      : file?.name;
    setUploadFileName(label);
    try {
      const data = await ApiCore.uploadFile(file, path, tabId, label);
      if (!data.status) {
        throw new Error(data.message);
      }
      setOpen(false);
    } catch (error: any) {
      setUploadFileName(null);
      setFileUploadProgress(null);
      setIsExtracting(false);
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
    const onUploadProgress = (data: DownloadProgressType & { phase?: string }) => {
      if (data.phase) return; // resumable uploads render in UploadManagerPanel
      setIsExtracting(false);
      setFileUploadProgress(data);
    };
    const onExtracting = () => {
      setIsExtracting(true);
    };
    const onFileUploaded = () => {
      setUploadFileName(null);
      setFileUploadProgress(null);
      setIsExtracting(false);
    };
    const onSftpReady = () => {
      if (tabId) {
        updateSession(tabId, {
          isConnected: true,
          isConnecting: false,
          error: undefined,
        });
      }
    };
    const onSftpEnded = (mesage: string) => {
      toast({
        title: "SFTP Session Ended",
        description: mesage,
      });
      setSessionClosed(true);
      if (tabId) {
        updateSession(tabId, {
          isConnected: false,
          isConnecting: false,
          error: "Session Ended",
        });
      }
    };
    socket.on(SocketEventConstants.SFTP_READY, onSftpReady);
    socket.on(SocketEventConstants.EXTRACTING, onExtracting);
    socket.on(SocketEventConstants.FILE_UPLOADED_PROGRESS, onUploadProgress);
    socket.on(SocketEventConstants.FILE_UPLOADED, onFileUploaded);
    socket.on(SocketEventConstants.SFTP_ENDED, onSftpEnded);
    setFilteredFiles(
      showHiddenFiles
        ? files
        : files.filter((file: SFTP_FILES_LIST) => !file.name.startsWith(".")),
    );
    const loadingTimer = setTimeout(
      () => files.length > 0 && handleSetLoading(false),
      1000,
    );

    return () => {
      clearTimeout(loadingTimer);
      socket.off(SocketEventConstants.EXTRACTING, onExtracting);
      socket.off(SocketEventConstants.FILE_UPLOADED_PROGRESS, onUploadProgress);
      socket.off(SocketEventConstants.FILE_UPLOADED, onFileUploaded);
      socket.off(SocketEventConstants.SFTP_ENDED, onSftpEnded);
      socket.off(SocketEventConstants.SFTP_READY, onSftpReady);
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
              showHiddenFiles={showHiddenFiles}
              contextActions={treeContextActions}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* ── Right: Existing file pane content ── */}
          <ResizablePanel defaultSize={80}>
            <div
              className="flex flex-col h-full"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex justify-between items-center p-2 bg-primary/10">
                <div className="flex items-center space-x-2">
                  {canGoBack && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleGoBack}
                      title="Go back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <span className="font-semibold">{title}</span>
                  <PathBreadcrumb
                    handleSetCurrentDir={handleSetCurrentDir}
                    loading={loading}
                    fetchFolderSuggestions={async (query: string) => {
                      if (!query) return [];
                      const q = query.toLowerCase();
                      return dirTreePaths.filter((p) => p.toLowerCase().includes(q));
                    }}
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNewItemDialog({ open: true, type: "file" })} title="New File">
                        <FileIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNewItemDialog({ open: true, type: "folder" })} title="New Folder">
                        <FolderCode className="h-4 w-4" />
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
                            action: async () => {
                              try {
                                const dirName = path.split("/").filter(Boolean).pop() || "download";
                                await ApiCore.downloadToDisk({
                                  remotePath: path,
                                  type: "dir",
                                  name: dirName,
                                  sessionId: tabId,
                                });
                              } catch (error: any) {
                                toast({
                                  variant: "destructive",
                                  title: "Error",
                                  description: error.message,
                                  duration: 2000,
                                });
                              }
                            },
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
                    className={`absolute inset-0 z-20 border-2 border-dashed rounded-lg p-8 opacity-95 bg-black flex items-center justify-center transition-all duration-200 ease-in-out pointer-events-none`}
                  >
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

              {isExtracting && (
                <div className="fixed bottom-5 right-4 z-[1000] flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 px-4 py-3 shadow-xl">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-900 dark:text-white">Extracting archive…</span>
                </div>
              )}

              {uploadFileName && fileUploadProgress && (
                <ShowProgressBar
                  index={1}
                  download={fileUploadProgress}
                  onCancel={() => {
                    socket?.emit(SocketEventConstants.CANCEL_UPLOADING, uploadFileName);
                    setUploadFileName(null);
                    setFileUploadProgress(null);
                    setIsExtracting(false);
                  }}
                />
              )}

              <UploadManagerPanel
                sessionId={tabId ?? ""}
                onPause={pauseUpload}
                onResume={resumeUpload}
                onRetry={retryUpload}
                onAbort={abortUpload}
                onDismiss={dismissUpload}
              />

              <ArchiveProgress socket={socket} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* New File / Folder Dialog (toolbar buttons) */}
      <Dialog open={newItemDialog.open} onOpenChange={(open) => setNewItemDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[500px] bg-[#1a1b26]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50">
          <VisuallyHidden.Root>
            <DialogTitle>New {newItemDialog.type === "file" ? "File" : "Folder"}</DialogTitle>
          </VisuallyHidden.Root>
          <NewFolderDialog
            type={newItemDialog.type}
            data={{ name: "", type: newItemDialog.type === "folder" ? "d" : "-" } as SFTP_FILES_LIST}
            onClick={handleToolbarCreate}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
