/**
 * @module editor/plugins/builtin/word-count
 *
 * Displays word count, character count, and line count statistics.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

function getStats(content: string) {
    const lines = content.split("\n").length;
    const chars = content.length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim()).length;
    return { lines, chars, words, paragraphs };
}

export function createWordCountPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "word-count",
        name: "Word Count",
        version: "1.0.0",
        description: "Shows word, character, and line count for the current file",
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
            api.clearInlineAnnotations("word-count");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const stats = getStats(content);
    const lineCount = api.getLineCount();

    const annotation: InlineAnnotation = {
        id: "word-count:status",
        line: lineCount,
        text: `  ${stats.words} words | ${stats.chars} chars | ${stats.lines} lines`,
        className: "editor-word-count",
        style: { opacity: 0.4, fontStyle: "italic", fontSize: "11px" },
    };

    api.setInlineAnnotations([annotation]);
}
