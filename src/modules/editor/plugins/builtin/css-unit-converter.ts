/**
 * @module editor/plugins/builtin/css-unit-converter
 *
 * Convert between CSS units (px ↔ rem ↔ em).
 */
import type { ExtendedEditorPlugin } from "../types";

const BASE_FONT_SIZE = 16; // 1rem = 16px

function pxToRem(px: number): string {
    return (px / BASE_FONT_SIZE).toFixed(4).replace(/\.?0+$/, "") + "rem";
}

function remToPx(rem: number): string {
    return (rem * BASE_FONT_SIZE).toFixed(1).replace(/\.0$/, "") + "px";
}

function convertUnits(content: string, from: string, to: string): string {
    if (from === "px" && to === "rem") {
        return content.replace(/(\d+(?:\.\d+)?)px/g, (_, num) => pxToRem(parseFloat(num)));
    }
    if (from === "rem" && to === "px") {
        return content.replace(/(\d+(?:\.\d+)?)rem/g, (_, num) => remToPx(parseFloat(num)));
    }
    return content;
}

export function createCssUnitConverterPlugin(): ExtendedEditorPlugin {
    return {
        id: "css-unit-converter",
        name: "CSS Unit Converter",
        version: "1.0.0",
        description: "Convert between px and rem CSS units",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("css.pxToRem", () => {
                const sel = api.getSelection();
                if (sel && sel.start !== sel.end) {
                    const text = api.getContent().slice(sel.start, sel.end);
                    api.replaceSelection(convertUnits(text, "px", "rem"));
                } else {
                    const content = api.getContent();
                    api.setContent(convertUnits(content, "px", "rem"));
                }
            });

            api.registerCommand("css.remToPx", () => {
                const sel = api.getSelection();
                if (sel && sel.start !== sel.end) {
                    const text = api.getContent().slice(sel.start, sel.end);
                    api.replaceSelection(convertUnits(text, "rem", "px"));
                } else {
                    const content = api.getContent();
                    api.setContent(convertUnits(content, "rem", "px"));
                }
            });
        },
    };
}
