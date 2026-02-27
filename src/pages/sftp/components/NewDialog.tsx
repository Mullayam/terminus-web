import { useForm } from 'react-hook-form';
import { SFTP_FILES_LIST } from './interface';
import { FileOperations } from './FileList';
import { useContextModalClose } from '@/components/ui/context-modal';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Folder, Home, FolderOpen } from 'lucide-react';

interface NewFolderFormData {
  folderName: string;
}

/* ── PathPicker ────────────────────────────────────────────────
 * Shows quick-pick directory suggestions based on:
 *   • currentDir  – the directory the user is currently browsing
 *   • homeDir     – the SFTP home / login directory
 *
 * Clicking a directory segment fills the destination input with
 * <selectedDir>/<originalFileName>.
 * ──────────────────────────────────────────────────────────── */
function PathPicker({
  fileName,
  currentDir,
  homeDir,
  onChange,
}: {
  /** Name of the file/folder being moved/copied */
  fileName: string;
  /** Directory the user is currently browsing */
  currentDir: string;
  /** SFTP home directory */
  homeDir: string;
  onChange: (destPath: string) => void;
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  /** Build clickable directory segments from an absolute path */
  const buildSegments = (dirPath: string) => {
    const parts = dirPath.split('/').filter(Boolean);
    return parts.map((seg, i) => ({
      name: seg,
      path: '/' + parts.slice(0, i + 1).join('/'),
    }));
  };

  const currentSegments = useMemo(() => buildSegments(currentDir), [currentDir]);
  const homeSegments = useMemo(() => buildSegments(homeDir), [homeDir]);

  // Avoid showing homeDir twice if it equals currentDir
  const showHomeSuggestion = homeDir && homeDir !== currentDir;

  // Unique parent dirs from currentDir (walk up towards homeDir)
  const parentSuggestions = useMemo(() => {
    const parents: { name: string; path: string }[] = [];
    let dir = currentDir;
    while (dir && dir !== '/') {
      const parentIdx = dir.lastIndexOf('/');
      if (parentIdx <= 0) break;
      dir = dir.substring(0, parentIdx) || '/';
      if (homeDir && !dir.startsWith(homeDir) && dir !== '/') break;
      if (dir === currentDir || dir === homeDir) continue;
      parents.push({ name: dir.split('/').filter(Boolean).pop() || '/', path: dir });
    }
    return parents.slice(0, 3);
  }, [currentDir, homeDir]);

  const handleSelect = (dirPath: string) => {
    setSelectedPath(dirPath);
    const cleanDir = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
    onChange(`${cleanDir}/${fileName}`);
  };

  return (
    <div className="space-y-3">
      <label className="text-xs text-gray-400 font-medium">Quick pick destination</label>

      {/* Current directory */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wider">
          <FolderOpen className="w-3 h-3" /> Current directory
        </div>
        <div className="flex flex-wrap items-center gap-1 p-2 bg-[#13141a] rounded-lg border border-[#2a2d37]">
          <button
            type="button"
            onClick={() => handleSelect('/')}
            className={cn(
              "px-1.5 py-0.5 rounded text-sm transition-colors",
              selectedPath === '/'
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            /
          </button>
          {currentSegments.map((seg, idx) => (
            <button
              key={seg.path}
              type="button"
              onClick={() => handleSelect(seg.path)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors",
                selectedPath === seg.path
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-[#1e1f2b] text-gray-300 hover:bg-[#2a2d37] border border-transparent"
              )}
            >
              <Folder className="w-3 h-3" />
              {seg.name}
              {idx < currentSegments.length - 1 && (
                <ChevronRight className="w-3 h-3 text-gray-600 ml-0.5" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Home directory (if different from current) */}
      {showHomeSuggestion && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wider">
            <Home className="w-3 h-3" /> Home directory
          </div>
          <div className="flex flex-wrap items-center gap-1 p-2 bg-[#13141a] rounded-lg border border-[#2a2d37]">
            <button
              type="button"
              onClick={() => handleSelect('/')}
              className={cn(
                "px-1.5 py-0.5 rounded text-sm transition-colors",
                selectedPath === '/'
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              /
            </button>
            {homeSegments.map((seg, idx) => (
              <button
                key={seg.path}
                type="button"
                onClick={() => handleSelect(seg.path)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors",
                  selectedPath === seg.path
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-[#1e1f2b] text-gray-300 hover:bg-[#2a2d37] border border-transparent"
                )}
              >
                <Folder className="w-3 h-3" />
                {seg.name}
                {idx < homeSegments.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-gray-600 ml-0.5" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Parent directory suggestions */}
      {parentSuggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase tracking-wider">
            <Folder className="w-3 h-3" /> Parent directories
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {parentSuggestions.map((p) => (
              <button
                key={p.path}
                type="button"
                onClick={() => handleSelect(p.path)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                  selectedPath === p.path
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-[#1e1f2b] text-gray-300 hover:bg-[#2a2d37] border border-transparent"
                )}
              >
                <Folder className="w-3 h-3" />
                {p.path}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected destination preview */}
      {selectedPath && (
        <div className="text-xs text-gray-400 truncate pt-1 border-t border-[#2a2d37]">
          Destination: <span className="text-emerald-400 font-mono">{selectedPath}/{fileName}</span>
        </div>
      )}
    </div>
  );
}

interface NewFolderDialogProps {
  data: SFTP_FILES_LIST;
  type: FileOperations;
  onClick: (fullPath: string, type: FileOperations, newPath?: string) => void;
  /** Current browsing directory (used for PathPicker suggestions) */
  currentDir?: string;
  /** SFTP home directory (used for PathPicker suggestions) */
  homeDir?: string;
}

export function NewFolderDialog({ data, type, onClick, currentDir = '', homeDir = '' }: NewFolderDialogProps) {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<NewFolderFormData>();
  const closeModal = useContextModalClose();
  const { toast } = useToast();
  const isMoveCopy = type === "move" || type === "copy";

  const onSubmit = (input: NewFolderFormData) => {
    if (type === "rename") {
      onClick(data.name, type, input.folderName)
    } else if (type === "file") {
      onClick(input.folderName, type)
    } else if (type === "folder") {
      onClick(input.folderName, type)
    } else if (type === "move") {
      onClick(data.name, type, input.folderName)
    } else if (type === "copy") {
      onClick(data.name, type, input.folderName)
    }

    const descriptions: Record<string, string> = {
      rename: `Renamed "${data.name}" to "${input.folderName}"`,
      move: `Moved "${data.name}" to "${input.folderName}"`,
      copy: `Copied "${data.name}" to "${input.folderName}"`,
      file: `File "${input.folderName}" created`,
      folder: `Folder "${input.folderName}" created`,
    };

    toast({
      title: "Success",
      description: descriptions[type] || "Operation completed",
      duration: 2000,
    });

    closeModal?.();
  };

  const titleMap: Record<string, string> = {
    rename: "Rename",
    move: "Move to",
    copy: "Copy to",
    file: "New File",
    folder: "New Folder",
  };

  const placeholderMap: Record<string, string> = {
    rename: "New name",
    move: "Destination path (or pick below)",
    copy: "Destination path (or pick below)",
    file: "File name",
    folder: "Folder name",
  };

  return (
    <div className="p-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl text-white font-medium">{titleMap[type] || type}</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <div className="relative">
                {(type === "rename" || isMoveCopy) &&
                  (
                    <div className='my-2'>
                      <input
                        type="text"
                        className="w-full bg-[#13141a] text-white border border-[#2a2d37] focus:border-emerald-500 rounded-lg px-4 py-2.5 outline-none transition-colors"
                        value={data.name}
                        disabled
                      />
                    </div>)}

                <input
                  type="text"
                  {...register('folderName', { required: true })}
                  className="w-full bg-[#13141a] text-white border border-[#2a2d37] focus:border-emerald-500 rounded-lg px-4 py-2.5 outline-none transition-colors"
                  placeholder={placeholderMap[type] || type}
                  autoFocus
                />
                {errors.folderName && (
                  <div className="absolute -bottom-5 left-0 text-xs text-red-400">
                    This field is required
                  </div>
                )}
              </div>
            </div>

            {/* Path picker for move/copy – uses actual directory paths */}
            {isMoveCopy && (currentDir || homeDir) && (
              <PathPicker
                fileName={data.name}
                currentDir={currentDir}
                homeDir={homeDir}
                onChange={(destPath) => setValue('folderName', destPath)}
              />
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="bg-[#383b47] hover:bg-[#4a4d5d] text-white px-5 py-2 rounded-lg font-medium transition-colors"
              >
                Confirm
              </button>
            </div>
          </form>
    </div>
  );
}
