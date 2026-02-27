/**
 * @module components/VsixDropZone
 *
 * Drag-and-drop overlay to install .vsix extension files.
 * Drop a .vsix file anywhere on the editor to install it.
 */
import React, { useState, useCallback, useRef } from "react";
import type * as monacoNs from "monaco-editor";
import { Upload, Loader2, CheckCircle2, XCircle, Package } from "lucide-react";
import { installExtensionFromVSIX, type InstallProgress } from "../lib/extensionLoader";

type Monaco = typeof monacoNs;

export interface VsixDropZoneProps {
  monaco: Monaco | null;
  editor: monacoNs.editor.IStandaloneCodeEditor | null;
  /** Called after a vsix is successfully installed */
  onInstalled?: (extensionId: string) => void;
  children: React.ReactNode;
}

type DropState = "idle" | "hovering" | "installing" | "success" | "error";

export const VsixDropZone: React.FC<VsixDropZoneProps> = ({
  monaco,
  editor,
  onInstalled,
  children,
}) => {
  const [state, setState] = useState<DropState>("idle");
  const [message, setMessage] = useState("");
  const dragCounter = useRef(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout>>();

  const isVsix = (file: File) =>
    file.name.endsWith(".vsix") || file.type === "application/vsix";

  const handleInstall = useCallback(
    async (file: File) => {
      if (!monaco) {
        setMessage("Monaco not loaded yet");
        setState("error");
        return;
      }

      setState("installing");
      setMessage(`Installing ${file.name}…`);

      const onProgress: InstallProgress = (stage, detail) => {
        switch (stage) {
          case "extracting":
            setMessage(`Extracting ${detail ?? file.name}…`);
            break;
          case "storing":
            setMessage("Saving to storage…");
            break;
          case "loading":
            setMessage("Loading into editor…");
            break;
          case "done":
            setState("success");
            setMessage(`Installed successfully!`);
            onInstalled?.(detail ?? "");
            break;
          case "error":
            setState("error");
            setMessage(detail ?? "Installation failed");
            break;
        }
      };

      try {
        await installExtensionFromVSIX(file, monaco, editor ?? undefined, onProgress);
      } catch (err) {
        setState("error");
        setMessage((err as Error).message);
      }

      // Auto-clear status after 3s
      clearTimer.current = setTimeout(() => {
        setState("idle");
        setMessage("");
      }, 3000);
    },
    [monaco, editor, onInstalled],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setState("hovering");
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setState((s) => (s === "hovering" ? "idle" : s));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer.files);
      const vsixFile = files.find(isVsix);

      if (vsixFile) {
        handleInstall(vsixFile);
      } else {
        setState("error");
        setMessage("Please drop a .vsix file");
        clearTimer.current = setTimeout(() => {
          setState("idle");
          setMessage("");
        }, 2000);
      }
    },
    [handleInstall],
  );

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ width: "100%", height: "100%" }}
      id="vsix-dropzone"
    >
      {children}

      {/* Drop overlay */}
      {state === "hovering" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-blue-400/60 bg-[#1e1e2e]/80">
            <Upload className="w-10 h-10 text-blue-400 animate-bounce" />
            <span className="text-sm text-gray-300 font-medium">
              Drop .vsix file to install extension
            </span>
          </div>
        </div>
      )}

      {/* Status toast */}
      {state !== "idle" && state !== "hovering" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-[12px] font-medium ${
              state === "installing"
                ? "bg-blue-900/90 text-blue-200 border border-blue-700/50"
                : state === "success"
                  ? "bg-green-900/90 text-green-200 border border-green-700/50"
                  : "bg-red-900/90 text-red-200 border border-red-700/50"
            }`}
          >
            {state === "installing" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {state === "success" && <CheckCircle2 className="w-3.5 h-3.5" />}
            {state === "error" && <XCircle className="w-3.5 h-3.5" />}
            <span>{message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

VsixDropZone.displayName = "VsixDropZone";
