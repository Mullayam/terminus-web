/**
 * @module editor/plugins/builtin/base64-encode-decode
 *
 * Encode/decode selected text as Base64.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createBase64Plugin(): ExtendedEditorPlugin {
    return {
        id: "base64-encode-decode",
        name: "Base64 Encode/Decode",
        version: "1.0.0",
        description: "Encode or decode selected text as Base64",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("base64.encode", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                try {
                    api.replaceSelection(btoa(unescape(encodeURIComponent(text))));
                } catch {
                    api.showToast("Base64", "Failed to encode", "destructive");
                }
            });

            api.registerCommand("base64.decode", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                try {
                    api.replaceSelection(decodeURIComponent(escape(atob(text))));
                } catch {
                    api.showToast("Base64", "Failed to decode — invalid Base64", "destructive");
                }
            });

            api.addContextMenuItem({
                label: "Base64 Encode",
                action: () => api.executeCommand("base64.encode"),
                priority: 60,
            });

            api.addContextMenuItem({
                label: "Base64 Decode",
                action: () => api.executeCommand("base64.decode"),
                priority: 61,
            });
        },
    };
}
