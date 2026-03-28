/**
 * @module editor/plugins/builtin/hash-generator
 *
 * Generate hashes (SHA-256, SHA-1, MD5*) of selected text.
 * *MD5 is a simplified version for display purposes only.
 */
import type { ExtendedEditorPlugin } from "../types";

async function sha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

async function sha1(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export function createHashGeneratorPlugin(): ExtendedEditorPlugin {
    return {
        id: "hash-generator",
        name: "Hash Generator",
        version: "1.0.0",
        description: "Generate SHA-256 and SHA-1 hashes of selected text",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("hash.sha256", async () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const hash = await sha256(text);
                api.showToast("SHA-256", hash, "default");
            });

            api.registerCommand("hash.sha1", async () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const hash = await sha1(text);
                api.showToast("SHA-1", hash, "default");
            });

            api.registerCommand("hash.sha256.replace", async () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const hash = await sha256(text);
                api.replaceSelection(hash);
            });
        },
    };
}
