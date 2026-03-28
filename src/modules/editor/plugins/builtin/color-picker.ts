/**
 * @module editor/plugins/builtin/color-picker
 *
 * Provides an inline color picker for CSS color values.
 */
import type { ExtendedEditorPlugin } from "../types";

function hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : null;
}

function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function createColorPickerPlugin(): ExtendedEditorPlugin {
    return {
        id: "color-picker",
        name: "Color Picker",
        version: "1.0.0",
        description: "Color format conversion commands (hex ↔ rgb ↔ hsl)",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("color.hexToRgb", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end).trim();
                const rgb = hexToRgb(text);
                if (rgb) {
                    api.replaceSelection(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
                }
            });

            api.registerCommand("color.rgbToHex", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end).trim();
                const m = text.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (m) {
                    api.replaceSelection(rgbToHex(+m[1], +m[2], +m[3]));
                }
            });

            api.registerCommand("color.toHsl", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end).trim();

                let r: number, g: number, b: number;
                const hexMatch = hexToRgb(text);
                const rgbMatch = text.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);

                if (hexMatch) {
                    [r, g, b] = hexMatch;
                } else if (rgbMatch) {
                    [r, g, b] = [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]];
                } else return;

                const [h, s, l] = rgbToHsl(r, g, b);
                api.replaceSelection(`hsl(${h}, ${s}%, ${l}%)`);
            });
        },
    };
}
