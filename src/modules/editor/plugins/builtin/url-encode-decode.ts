/**
 * @module editor/plugins/builtin/url-encode-decode
 *
 * Encode/decode selected text as URL-encoded string.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createUrlEncodeDecodePlugin(): ExtendedEditorPlugin {
    return {
        id: "url-encode-decode",
        name: "URL Encode/Decode",
        version: "1.0.0",
        description: "URL-encode or URL-decode selected text",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("url.encode", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                api.replaceSelection(encodeURIComponent(text));
            });

            api.registerCommand("url.decode", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                try {
                    api.replaceSelection(decodeURIComponent(text));
                } catch {
                    api.showToast("URL Decode", "Failed to decode", "destructive");
                }
            });
        },
    };
}
