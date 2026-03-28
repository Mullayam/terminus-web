/**
 * @module editor/plugins/builtin/line-ending-converter
 *
 * Converts between LF, CRLF, and CR line endings.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createLineEndingConverterPlugin(): ExtendedEditorPlugin {
    return {
        id: "line-ending-converter",
        name: "Line Ending Converter",
        version: "1.0.0",
        description: "Convert between LF, CRLF, and CR line endings",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("lineEnding.toLF", () => {
                const content = api.getContent();
                api.setContent(content.replace(/\r\n|\r/g, "\n"));
                api.showToast("Line Endings", "Converted to LF", "default");
            });

            api.registerCommand("lineEnding.toCRLF", () => {
                const content = api.getContent();
                const normalized = content.replace(/\r\n|\r/g, "\n");
                api.setContent(normalized.replace(/\n/g, "\r\n"));
                api.showToast("Line Endings", "Converted to CRLF", "default");
            });

            api.registerCommand("lineEnding.toCR", () => {
                const content = api.getContent();
                api.setContent(content.replace(/\r\n|\r/g, "\n").replace(/\n/g, "\r"));
                api.showToast("Line Endings", "Converted to CR", "default");
            });
        },
    };
}
