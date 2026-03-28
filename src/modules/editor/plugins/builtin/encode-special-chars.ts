/**
 * @module editor/plugins/builtin/encode-special-chars
 *
 * Encode/decode HTML entities and special characters.
 */
import type { ExtendedEditorPlugin } from "../types";

const HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;",
};

const HTML_DECODE_MAP: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
    "&copy;": "©", "&reg;": "®", "&trade;": "™",
};

function encodeHTMLEntities(text: string): string {
    return text.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] || ch);
}

function decodeHTMLEntities(text: string): string {
    let result = text;
    for (const [entity, char] of Object.entries(HTML_DECODE_MAP)) {
        result = result.replaceAll(entity, char);
    }
    // Numeric entities
    result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
    result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
    return result;
}

export function createEncodeSpecialCharsPlugin(): ExtendedEditorPlugin {
    return {
        id: "encode-special-chars",
        name: "Encode Special Characters",
        version: "1.0.0",
        description: "Encode/decode HTML entities and special characters",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("encode.htmlEntities", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                api.replaceSelection(encodeHTMLEntities(text));
            });

            api.registerCommand("decode.htmlEntities", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                api.replaceSelection(decodeHTMLEntities(text));
            });
        },
    };
}
