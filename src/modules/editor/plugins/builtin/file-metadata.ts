/**
 * @module editor/plugins/builtin/file-metadata
 *
 * File metadata plugin.
 * Displays file size, last modified timestamp, encoding info,
 * and other file metadata in the status bar area.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function detectEncoding(content: string): string {
    // Simple heuristic – check for BOM or non-ASCII characters
    if (content.charCodeAt(0) === 0xFEFF) return "UTF-8 with BOM";
    const hasNonAscii = /[^\x00-\x7F]/.test(content);
    return hasNonAscii ? "UTF-8" : "ASCII";
}

function detectLineEnding(content: string): string {
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
    if (crlfCount > 0 && lfCount === 0) return "CRLF";
    if (crlfCount === 0) return "LF";
    return "Mixed (LF/CRLF)";
}

function getContentStats(content: string) {
    const lines = content.split("\n");
    const bytes = new Blob([content]).size;
    const words = content.split(/\s+/).filter(Boolean).length;
    const blankLines = lines.filter((l) => l.trim() === "").length;
    const maxLineLength = Math.max(...lines.map((l) => l.length));
    const encoding = detectEncoding(content);
    const lineEnding = detectLineEnding(content);
    const hasTrailingNewline = content.endsWith("\n");

    return {
        bytes,
        fileSize: formatFileSize(bytes),
        lineCount: lines.length,
        wordCount: words,
        charCount: content.length,
        blankLines,
        maxLineLength,
        encoding,
        lineEnding,
        hasTrailingNewline,
    };
}

export function createFileMetadataPlugin(): ExtendedEditorPlugin {
    let lastAnnotationContent = "";

    return {
        id: "file-metadata",
        name: "File Metadata",
        version: "1.0.0",
        description: "Displays file size, encoding, line ending style, and content statistics",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            updateMetadata(api);

            api.registerCommand("fileMetadata.show", () => {
                const content = api.getContent();
                const stats = getContentStats(content);
                const { fileName, filePath } = api.getFileInfo();
                const info = [
                    `File: ${fileName}`,
                    `Path: ${filePath}`,
                    `Size: ${stats.fileSize} (${stats.bytes} bytes)`,
                    `Lines: ${stats.lineCount} (${stats.blankLines} blank)`,
                    `Words: ${stats.wordCount}`,
                    `Characters: ${stats.charCount}`,
                    `Max line length: ${stats.maxLineLength}`,
                    `Encoding: ${stats.encoding}`,
                    `Line endings: ${stats.lineEnding}`,
                    `Trailing newline: ${stats.hasTrailingNewline ? "Yes" : "No"}`,
                    `Last modified: ${new Date().toISOString()}`,
                ].join("\n");
                api.showToast("File Info", info, "default");
            });

            api.registerKeybinding({
                id: "file-metadata:show",
                label: "Show File Info",
                keys: "Ctrl+Shift+I",
                handler: () => api.executeCommand("file-metadata:fileMetadata.show"),
                when: "editor",
                category: "File",
            });
        },

        onContentChange(content, api) {
            // Debounced update
            if (content !== lastAnnotationContent) {
                lastAnnotationContent = content;
                updateMetadata(api);
            }
        },
    };
}

function updateMetadata(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const stats = getContentStats(content);
    const lastLine = stats.lineCount;

    // Add a subtle annotation at the end of the file showing metadata
    const annotations: InlineAnnotation[] = [
        {
            id: `file-metadata:eof`,
            line: lastLine,
            text: `  ${stats.fileSize} | ${stats.encoding} | ${stats.lineEnding}`,
            className: "editor-inline-annotation",
            style: { opacity: 0.35, fontStyle: "italic", fontSize: "11px" },
        },
    ];

    api.setInlineAnnotations(annotations);
}
