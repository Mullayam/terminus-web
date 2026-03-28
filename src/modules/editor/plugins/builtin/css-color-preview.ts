/**
 * @module editor/plugins/builtin/css-color-preview
 *
 * Provides inline color swatches for CSS named colors.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

const NAMED_COLORS: Record<string, string> = {
    aliceblue: "#f0f8ff", antiquewhite: "#faebd7", aqua: "#00ffff", aquamarine: "#7fffd4",
    azure: "#f0ffff", beige: "#f5f5dc", bisque: "#ffe4c4", black: "#000000",
    blanchedalmond: "#ffebcd", blue: "#0000ff", blueviolet: "#8a2be2", brown: "#a52a2a",
    burlywood: "#deb887", cadetblue: "#5f9ea0", chartreuse: "#7fff00", chocolate: "#d2691e",
    coral: "#ff7f50", cornflowerblue: "#6495ed", cornsilk: "#fff8dc", crimson: "#dc143c",
    cyan: "#00ffff", darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b",
    darkgray: "#a9a9a9", darkgreen: "#006400", darkkhaki: "#bdb76b", darkmagenta: "#8b008b",
    darkolivegreen: "#556b2f", darkorange: "#ff8c00", darkorchid: "#9932cc", darkred: "#8b0000",
    darksalmon: "#e9967a", darkseagreen: "#8fbc8f", darkslateblue: "#483d8b",
    darkslategray: "#2f4f4f", darkturquoise: "#00ced1", darkviolet: "#9400d3",
    deeppink: "#ff1493", deepskyblue: "#00bfff", dimgray: "#696969", dodgerblue: "#1e90ff",
    firebrick: "#b22222", floralwhite: "#fffaf0", forestgreen: "#228b22", fuchsia: "#ff00ff",
    gold: "#ffd700", goldenrod: "#daa520", gray: "#808080", green: "#008000",
    greenyellow: "#adff2f", honeydew: "#f0fff0", hotpink: "#ff69b4", indianred: "#cd5c5c",
    indigo: "#4b0082", ivory: "#fffff0", khaki: "#f0e68c", lavender: "#e6e6fa",
    lawngreen: "#7cfc00", lemonchiffon: "#fffacd", lightblue: "#add8e6",
    lightcoral: "#f08080", lightcyan: "#e0ffff", lightgoldenrodyellow: "#fafad2",
    lightgray: "#d3d3d3", lightgreen: "#90ee90", lightpink: "#ffb6c1",
    lightsalmon: "#ffa07a", lightseagreen: "#20b2aa", lightskyblue: "#87cefa",
    lightslategray: "#778899", lightsteelblue: "#b0c4de", lightyellow: "#ffffe0",
    lime: "#00ff00", limegreen: "#32cd32", linen: "#faf0e6", magenta: "#ff00ff",
    maroon: "#800000", mediumaquamarine: "#66cdaa", mediumblue: "#0000cd",
    mediumorchid: "#ba55d3", mediumpurple: "#9370db", mediumseagreen: "#3cb371",
    mediumslateblue: "#7b68ee", mediumspringgreen: "#00fa9a", mediumturquoise: "#48d1cc",
    mediumvioletred: "#c71585", midnightblue: "#191970", mintcream: "#f5fffa",
    mistyrose: "#ffe4e1", moccasin: "#ffe4b5", navajowhite: "#ffdead", navy: "#000080",
    oldlace: "#fdf5e6", olive: "#808000", olivedrab: "#6b8e23", orange: "#ffa500",
    orangered: "#ff4500", orchid: "#da70d6", palegoldenrod: "#eee8aa", palegreen: "#98fb98",
    paleturquoise: "#afeeee", palevioletred: "#db7093", papayawhip: "#ffefd5",
    peachpuff: "#ffdab9", peru: "#cd853f", pink: "#ffc0cb", plum: "#dda0dd",
    powderblue: "#b0e0e6", purple: "#800080", rebeccapurple: "#663399", red: "#ff0000",
    rosybrown: "#bc8f8f", royalblue: "#4169e1", saddlebrown: "#8b4513", salmon: "#fa8072",
    sandybrown: "#f4a460", seagreen: "#2e8b57", sienna: "#a0522d", silver: "#c0c0c0",
    skyblue: "#87ceeb", slateblue: "#6a5acd", slategray: "#708090", snow: "#fffafa",
    springgreen: "#00ff7f", steelblue: "#4682b4", tan: "#d2b48c", teal: "#008080",
    thistle: "#d8bfd8", tomato: "#ff6347", turquoise: "#40e0d0", violet: "#ee82ee",
    wheat: "#f5deb3", white: "#ffffff", whitesmoke: "#f5f5f5", yellow: "#ffff00",
    yellowgreen: "#9acd32",
};

const CSS_LANGUAGES = new Set(["css", "scss", "less", "html", "svg", "vue", "svelte"]);

function findNamedColors(content: string): Array<{ name: string; hex: string; line: number; col: number; endCol: number }> {
    const results: Array<{ name: string; hex: string; line: number; col: number; endCol: number }> = [];
    const lines = content.split("\n");
    const pattern = new RegExp(`\\b(${Object.keys(NAMED_COLORS).join("|")})\\b`, "gi");

    for (let i = 0; i < lines.length; i++) {
        let match: RegExpExecArray | null;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(lines[i])) !== null) {
            const name = match[1].toLowerCase();
            if (NAMED_COLORS[name]) {
                results.push({
                    name,
                    hex: NAMED_COLORS[name],
                    line: i + 1,
                    col: match.index,
                    endCol: match.index + match[1].length,
                });
            }
        }
    }
    return results;
}

export function createCssColorPreviewPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "css-color-preview",
        name: "CSS Named Color Preview",
        version: "1.0.0",
        description: "Shows inline color swatches for CSS named colors",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            update(api);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("css-color-preview");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const { language } = api.getFileInfo();
    const lang = language.toLowerCase();
    if (!CSS_LANGUAGES.has(lang)) {
        api.clearInlineDecorations("css-color-preview");
        return;
    }

    const content = api.getContent();
    const colors = findNamedColors(content);
    const decorations: InlineDecoration[] = colors.map((c, i) => ({
        id: `css-color-preview:${i}`,
        line: c.line,
        startCol: c.col,
        endCol: c.endCol,
        className: "editor-css-color",
        style: { borderBottom: `2px solid ${c.hex}` },
        hoverMessage: `${c.name}: ${c.hex}`,
    }));

    api.clearInlineDecorations("css-color-preview");
    api.addInlineDecorations(decorations);
}
