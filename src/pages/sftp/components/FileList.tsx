/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SFTP_FILES_LIST, RIGHT_CLICK_ACTIONS } from "./interface";
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
import { cn, formatBytes, formatPermissions } from "@/lib/utils";
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
  ExternalLink,
  Eye,
} from "lucide-react";
import { DeleteFolderDialog } from "./DeleteDialog";
import { NewFolderDialog } from "./NewDialog";
import { useSFTPContext } from "../sftp-context";
import { useSFTPStore } from "@/store/sftpStore";
import { ContextModal } from "@/components/ui/context-modal";
import { FilePermissions } from "./edit-permission";
import { StatsInfoCard } from "./StatsInfoCards";
import { FileEditor } from "./FileEditor";
import { ApiCore } from "@/lib/api";
import { useDialogState, useLoadingState } from "@/store";
import { isPreviewable } from "./MediaPreviewPage";
export type FileOperations = "file" | "folder" | "rename" | "move" | "copy";

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

/* ─── File type detection ─── */
const _IMG = { label: "IMAGE", color: "bg-pink-500/15 text-pink-400" };
const _VID = { label: "VIDEO", color: "bg-purple-500/15 text-purple-400" };
const _AUD = { label: "AUDIO", color: "bg-teal-500/15 text-teal-400" };
const _DOC = { label: "DOC", color: "bg-blue-500/15 text-blue-400" };
const _SHT = { label: "SHEET", color: "bg-green-500/15 text-green-400" };
const _SLD = { label: "SLIDE", color: "bg-orange-500/15 text-orange-400" };
const _TXT = { label: "TEXT", color: "bg-gray-500/15 text-gray-400" };
const _PDF = { label: "PDF", color: "bg-red-500/15 text-red-400" };
const _CFG = { label: "CONFIG", color: "bg-amber-500/15 text-amber-400" };
const _WEB = { label: "WEB", color: "bg-orange-500/15 text-orange-400" };
const _STY = { label: "STYLE", color: "bg-blue-500/15 text-blue-400" };
const _SHL = { label: "SHELL", color: "bg-green-500/15 text-green-400" };
const _ARC = { label: "ARCHIVE", color: "bg-yellow-500/15 text-yellow-400" };
const _DBS = { label: "DB", color: "bg-emerald-500/15 text-emerald-400" };
const _LIB = { label: "LIB", color: "bg-gray-500/15 text-gray-400" };
const _BIN = { label: "BINARY", color: "bg-gray-500/15 text-gray-400" };
const _EXE = { label: "EXEC", color: "bg-red-500/15 text-red-400" };
const _CRT = { label: "CERT", color: "bg-green-500/15 text-green-400" };
const _FNT = { label: "FONT", color: "bg-fuchsia-500/15 text-fuchsia-400" };
const _TPL = { label: "TEMPLATE", color: "bg-lime-500/15 text-lime-400" };
const _PKG = { label: "PACKAGE", color: "bg-red-500/15 text-red-400" };
const _DSK = { label: "DISK", color: "bg-gray-500/15 text-gray-400" };
const _3D_ = { label: "3D", color: "bg-indigo-500/15 text-indigo-400" };
const _SYS = { label: "SYSTEM", color: "bg-gray-500/15 text-gray-400" };
const _LOG = { label: "LOG", color: "bg-gray-500/15 text-gray-400" };
const _BKP = { label: "BACKUP", color: "bg-gray-500/15 text-gray-400" };
const _DAT = { label: "DATA", color: "bg-lime-500/15 text-lime-400" };
const _NBK = { label: "NOTEBOOK", color: "bg-orange-500/15 text-orange-400" };
const _SCR = { label: "SCRIPT", color: "bg-green-500/15 text-green-400" };

const EXT_MAP: Record<string, { label: string; color: string }> = {
  // Images
  jpg: _IMG,
  jpeg: _IMG,
  png: _IMG,
  gif: _IMG,
  svg: _IMG,
  webp: _IMG,
  ico: _IMG,
  bmp: _IMG,
  tiff: _IMG,
  tif: _IMG,
  psd: _IMG,
  ai: _IMG,
  eps: _IMG,
  raw: _IMG,
  cr2: _IMG,
  nef: _IMG,
  heic: _IMG,
  heif: _IMG,
  avif: _IMG,
  jxl: _IMG,
  // Video
  mp4: _VID,
  mkv: _VID,
  avi: _VID,
  mov: _VID,
  webm: _VID,
  flv: _VID,
  wmv: _VID,
  m4v: _VID,
  "3gp": _VID,
  mpg: _VID,
  mpeg: _VID,
  // Audio
  mp3: _AUD,
  wav: _AUD,
  flac: _AUD,
  ogg: _AUD,
  aac: _AUD,
  m4a: _AUD,
  wma: _AUD,
  opus: _AUD,
  mid: _AUD,
  midi: _AUD,
  aiff: _AUD,
  // Documents
  pdf: _PDF,
  doc: _DOC,
  docx: _DOC,
  rtf: _DOC,
  odt: _DOC,
  pages: _DOC,
  xls: _SHT,
  xlsx: _SHT,
  csv: _SHT,
  tsv: _SHT,
  ods: _SHT,
  numbers: _SHT,
  ppt: _SLD,
  pptx: _SLD,
  odp: _SLD,
  key: _SLD,
  txt: _TXT,
  md: _TXT,
  mdx: _TXT,
  rst: _TXT,
  tex: _TXT,
  latex: _TXT,
  epub: { label: "EBOOK", color: "bg-amber-500/15 text-amber-400" },
  mobi: { label: "EBOOK", color: "bg-amber-500/15 text-amber-400" },
  // Code — JS/TS
  js: { label: "CODE", color: "bg-yellow-500/15 text-yellow-400" },
  jsx: { label: "CODE", color: "bg-yellow-500/15 text-yellow-400" },
  mjs: { label: "CODE", color: "bg-yellow-500/15 text-yellow-400" },
  cjs: { label: "CODE", color: "bg-yellow-500/15 text-yellow-400" },
  ts: { label: "CODE", color: "bg-sky-500/15 text-sky-400" },
  tsx: { label: "CODE", color: "bg-sky-500/15 text-sky-400" },
  // Code — Systems
  py: { label: "CODE", color: "bg-yellow-500/15 text-yellow-400" },
  pyw: { label: "CODE", color: "bg-yellow-500/15 text-yellow-400" },
  pyx: { label: "CODE", color: "bg-yellow-500/15 text-yellow-400" },
  go: { label: "CODE", color: "bg-cyan-500/15 text-cyan-400" },
  rs: { label: "CODE", color: "bg-orange-500/15 text-orange-400" },
  c: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  h: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  cpp: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  hpp: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  cc: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  cxx: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  zig: { label: "CODE", color: "bg-amber-500/15 text-amber-400" },
  nim: { label: "CODE", color: "bg-yellow-500/15 text-yellow-400" },
  d: { label: "CODE", color: "bg-red-500/15 text-red-400" },
  // Code — JVM
  java: { label: "CODE", color: "bg-orange-500/15 text-orange-400" },
  kt: { label: "CODE", color: "bg-purple-500/15 text-purple-400" },
  kts: { label: "CODE", color: "bg-purple-500/15 text-purple-400" },
  scala: { label: "CODE", color: "bg-red-500/15 text-red-400" },
  groovy: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  clj: { label: "CODE", color: "bg-green-500/15 text-green-400" },
  cljs: { label: "CODE", color: "bg-green-500/15 text-green-400" },
  // Code — .NET
  cs: { label: "CODE", color: "bg-violet-500/15 text-violet-400" },
  fs: { label: "CODE", color: "bg-cyan-500/15 text-cyan-400" },
  vb: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  // Code — Web Frameworks
  vue: { label: "CODE", color: "bg-emerald-500/15 text-emerald-400" },
  svelte: { label: "CODE", color: "bg-orange-500/15 text-orange-400" },
  astro: { label: "CODE", color: "bg-purple-500/15 text-purple-400" },
  // Code — Scripting
  php: { label: "CODE", color: "bg-indigo-500/15 text-indigo-400" },
  rb: { label: "CODE", color: "bg-red-500/15 text-red-400" },
  erb: { label: "CODE", color: "bg-red-500/15 text-red-400" },
  swift: { label: "CODE", color: "bg-orange-500/15 text-orange-400" },
  lua: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  pl: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  pm: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  r: { label: "CODE", color: "bg-blue-500/15 text-blue-400" },
  dart: { label: "CODE", color: "bg-sky-500/15 text-sky-400" },
  ex: { label: "CODE", color: "bg-purple-500/15 text-purple-400" },
  exs: { label: "CODE", color: "bg-purple-500/15 text-purple-400" },
  elm: { label: "CODE", color: "bg-cyan-500/15 text-cyan-400" },
  hs: { label: "CODE", color: "bg-purple-500/15 text-purple-400" },
  lhs: { label: "CODE", color: "bg-purple-500/15 text-purple-400" },
  ml: { label: "CODE", color: "bg-orange-500/15 text-orange-400" },
  jl: { label: "CODE", color: "bg-purple-500/15 text-purple-400" },
  m: { label: "CODE", color: "bg-orange-500/15 text-orange-400" },
  f90: { label: "CODE", color: "bg-green-500/15 text-green-400" },
  f95: { label: "CODE", color: "bg-green-500/15 text-green-400" },
  coffee: { label: "CODE", color: "bg-amber-500/15 text-amber-400" },
  asm: _BIN,
  s: _BIN,
  wasm: { label: "CODE", color: "bg-violet-500/15 text-violet-400" },
  sol: { label: "CODE", color: "bg-gray-500/15 text-gray-400" },
  // Notebooks
  ipynb: _NBK,
  rmd: _NBK,
  // Config / Data
  json: _CFG,
  jsonc: _CFG,
  json5: _CFG,
  yaml: _CFG,
  yml: _CFG,
  toml: _CFG,
  ini: _CFG,
  env: _CFG,
  xml: _CFG,
  conf: _CFG,
  cfg: _CFG,
  properties: _CFG,
  editorconfig: _CFG,
  htaccess: _CFG,
  nginx: _CFG,
  // Serialization
  proto: _DAT,
  graphql: _DAT,
  gql: _DAT,
  ndjson: _DAT,
  // Web
  html: _WEB,
  htm: _WEB,
  xhtml: _WEB,
  css: _STY,
  scss: { label: "STYLE", color: "bg-pink-500/15 text-pink-400" },
  sass: { label: "STYLE", color: "bg-pink-500/15 text-pink-400" },
  less: _STY,
  styl: { label: "STYLE", color: "bg-green-500/15 text-green-400" },
  // Template engines
  ejs: _TPL,
  hbs: _TPL,
  pug: _TPL,
  jade: _TPL,
  twig: _TPL,
  njk: _TPL,
  liquid: _TPL,
  // Shell / Scripts
  sh: _SHL,
  bash: _SHL,
  zsh: _SHL,
  fish: _SHL,
  bat: _SCR,
  cmd: _SCR,
  ps1: { label: "SCRIPT", color: "bg-blue-500/15 text-blue-400" },
  psm1: { label: "SCRIPT", color: "bg-blue-500/15 text-blue-400" },
  // Archives
  zip: _ARC,
  tar: _ARC,
  gz: _ARC,
  tgz: _ARC,
  bz2: _ARC,
  xz: _ARC,
  lz: _ARC,
  zst: _ARC,
  "7z": _ARC,
  rar: _ARC,
  // Packages / Disk images
  deb: _PKG,
  rpm: _PKG,
  apk: { label: "PACKAGE", color: "bg-green-500/15 text-green-400" },
  snap: _PKG,
  flatpak: _PKG,
  dmg: _DSK,
  iso: _DSK,
  img: _DSK,
  msi: { label: "INSTALLER", color: "bg-blue-500/15 text-blue-400" },
  // Database
  sql: _DBS,
  db: _DBS,
  sqlite: _DBS,
  sqlite3: _DBS,
  mdb: _DBS,
  accdb: _DBS,
  dump: _DBS,
  // Binary / Executable
  exe: _EXE,
  out: _EXE,
  elf: _EXE,
  app: _EXE,
  bin: _BIN,
  o: _BIN,
  so: _LIB,
  dll: _LIB,
  dylib: _LIB,
  a: _LIB,
  jar: { label: "LIB", color: "bg-orange-500/15 text-orange-400" },
  war: { label: "LIB", color: "bg-orange-500/15 text-orange-400" },
  // Certificates & Keys
  pem: _CRT,
  crt: _CRT,
  cer: _CRT,
  csr: _CRT,
  p12: _CRT,
  pfx: _CRT,
  jks: _CRT,
  pub: { label: "KEY", color: "bg-yellow-500/15 text-yellow-400" },
  // Fonts
  ttf: _FNT,
  otf: _FNT,
  woff: _FNT,
  woff2: _FNT,
  eot: _FNT,
  // 3D / CAD
  obj: _3D_,
  stl: _3D_,
  fbx: _3D_,
  gltf: _3D_,
  glb: _3D_,
  blend: { label: "3D", color: "bg-orange-500/15 text-orange-400" },
  // Systemd / Services
  service: _SYS,
  socket: _SYS,
  timer: _SYS,
  // Docker
  dockerignore: { label: "DOCKER", color: "bg-sky-500/15 text-sky-400" },
  // Lock / Log / Map / Diff / Backup
  lock: { label: "LOCK", color: "bg-gray-500/15 text-gray-400" },
  log: _LOG,
  map: { label: "MAP", color: "bg-gray-500/15 text-gray-400" },
  diff: { label: "DIFF", color: "bg-green-500/15 text-green-400" },
  patch: { label: "DIFF", color: "bg-green-500/15 text-green-400" },
  bak: _BKP,
  swp: _BKP,
  tmp: { label: "TEMP", color: "bg-gray-500/15 text-gray-400" },
};

/** Well-known filenames without extensions */
const SPECIAL_NAMES: Record<string, { label: string; color: string }> = {
  dockerfile: { label: "DOCKER", color: "bg-sky-500/15 text-sky-400" },
  "docker-compose": { label: "DOCKER", color: "bg-sky-500/15 text-sky-400" },
  makefile: { label: "BUILD", color: "bg-amber-500/15 text-amber-400" },
  caddyfile: _CFG,
  procfile: _CFG,
  vagrantfile: _CFG,
  gemfile: { label: "CONFIG", color: "bg-red-500/15 text-red-400" },
  rakefile: { label: "BUILD", color: "bg-red-500/15 text-red-400" },
  justfile: { label: "BUILD", color: "bg-amber-500/15 text-amber-400" },
  license: _TXT,
  readme: _TXT,
  changelog: _TXT,
  authors: _TXT,
  contributing: _TXT,
  ".gitignore": { label: "GIT", color: "bg-orange-500/15 text-orange-400" },
  ".gitattributes": { label: "GIT", color: "bg-orange-500/15 text-orange-400" },
  ".gitmodules": { label: "GIT", color: "bg-orange-500/15 text-orange-400" },
  ".env": _CFG,
  ".editorconfig": _CFG,
  ".npmrc": { label: "CONFIG", color: "bg-red-500/15 text-red-400" },
  ".yarnrc": { label: "CONFIG", color: "bg-blue-500/15 text-blue-400" },
  ".dockerignore": { label: "DOCKER", color: "bg-sky-500/15 text-sky-400" },
  ".eslintrc": { label: "CONFIG", color: "bg-indigo-500/15 text-indigo-400" },
  ".prettierrc": { label: "CONFIG", color: "bg-pink-500/15 text-pink-400" },
  ".babelrc": { label: "CONFIG", color: "bg-yellow-500/15 text-yellow-400" },
};

function getFileKind(file: SFTP_FILES_LIST): { label: string; color: string } {
  if (file.type === "d")
    return { label: "FOLDER", color: "bg-blue-500/15 text-blue-400" };
  if (file.type === "l")
    return { label: "LINK", color: "bg-cyan-500/15 text-cyan-400" };

  const name = file.name || "";
  const lower = name.toLowerCase();

  // Check special filenames first (exact match)
  if (SPECIAL_NAMES[lower]) return SPECIAL_NAMES[lower];
  if (SPECIAL_NAMES[name]) return SPECIAL_NAMES[name]; // dotfiles are case-sensitive

  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  if (ext && EXT_MAP[ext]) return EXT_MAP[ext];

  return { label: "FILE", color: "bg-zinc-500/15 text-zinc-400" };
}

export function FileList({
  files,
  currentDir,
}: {
  files: SFTP_FILES_LIST[];
  currentDir: string;
}) {
  const { toast } = useToast();
  const { socket, tabId } = useSFTPContext();
  const sftpStore = useSFTPStore();
  const homeDir = tabId ? sftpStore.sessions[tabId]?.homeDir || '/' : '/';
  const [rowSelection, setRowSelection] = useState({});
  const { setLoading } = useLoadingState();
  const [stats, setStats] = useState<null | RootObject>(null);
  const { openDialog, setOpenDialog } = useDialogState();

  // Refs keep latest values so memoized callbacks never go stale
  const socketRef = useRef(socket);
  const currentDirRef = useRef(currentDir);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);
  useEffect(() => {
    currentDirRef.current = currentDir;
  }, [currentDir]);

  const displayMesasge = useCallback(
    (description: string) => {
      toast({
        title: "Success",
        description: description,
        duration: 2000,
      });
    },
    [toast],
  );

  const handleDirectoryChange = useCallback(
    (path: string) => {
      setLoading(true);
      const newDir = `${currentDirRef.current}/${path}`;
      localStorage.setItem(`sftp_current_dir_${tabId}`, newDir);
      // Also persist per host so future tabs to the same host start here
      const host = tabId ? sftpStore.sessions[tabId]?.host : undefined;
      if (host) localStorage.setItem(`sftp_host_dir_${host}`, newDir);
      socketRef.current?.emit(SocketEventConstants.SFTP_GET_FILE, {
        dirPath: newDir,
      });
    },
    [setLoading, tabId, sftpStore.sessions],
  );
  // Memoize columns so react-table doesn't re-render all cells on every state change
  const columns: ColumnDef<SFTP_FILES_LIST>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div
            className="flex items-center gap-1.5 cursor-pointer select-none"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              if (row.original.type === "d") {
                handleDirectoryChange(row.getValue("name"));
              }
            }}
          >
            <FileIcon
              name={row.getValue("name")}
              isDirectory={row.original.type === "d"}
              size={16}
            />
            <span className="truncate">{row.getValue("name")}</span>
          </div>
        ),
      },
      {
        id: "fileType",
        header: "Type",
        cell: ({ row }) => {
          const kind = getFileKind(row.original);
          return (
            <span
              className={cn(
                "text-[11px] font-medium px-1.5 py-0.5 rounded",
                kind.color,
              )}
            >
              {kind.label}
            </span>
          );
        },
      },
      {
        accessorKey: "size",
        header: "Size",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatBytes(row.getValue("size"))}
          </span>
        ),
      },
      {
        accessorKey: "modifyTime",
        header: "Modified",
        cell: ({ row }) => {
          const raw = row.getValue("modifyTime");
          const ts = typeof raw === "string" ? Date.parse(raw) : Number(raw);
          const d = new Date(isNaN(ts) ? 0 : ts);
          return (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground">
                    {d.toLocaleString()}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {d.toLocaleString()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: "accessTime",
        header: "Accessed",
        cell: ({ row }) => {
          const raw = row.getValue("accessTime");
          const ts = typeof raw === "string" ? Date.parse(raw) : Number(raw);
          const d = new Date(isNaN(ts) ? 0 : ts);
          return (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground">
                    {d.toLocaleString()}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {d.toLocaleString()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
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
    ],
    [handleDirectoryChange],
  );
  const shortcutMap: Record<string, RIGHT_CLICK_ACTIONS> = {
    "Ctrl+E": "edit",
    "Ctrl+C": "copy",
    "Ctrl+R": "rename",
    "Ctrl+M": "move",
    "Ctrl+D": "delete",
    "Ctrl+P": "properties",
    "Ctrl+N": "createFile",
    "Ctrl+U": "upload",
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
        });
      }
      // handleContextClickAction(shortcutMap[keyCombo], rowSelection);
    }
  };
  const handleDownload = async (
    data: { remotePath: string } & SFTP_FILES_LIST,
  ) => {
    try {
      const response = await ApiCore.download({
        remotePath: data.remotePath,
        type: data.type === "d" ? "dir" : "file",
        name: data.name,
      });

      if (!response.ok) {
        throw new Error("Failed to download file");
      }
      // Convert the response into a Blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", data.name);
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
      });
    }
  };
  const handleContextClickAction = async (
    action: RIGHT_CLICK_ACTIONS,
    data: SFTP_FILES_LIST,
  ) => {
    const fullPath = `${currentDir}/${data.name}`;

    switch (action) {
      case "rename":
        displayMesasge("rename file: " + data);
        break;
      case "move":
        displayMesasge("move file: " + data);
        break;
      case "delete":
        if (data.type === "d") {
          socket?.emit(SocketEventConstants.SFTP_DELETE_DIR, {
            path: fullPath,
          });
        } else {
          socket?.emit(SocketEventConstants.SFTP_DELETE_FILE, {
            path: fullPath,
          });
        }
        handleRefreshSftp();
        setOpenDialog(false);
        break;
      case "properties":
        socket?.emit(SocketEventConstants.SFTP_FILE_STATS, { path: fullPath });
        break;
      case "refresh":
        handleRefreshSftp();
        break;
      case "download":
        handleDownload({
          remotePath: fullPath,
          ...data,
        });
        break;
      default:
        break;
    }
  };
  // Memoize sorted data — never mutate the files prop in-place
  const sortedFiles = useMemo(
    () =>
      [...files].sort((a, b) => (a.type === "d" && b.type !== "d" ? -1 : 1)),
    [files],
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
    socketRef.current?.emit(SocketEventConstants.SFTP_GET_FILE, {
      dirPath: currentDirRef.current,
    });
  }, []);
  const handleCreateFileOrDir = (
    path: string,
    type: FileOperations,
    newPath?: string,
  ) => {
    const fullPath = `${currentDir}/${path}`;
    if (type === "file") {
      socket?.emit(SocketEventConstants.SFTP_CREATE_FILE, {
        filePath: fullPath,
      });
    } else if (type === "folder") {
      socket?.emit(SocketEventConstants.SFTP_CREATE_DIR, {
        folderPath: fullPath,
      });
    } else if (type === "move") {
      socket?.emit(SocketEventConstants.SFTP_MOVE_FILE, {
        folderPath: fullPath,
      });
    } else if (type === "rename") {
      const payload = {
        oldPath: `${currentDir}/${path}`,
        newPath: `${currentDir}/${newPath}`,
      };
      socket?.emit(SocketEventConstants.SFTP_RENAME_FILE, payload);
    }
    handleRefreshSftp();
  };
  /*************  ✨ Windsurf Command 🌟  *************/
  const handleCopy = (sourcePath: string, destinationPath: string) => {

    if (sourcePath === destinationPath) {
      const sourceFileName = sourcePath.split("/").pop();
      
      const fileNameWithoutExtension = sourceFileName?.split(".").shift();
      const fileExtension = sourceFileName?.split(".").pop();
      destinationPath = `${destinationPath}/${fileNameWithoutExtension}-copy.${fileExtension}`;

      socket?.emit(SocketEventConstants.SFTP_COPY_FILE, {
        currentPath: sourcePath,
        destinationPath: destinationPath,
      });
      handleRefreshSftp();
    }
  };

  useEffect(() => {
      const onStats = (data: RootObject) => setStats(data);
      socket?.on(SocketEventConstants.SFTP_FILE_STATS, onStats);
      document.addEventListener("keydown", handleKeydown);
      return () => {
        socket?.off(SocketEventConstants.SFTP_FILE_STATS, onStats);
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
                            header.getContext(),
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
                        key={cell.id}
                        trigger={
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        }
                        title={row.getValue("name")}
                        contextItems={[
                          {
                            label: "Edit",
                            icon: <Pencil className="w-4 h-4" />,
                            disabled: row.original.type === "d",
                            content:
                              row.original.type !== "d" ? (
                                <FileEditor
                                  filePath={`${currentDir}/${row.getValue("name")}`}
                                  fileName={row.getValue("name")}
                                  socket={socket}
                                />
                              ) : undefined,
                          },

                          {
                            label: "Edit with Editor",
                            icon: <ExternalLink className="w-4 h-4" />,
                            disabled: row.original.type === "d",
                            action: () => {
                              const fullPath = `${currentDir}/${row.getValue("name")}`;
                              window.open(
                                `/ssh/sftp/editor?path=${encodeURIComponent(fullPath)}&tabId=${encodeURIComponent(tabId ?? "")}&user=${encodeURIComponent(tabId ? sftpStore.sessions[tabId]?.host ?? "" : "")}`,
                                "_blank",
                              );
                            },
                          },
                          {
                            label: "Preview",
                            icon: <Eye className="w-4 h-4" />,
                            disabled:
                              row.original.type === "d" ||
                              !isPreviewable(row.getValue("name")),
                            action: () => {
                              const fullPath = `${currentDir}/${row.getValue("name")}`;
                              window.open(
                                `/ssh/sftp/preview?path=${encodeURIComponent(fullPath)}&tabId=${encodeURIComponent(tabId ?? "")}`,
                                "_blank",
                              );
                            },
                          },
                          {
                            label: "Refresh",
                            icon: <RefreshCw className="w-4 h-4" />,
                            action: () =>
                              handleContextClickAction("refresh", row.original),
                            separator: true,
                          },
                          {
                            label: "Rename",
                            icon: <Type className="w-4 h-4" />,
                            content: (
                              <NewFolderDialog
                                type="rename"
                                data={row.original}
                                onClick={handleCreateFileOrDir}
                              />
                            ),
                          },
                          {
                            label: "Move",
                            icon: <FolderInput className="w-4 h-4" />,
                            content: (
                              <NewFolderDialog
                                type="move"
                                data={row.original}
                                currentDir={currentDir}
                                homeDir={homeDir}
                                onClick={handleCreateFileOrDir}
                              />
                            ),
                          },
                          {
                            label: "Delete",
                            icon: <Trash2 className="w-4 h-4 text-red-400" />,
                            content: (
                              <DeleteFolderDialog
                                folderName={row.getValue("name")}
                                type={row.original.type}
                                onDelete={() =>
                                  handleContextClickAction("delete", row.original)
                                }
                              />
                            ),
                            separator: true,
                          },
                          {
                            label: "New File",
                            icon: <FilePlus2 className="w-4 h-4" />,
                            content: (
                              <NewFolderDialog
                                type="file"
                                data={row.original}
                                onClick={handleCreateFileOrDir}
                              />
                            ),
                          },
                          {
                            label: "New Folder",
                            icon: <FolderPlus className="w-4 h-4" />,
                            content: (
                              <NewFolderDialog
                                type="folder"
                                data={row.original}
                                onClick={handleCreateFileOrDir}
                              />
                            ),
                            separator: true,
                          },
                          {
                            label: "Download",
                            icon: <Download className="w-4 h-4" />,
                            action: () =>
                              handleContextClickAction("download", row.original),
                            separator: true,
                          },
                          {
                            label: "Properties",
                            icon: <Info className="w-4 h-4" />,
                            action: () =>
                              handleContextClickAction(
                                "properties",
                                row.original,
                              ),
                            content: <StatsInfoCard data={stats} />,
                          },
                          {
                            label: "Check Permissions",
                            icon: <ShieldCheck className="w-4 h-4" />,
                            content: <FilePermissions data={row.original} />,
                          },
                        ]}
                      ></ContextModal>
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
    );
  }
