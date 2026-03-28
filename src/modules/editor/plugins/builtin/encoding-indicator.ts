/**
 * @module editor/plugins/builtin/encoding-indicator
 *
 * Shows the file encoding and line ending type.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

function detectEncoding(content: string): string {
    // Basic BOM detection
    if (content.startsWith("\uFEFF")) return "UTF-8 with BOM";
    if (content.startsWith("\uFFFE")) return "UTF-16 LE";
    if (content.startsWith("\uFEFF")) return "UTF-16 BE";
    return "UTF-8";
}

function detectLineEnding(content: string): string {
    const crlf = (content.match(/\r\n/g) || []).length;
    const lf = (content.match(/(?<!\r)\n/g) || []).length;
    const cr = (content.match(/\r(?!\n)/g) || []).length;

    if (crlf > lf && crlf > cr) return "CRLF";
    if (cr > lf) return "CR";
    return "LF";
}

export function createEncodingIndicatorPlugin(): ExtendedEditorPlugin {
    return {
        id: "encoding-indicator",
        name: "Encoding Indicator",
        version: "1.0.0",
        description: "Shows file encoding and line ending type",
        category: "ui",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            update(api);
        },

        onDeactivate(api) {
            api.clearInlineAnnotations("encoding-indicator");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const encoding = detectEncoding(content);
    const lineEnding = detectLineEnding(content);
    const lineCount = api.getLineCount();

    const annotation: InlineAnnotation = {
        id: "encoding-indicator:info",
        line: Math.max(1, lineCount - 1),
        text: `  ${encoding} | ${lineEnding}`,
        style: { opacity: 0.35, fontSize: "10px" },
    };

    api.setInlineAnnotations([annotation]);
}
