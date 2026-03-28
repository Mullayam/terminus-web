/**
 * @module editor/plugins/builtin/number-converter
 *
 * Convert numbers between decimal, hex, octal, and binary.
 */
import type { ExtendedEditorPlugin } from "../types";

function parseNumber(text: string): number | null {
    const trimmed = text.trim();
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) return parseInt(trimmed, 16);
    if (trimmed.startsWith("0b") || trimmed.startsWith("0B")) return parseInt(trimmed.slice(2), 2);
    if (trimmed.startsWith("0o") || trimmed.startsWith("0O")) return parseInt(trimmed.slice(2), 8);
    const n = Number(trimmed);
    return isNaN(n) ? null : n;
}

export function createNumberConverterPlugin(): ExtendedEditorPlugin {
    return {
        id: "number-converter",
        name: "Number Converter",
        version: "1.0.0",
        description: "Convert numbers between decimal, hex, octal, and binary",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("number.toHex", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const num = parseNumber(text);
                if (num !== null) api.replaceSelection("0x" + num.toString(16).toUpperCase());
            });

            api.registerCommand("number.toDecimal", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const num = parseNumber(text);
                if (num !== null) api.replaceSelection(String(num));
            });

            api.registerCommand("number.toBinary", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const num = parseNumber(text);
                if (num !== null) api.replaceSelection("0b" + num.toString(2));
            });

            api.registerCommand("number.toOctal", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const num = parseNumber(text);
                if (num !== null) api.replaceSelection("0o" + num.toString(8));
            });

            api.registerCommand("number.showAll", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                const num = parseNumber(text);
                if (num !== null) {
                    api.showToast("Number", `Dec: ${num} | Hex: 0x${num.toString(16).toUpperCase()} | Bin: 0b${num.toString(2)} | Oct: 0o${num.toString(8)}`, "default");
                }
            });
        },
    };
}
