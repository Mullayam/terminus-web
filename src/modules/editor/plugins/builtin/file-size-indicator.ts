/**
 * @module editor/plugins/builtin/file-size-indicator
 *
 * Shows file size in the status area (bytes, KB, MB).
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function createFileSizeIndicatorPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "file-size-indicator",
        name: "File Size Indicator",
        version: "1.0.0",
        description: "Displays the current file size",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 300);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineAnnotations("file-size-indicator");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const bytes = new Blob([content]).size;
    const lineCount = api.getLineCount();

    const annotation: InlineAnnotation = {
        id: "file-size-indicator:size",
        line: lineCount,
        text: `  📄 ${formatSize(bytes)}`,
        style: { opacity: 0.4, fontSize: "10px" },
    };

    api.setInlineAnnotations([annotation]);
}
