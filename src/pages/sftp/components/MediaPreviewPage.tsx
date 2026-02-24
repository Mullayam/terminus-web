/**
 * @module pages/sftp/components/MediaPreviewPage
 *
 * Full-page preview for remote images and videos.
 * Opens in a new browser tab via:
 *   /ssh/sftp/preview?path=/remote/path&tabId=xxx
 *
 * Uses the download API to stream the file content from the server,
 * then creates an object URL for the browser to render natively.
 */
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ApiCore } from "@/lib/api";

/** Extensions we treat as images */
const IMAGE_EXTS = new Set([
    "png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "ico", "avif", "tiff", "tif",
]);

/** Extensions we treat as videos */
const VIDEO_EXTS = new Set([
    "mp4", "webm", "ogg", "ogv", "mov", "avi", "mkv",
]);

/** Extensions we treat as audio */
const AUDIO_EXTS = new Set([
    "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma",
]);

type MediaType = "image" | "video" | "audio" | "unknown";

function detectMediaType(fileName: string): MediaType {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (IMAGE_EXTS.has(ext)) return "image";
    if (VIDEO_EXTS.has(ext)) return "video";
    if (AUDIO_EXTS.has(ext)) return "audio";
    return "unknown";
}

export function isPreviewable(fileName: string): boolean {
    return detectMediaType(fileName) !== "unknown";
}

export default function MediaPreviewPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const remotePath = params.get("path") ?? "";
    const tabId = params.get("tabId") ?? "";

    const fileName = remotePath.split("/").pop() ?? "file";
    const mediaType = detectMediaType(fileName);

    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Keep track so we revoke on unmount
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!remotePath || !tabId) {
            setError("Missing path or tabId parameter");
            setLoading(false);
            return;
        }
        if (mediaType === "unknown") {
            setError(`Unsupported file type: ${fileName}`);
            setLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const response = await ApiCore.download({
                    remotePath,
                    type: "file",
                    name: fileName,
                });

                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }

                const blob = await response.blob();
                if (cancelled) return;

                const url = URL.createObjectURL(blob);
                urlRef.current = url;
                setObjectUrl(url);
            } catch (err) {
                if (!cancelled) {
                    setError((err as Error).message ?? "Failed to load file");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
        };
    }, [remotePath, tabId, fileName, mediaType]);

    // ── Missing params ───────────────────────────────────────
    if (!remotePath || !tabId) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-white">
                <div className="text-center space-y-3">
                    <h2 className="text-lg font-semibold">Missing Parameters</h2>
                    <p className="text-sm text-gray-400">
                        Both <code className="px-1 py-0.5 rounded bg-gray-800">path</code> and{" "}
                        <code className="px-1 py-0.5 rounded bg-gray-800">tabId</code> URL parameters are required.
                    </p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-1.5 rounded text-sm bg-gray-700 text-white border-none cursor-pointer hover:bg-gray-600 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // ── Loading ──────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-400">Loading preview…</span>
                    <span className="text-xs text-gray-600 font-mono max-w-md truncate">{remotePath}</span>
                </div>
            </div>
        );
    }

    // ── Error ────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-white">
                <div className="text-center space-y-3 max-w-md">
                    <h2 className="text-lg font-semibold text-red-400">Preview Error</h2>
                    <p className="text-sm text-gray-400">{error}</p>
                    <div className="flex gap-2 justify-center">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-4 py-1.5 rounded text-sm bg-gray-700 text-white border-none cursor-pointer hover:bg-gray-600 transition-colors"
                        >
                            Go Back
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-1.5 rounded text-sm bg-blue-600 text-white border-none cursor-pointer hover:bg-blue-500 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Preview content ──────────────────────────────────────
    return (
        <div className="flex flex-col h-screen bg-[#0a0a0a] text-white">
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-3 py-1 rounded text-xs bg-gray-800 text-gray-300 border-none cursor-pointer hover:bg-gray-700 transition-colors shrink-0"
                    >
                        ← Back
                    </button>
                    <span className="text-sm font-medium truncate">{fileName}</span>
                    <span className="text-xs text-gray-500 uppercase shrink-0">{mediaType}</span>
                </div>
                <div className="flex items-center gap-2">
                    {objectUrl && (
                        <a
                            href={objectUrl}
                            download={fileName}
                            className="px-3 py-1 rounded text-xs bg-gray-800 text-gray-300 no-underline hover:bg-gray-700 transition-colors"
                        >
                            Download
                        </a>
                    )}
                </div>
            </div>

            {/* Media area */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-4 min-h-0">
                {mediaType === "image" && objectUrl && (
                    <img
                        src={objectUrl}
                        alt={fileName}
                        className="max-w-full max-h-full object-contain rounded shadow-lg"
                        style={{ background: "repeating-conic-gradient(#222 0% 25%, #1a1a1a 0% 50%) 50% / 20px 20px" }}
                    />
                )}

                {mediaType === "video" && objectUrl && (
                    <video
                        src={objectUrl}
                        controls
                        autoPlay
                        className="max-w-full max-h-full rounded shadow-lg"
                        style={{ outline: "none" }}
                    >
                        Your browser does not support this video format.
                    </video>
                )}

                {mediaType === "audio" && objectUrl && (
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center">
                            <svg className="w-16 h-16 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                            </svg>
                        </div>
                        <span className="text-sm text-gray-400 font-mono">{fileName}</span>
                        <audio src={objectUrl} controls autoPlay className="w-full max-w-md" />
                    </div>
                )}
            </div>

            {/* Footer info */}
            <div className="px-4 py-1.5 bg-[#111] border-t border-gray-800 text-xs text-gray-500 shrink-0">
                <span className="font-mono truncate">{remotePath}</span>
            </div>
        </div>
    );
}
