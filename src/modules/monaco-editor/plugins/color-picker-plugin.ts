/**
 * @module monaco-editor/plugins/color-picker-plugin
 *
 * Detects CSS/hex/rgb/hsl colors in code, renders inline color swatches
 * as decorations, and provides a color picker via Monaco's built-in
 * DocumentColorProvider API.
 */

import type { MonacoPlugin, PluginContext } from "../types";

const STYLE_ID = "color-picker-plugin-css";

const CSS = `
.color-swatch-decoration {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 3px;
}
`;

/* Color regex patterns */
const HEX_RE = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)/g;
const HSL_RE = /hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%(?:\s*,\s*([\d.]+))?\s*\)/g;

/** Named CSS colors subset (most common) */
const NAMED_COLORS: Record<string, [number, number, number]> = {
  red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255],
  white: [255, 255, 255], black: [0, 0, 0], yellow: [255, 255, 0],
  orange: [255, 165, 0], purple: [128, 0, 128], pink: [255, 192, 203],
  gray: [128, 128, 128], grey: [128, 128, 128], cyan: [0, 255, 255],
  magenta: [255, 0, 255], lime: [0, 255, 0], navy: [0, 0, 128],
  teal: [0, 128, 128], maroon: [128, 0, 0], olive: [128, 128, 0],
  aqua: [0, 255, 255], silver: [192, 192, 192], gold: [255, 215, 0],
  coral: [255, 127, 80], salmon: [250, 128, 114], khaki: [240, 230, 140],
  crimson: [220, 20, 60], indigo: [75, 0, 130], violet: [238, 130, 238],
  tomato: [255, 99, 71], orchid: [218, 112, 214], turquoise: [64, 224, 208],
};

function hexToRGBA(hex: string): { r: number; g: number; b: number; a: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function hslToRGB(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Languages that typically contain CSS colors */
import { COLOR_LANGUAGES as COLOR_LANGS } from "../lib/language/language-groups";

export const colorPickerPlugin: MonacoPlugin = {
  id: "builtin-color-picker",
  name: "Color Picker",
  version: "1.0.0",
  description: "Inline color swatches and picker for CSS colors",

  onMount(ctx: PluginContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let decorationIds: string[] = [];

    /* Update decorations — add inline color swatches */
    const updateDecorations = () => {
      const model = ctx.editor.getModel();
      if (!model) return;

      const text = model.getValue();
      const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = [];

      const addDeco = (start: number, end: number, color: string) => {
        const startPos = model.getPositionAt(start);
        const endPos = model.getPositionAt(end);
        decorations.push({
          range: new ctx.monaco.Range(
            startPos.lineNumber, startPos.column,
            endPos.lineNumber, endPos.column,
          ),
          options: {
            before: {
              content: "\u00A0",
              inlineClassName: "color-swatch-decoration",
              inlineClassNameAffectsLetterSpacing: true,
            },
            beforeContentClassName: `color-swatch-decoration`,
          } as any,
        });
        void color; // used for the DocumentColorProvider below
      };

      // Hex colors
      let match: RegExpExecArray | null;
      const hexRe = new RegExp(HEX_RE.source, "g");
      while ((match = hexRe.exec(text)) !== null) {
        addDeco(match.index, match.index + match[0].length, match[0]);
      }

      // RGB colors
      const rgbRe = new RegExp(RGB_RE.source, "g");
      while ((match = rgbRe.exec(text)) !== null) {
        addDeco(match.index, match.index + match[0].length, match[0]);
      }

      // HSL colors
      const hslRe = new RegExp(HSL_RE.source, "g");
      while ((match = hslRe.exec(text)) !== null) {
        addDeco(match.index, match.index + match[0].length, match[0]);
      }

      decorationIds = ctx.editor.deltaDecorations(decorationIds, decorations);
    };

    /* Register DocumentColorProvider for the built-in Monaco color picker */
    ctx.registerColorProvider([...COLOR_LANGS], {
      provideDocumentColors(model) {
        const text = model.getValue();
        const colors: import("monaco-editor").languages.IColorInformation[] = [];

        // Hex
        const hexRe = new RegExp(HEX_RE.source, "g");
        let m: RegExpExecArray | null;
        while ((m = hexRe.exec(text)) !== null) {
          const { r, g, b, a } = hexToRGBA(m[0]);
          const startPos = model.getPositionAt(m.index);
          const endPos = model.getPositionAt(m.index + m[0].length);
          colors.push({
            range: {
              startLineNumber: startPos.lineNumber, startColumn: startPos.column,
              endLineNumber: endPos.lineNumber, endColumn: endPos.column,
            },
            color: { red: r / 255, green: g / 255, blue: b / 255, alpha: a },
          });
        }

        // RGB
        const rgbRe = new RegExp(RGB_RE.source, "g");
        while ((m = rgbRe.exec(text)) !== null) {
          const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
          const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
          const startPos = model.getPositionAt(m.index);
          const endPos = model.getPositionAt(m.index + m[0].length);
          colors.push({
            range: {
              startLineNumber: startPos.lineNumber, startColumn: startPos.column,
              endLineNumber: endPos.lineNumber, endColumn: endPos.column,
            },
            color: { red: r / 255, green: g / 255, blue: b / 255, alpha: a },
          });
        }

        // HSL
        const hslRe = new RegExp(HSL_RE.source, "g");
        while ((m = hslRe.exec(text)) !== null) {
          const [r, g, b] = hslToRGB(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
          const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
          const startPos = model.getPositionAt(m.index);
          const endPos = model.getPositionAt(m.index + m[0].length);
          colors.push({
            range: {
              startLineNumber: startPos.lineNumber, startColumn: startPos.column,
              endLineNumber: endPos.lineNumber, endColumn: endPos.column,
            },
            color: { red: r / 255, green: g / 255, blue: b / 255, alpha: a },
          });
        }

        return colors;
      },

      provideColorPresentations(_model, colorInfo) {
        const { red, green, blue, alpha } = colorInfo.color;
        const r = Math.round(red * 255);
        const g = Math.round(green * 255);
        const b = Math.round(blue * 255);

        const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        const hexA = alpha < 1 ? hex + Math.round(alpha * 255).toString(16).padStart(2, "0") : hex;

        const presentations: import("monaco-editor").languages.IColorPresentation[] = [
          { label: hexA },
          { label: alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})` : `rgb(${r}, ${g}, ${b})` },
        ];

        return presentations;
      },
    });

    /* Debounced decoration updates */
    let debounce: ReturnType<typeof setTimeout>;
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        clearTimeout(debounce);
        debounce = setTimeout(updateDecorations, 300);
      }),
    );

    updateDecorations();

    // Export helper for named colors
    void NAMED_COLORS;
  },
};
