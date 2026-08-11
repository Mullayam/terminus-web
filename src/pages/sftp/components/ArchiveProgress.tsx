/**
 * @module pages/sftp/components/ArchiveProgress
 *
 * Self-contained progress stack driven by the backend's `@@SFTP_ARCHIVE_PROGRESS`
 * lifecycle event (status: running | completed | error). Owns its own socket
 * subscription and local state so it never re-renders the file table.
 *
 * `percent` is byte-accurate, so this renders a determinate bar while running and
 * drops the entry on completed/error — the final toast comes from the global
 * @@SUCCESS / @@SFTP_EMIT_ERROR handlers.
 */
import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { FileArchive, Loader2, PackageOpen } from "lucide-react";
import { SocketEventConstants } from "@/lib/sockets/event-constants";

interface ArchiveProgressEvent {
  op: "compress" | "extract";
  name: string;
  percent: number;
  status: "running" | "completed" | "error";
}

interface ActiveArchiveOp {
  key: string;
  op: "compress" | "extract";
  name: string;
  /** Last reported percent — shown only when it's a meaningful mid-value. */
  percent: number;
}

export function ArchiveProgress({ socket }: { socket: Socket | undefined }) {
  const [ops, setOps] = useState<Record<string, ActiveArchiveOp>>({});

  useEffect(() => {
    if (!socket) return;
    const onProgress = (data: ArchiveProgressEvent) => {
      if (!data?.name || !data.op) return;
      const key = `${data.op}:${data.name}`;
      setOps((prev) => {
        if (data.status === "running") {
          const percent = Number(data.percent);
          return {
            ...prev,
            [key]: { key, op: data.op, name: data.name, percent: Number.isFinite(percent) ? percent : 0 },
          };
        }
        // completed or error → drop the entry
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };
    socket.on(SocketEventConstants.SFTP_ARCHIVE_PROGRESS, onProgress);
    return () => {
      socket.off(SocketEventConstants.SFTP_ARCHIVE_PROGRESS, onProgress);
    };
  }, [socket]);

  const list = Object.values(ops);
  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[1001] flex flex-col items-center gap-2">
      {list.map((op) => {
        const pct = Math.min(100, Math.max(0, op.percent));
        return (
          <div
            key={op.key}
            className="w-72 rounded-lg border border-white/10 bg-[#1a1b26]/95 backdrop-blur-sm p-3 shadow-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
              {op.op === "compress" ? (
                <FileArchive className="h-4 w-4 text-gray-300 shrink-0" />
              ) : (
                <PackageOpen className="h-4 w-4 text-gray-300 shrink-0" />
              )}
              <span className="text-sm text-gray-100 truncate flex-1" title={op.name}>
                {op.op === "compress" ? "Compressing" : "Extracting"} {op.name}
              </span>
              <span className="text-xs text-gray-400 shrink-0">{Math.round(pct)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
