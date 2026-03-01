/**
 * @module pages/sftp/components/MediaPreviewPage
 *
 * Full-page preview for remote images, videos, audio, and text/document files.
 * Opens in a new browser tab via:
 *   /ssh/sftp/preview?path=/remote/path&tabId=xxx
 *
 * Uses the download API to stream the file content from the server,
 * then creates an object URL for the browser to render natively.
 * For text-based files (html, md, txt, etc.), fetches via the file-read API
 * and renders inline with syntax highlighting or rendered HTML/Markdown.
 */
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ApiCore } from "@/lib/api";
import Prism from "prismjs";
import { loadLanguageForFile } from "@/lib/loadPrismLanguage";
import './prism-vscode-dark.css';

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

/** Extensions we treat as text/document (fetched as text, rendered inline) */
const TEXT_EXTS = new Set([
    "html", "htm", "md", "markdown", "txt", "text", "log",
    "json", "xml", "csv", "yaml", "yml", "toml", "ini", "cfg", "conf",
    "sh", "bash", "zsh", "fish",
    "js", "ts", "jsx", "tsx", "css", "scss", "less",
    "py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp",
    "sql", "graphql", "gql",
    "env", "gitignore", "dockerignore", "editorconfig",
]);

/** PDF uses its own renderer */
const PDF_EXTS = new Set(["pdf"]);

type MediaType = "image" | "video" | "audio" | "text" | "pdf" | "unknown";

function detectMediaType(fileName: string): MediaType {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (IMAGE_EXTS.has(ext)) return "image";
    if (VIDEO_EXTS.has(ext)) return "video";
    if (AUDIO_EXTS.has(ext)) return "audio";
    if (TEXT_EXTS.has(ext)) return "text";
    if (PDF_EXTS.has(ext)) return "pdf";
    // Files without an extension are often text (e.g. Makefile, Dockerfile)
    if (!ext && fileName.length > 0) return "text";
    return "unknown";
}

/** Subset of text files that should render as HTML */
function isHtml(fileName: string): boolean {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    return ext === "html" || ext === "htm";
}

/** Subset of text files that should render as Markdown */
function isMarkdown(fileName: string): boolean {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    return ext === "md" || ext === "markdown";
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
    /** Raw text content for text/md/html previews */
    const [textContent, setTextContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** For markdown/html: toggle between rendered and source view */
    const [showSource, setShowSource] = useState(false);
    /** Prism-highlighted HTML for source / plain-text view */
    const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

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
                if (mediaType === "text") {
                    // Fetch as text via the file-read API
                    const data = await ApiCore.fetchFileContent(tabId, remotePath);
                    if (cancelled) return;
                    if (!data.status) throw new Error(data.message || "Failed to read file");
                    setTextContent(data.result);
                } else {
                    // Fetch as binary blob for media/pdf
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
                }
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

    // ── Load Prism grammar and highlight text content ─────────
    useEffect(() => {
        if (!textContent || mediaType !== "text") return;
        let cancelled = false;
        (async () => {
            const { grammar, langId } = await loadLanguageForFile(fileName);
            if (cancelled) return;
            if (grammar) {
                setHighlightedHtml(Prism.highlight(textContent, grammar, langId));
            } else {
                // Fallback: escape HTML for safe rendering
                setHighlightedHtml(
                    textContent
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                );
            }
        })();
        return () => { cancelled = true; };
    }, [textContent, fileName, mediaType]);

    /** Highlight a code block string with Prism (synchronous, grammar already loaded) */
    const highlightCodeBlock = useCallback((code: string, lang: string): string => {
        const grammar = Prism.languages[lang];
        if (grammar) {
            return Prism.highlight(code, grammar, lang);
        }
        return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }, []);

    // ── Simple Markdown → HTML converter (no external dependency) ───
    const renderedMarkdown = useMemo(() => {
        if (!textContent || !isMarkdown(fileName)) return "";
        let html = textContent;
        // Headers
        html = html.replace(/^######\s+(.+)$/gm, '<h6 class="text-sm font-semibold mt-4 mb-1 text-gray-300">$1</h6>');
        html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="text-sm font-bold mt-4 mb-1 text-gray-200">$1</h5>');
        html = html.replace(/^####\s+(.+)$/gm, '<h4 class="text-base font-bold mt-5 mb-2 text-gray-200">$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-bold mt-5 mb-2 text-gray-100">$1</h3>');
        html = html.replace(/^##\s+(.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-2 text-white">$1</h2>');
        html = html.replace(/^#\s+(.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3 text-white">$1</h1>');
        // Bold & italic
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-gray-800 text-blue-400 text-[13px] font-mono">$1</code>');
        // Code blocks (with Prism highlighting)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match: string, lang: string, code: string) => {
            const trimmed = code.replace(/\n$/, "");
            const highlighted = lang
                ? highlightCodeBlock(trimmed, lang)
                : trimmed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<pre class="bg-[#1a1a2e] rounded-lg p-4 my-3 overflow-x-auto"><code class="text-[13px] font-mono language-${lang || "plaintext"}">${highlighted}</code></pre>`;
        });
        // Blockquotes
        html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-blue-500/40 pl-4 my-2 text-gray-400 italic">$1</blockquote>');
        // Horizontal rules
        html = html.replace(/^---+$/gm, '<hr class="border-gray-700 my-4" />');
        // Unordered lists
        html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li class="ml-4 list-disc text-gray-300">$1</li>');
        // Ordered lists
        html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal text-gray-300">$1</li>');
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-blue-400 underline hover:text-blue-300">$1</a>');
        // Images in markdown
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded my-2" />');
        // Line breaks (double newline → paragraph)
        html = html.replace(/\n\n/g, '</p><p class="my-2 text-gray-300 leading-relaxed">');
        html = '<p class="my-2 text-gray-300 leading-relaxed">' + html + '</p>';
        return html;
    }, [textContent, fileName, highlightCodeBlock]);

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
                    {/* Toggle rendered/source for html and md */}
                    {mediaType === "text" && (isHtml(fileName) || isMarkdown(fileName)) && (
                        <button
                            onClick={() => setShowSource((v) => !v)}
                            className={`px-3 py-1 rounded text-xs border-none cursor-pointer transition-colors ${
                                showSource
                                    ? "bg-blue-600 text-white hover:bg-blue-500"
                                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                            }`}
                        >
                            {showSource ? "Rendered" : "Source"}
                        </button>
                    )}
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

            {/* Content area */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-4 min-h-0">
                {/* ── Image ── */}
                {mediaType === "image" && objectUrl && (
                    <img
                        src={objectUrl}
                        alt={fileName}
                        className="max-w-full max-h-full object-contain rounded shadow-lg"
                        style={{ background: "repeating-conic-gradient(#222 0% 25%, #1a1a1a 0% 50%) 50% / 20px 20px" }}
                    />
                )}

                {/* ── Video ── */}
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

                {/* ── Audio ── */}
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

                {/* ── Text / HTML / Markdown ── */}
                {mediaType === "text" && textContent !== null && (
                    <>
                        {/* HTML rendered view */}
                        {isHtml(fileName) && !showSource && (
                            <iframe
                                srcDoc={textContent}
                                sandbox="allow-same-origin"
                                title="HTML Preview"
                                className="w-full h-full bg-white rounded shadow-lg border border-gray-700"
                            />
                        )}

                        {/* Markdown rendered view */}
                        {isMarkdown(fileName) && !showSource && (
                            <div
                                className="w-full max-w-3xl mx-auto p-6 overflow-auto prose-invert"
                                dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
                            />
                        )}

                        {/* Source view or plain text/log/json/etc — Prism highlighted */}
                        {(showSource || (!isHtml(fileName) && !isMarkdown(fileName))) && (
                            <pre className="w-full h-full overflow-auto bg-[#111] rounded-lg border border-gray-800 p-4 m-0">
                                {highlightedHtml ? (
                                    <code
                                        className="text-[13px] font-mono leading-relaxed whitespace-pre"
                                        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                                    />
                                ) : (
                                    <code className="text-[13px] font-mono text-gray-300 leading-relaxed whitespace-pre">
                                        {textContent}
                                    </code>
                                )}
                            </pre>
                        )}
                    </>
                )}

                {/* ── PDF ── */}
                {mediaType === "pdf" && objectUrl && (
                    <iframe
                        src={objectUrl}
                        title="PDF Preview"
                        className="w-full h-full rounded shadow-lg border border-gray-700"
                    />
                )}

                {/* ── Unknown ── */}
                {mediaType === "unknown" && (
                    <div className="flex flex-col items-center gap-4 text-gray-500">
                        <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-sm">No preview available for this file type</span>
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
