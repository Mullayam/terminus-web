/**
 * @module editor/terminal/themeAdapter
 *
 * Maps an EditorTheme to an xterm.js `ITheme` so the terminal's
 * appearance stays in sync with the active editor theme.
 *
 * ## Strategy
 * | xterm slot       | Source                                              |
 * |------------------|-----------------------------------------------------|
 * | background       | `colors.background`                                 |
 * | foreground       | `colors.foreground`                                 |
 * | cursor           | `colors.cursor`                                     |
 * | cursorAccent     | `colors.background`  (inverted look)                |
 * | selectionBg      | `colors.selection`   (strip trailing alpha if any)  |
 * | black            | `colors.gutterBg`    (darkest chrome surface)       |
 * | red              | `syntax.deleted`  / `colors.error`                  |
 * | green            | `syntax.inserted` / `colors.success`                |
 * | yellow           | `syntax.string`   / `colors.warning`                |
 * | blue             | `syntax.function`                                   |
 * | magenta          | `syntax.keyword`                                    |
 * | cyan             | `syntax.builtin`                                    |
 * | white            | `colors.foreground`                                 |
 * | brightBlack      | `syntax.comment`                                    |
 * | brightRed        | `colors.error`                                      |
 * | brightGreen      | `colors.success`                                    |
 * | brightYellow     | `colors.warning`                                    |
 * | brightBlue       | `syntax.variable`                                   |
 * | brightMagenta    | `syntax.constant`                                   |
 * | brightCyan       | `syntax.property`                                   |
 * | brightWhite      | `colors.gutterActiveFg` (brightest text)            |
 */
import type { EditorTheme } from "../types";
import type { ITheme } from "@xterm/xterm";

/**
 * Convert an `EditorTheme` into an xterm.js `ITheme`.
 *
 * The result is a new plain object – safe to pass as a React prop
 * without causing unnecessary re-renders when the same theme is
 * mapped again (use shallow-compare or JSON fingerprinting on the
 * consumer side if memoisation is required).
 */
export function editorThemeToXterm(theme: EditorTheme): ITheme {
    const { colors, syntax } = theme;

    return {
        background: colors.background,
        foreground: colors.foreground,
        cursor: colors.cursor,
        cursorAccent: colors.background,
        selectionBackground: normalizeAlpha(colors.selection),
        selectionForeground: undefined, // let xterm auto-compute

        black: colors.gutterBg ?? colors.background,
        red: syntax.deleted ?? colors.error,
        green: syntax.inserted ?? colors.success,
        yellow: syntax.string ?? colors.warning,
        blue: syntax.function,
        magenta: syntax.keyword,
        cyan: syntax.builtin,
        white: colors.foreground,

        brightBlack: syntax.comment ?? colors.muted,
        brightRed: colors.error,
        brightGreen: colors.success,
        brightYellow: colors.warning,
        brightBlue: syntax.variable ?? syntax.function,
        brightMagenta: syntax.constant ?? syntax.keyword,
        brightCyan: syntax.property ?? syntax.builtin,
        brightWhite: colors.gutterActiveFg ?? colors.foreground,
    };
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Some theme colors use an `aa` / `cc` alpha suffix (e.g.
 * `#264f78aa`). xterm.js accepts 8-digit hex but the selection
 * background looks better if we keep a moderate alpha rather than
 * the often very-low alpha from editor themes. Clamp the alpha
 * channel to a minimum of ~40 % (`66` hex).
 */
function normalizeAlpha(hex: string): string {
    if (hex.length === 9) {
        // 9 chars = #RRGGBBAA
        const alpha = parseInt(hex.slice(7, 9), 16);
        if (alpha < 0x66) {
            return hex.slice(0, 7) + "66";
        }
    }
    return hex;
}
