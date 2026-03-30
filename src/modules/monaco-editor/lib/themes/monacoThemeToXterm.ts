/**
 * @module monaco-editor/lib/monacoThemeToXterm
 *
 * Converts a Monaco theme definition (or theme ID) to an xterm.js ITheme.
 * Uses the editor color palette to derive terminal colors,
 * ensuring the embedded terminal matches the active editor theme.
 */

import type { ITheme } from "@xterm/xterm";
import { getTheme } from "../../core/theme-registry";
import type { MonacoThemeDef } from "../../types";

/* ── ANSI color defaults (used when a Monaco theme lacks color rules) ── */

const DARK_DEFAULTS: ITheme = {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    cursorAccent: "#1e1e2e",
    selectionBackground: "#585b7066",
    black: "#45475a",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#f5c2e7",
    cyan: "#94e2d5",
    white: "#bac2de",
    brightBlack: "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#f5c2e7",
    brightCyan: "#94e2d5",
    brightWhite: "#a6adc8",
};

const LIGHT_DEFAULTS: ITheme = {
    background: "#ffffff",
    foreground: "#383a42",
    cursor: "#526eff",
    cursorAccent: "#ffffff",
    selectionBackground: "#add6ff80",
    black: "#383a42",
    red: "#e45649",
    green: "#50a14f",
    yellow: "#c18401",
    blue: "#4078f2",
    magenta: "#a626a4",
    cyan: "#0184bc",
    white: "#a0a1a7",
    brightBlack: "#4f525e",
    brightRed: "#e45649",
    brightGreen: "#50a14f",
    brightYellow: "#c18401",
    brightBlue: "#4078f2",
    brightMagenta: "#a626a4",
    brightCyan: "#0184bc",
    brightWhite: "#fafafa",
};

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Extract a foreground color for a given token from Monaco theme rules.
 */
function getTokenColor(rules: MonacoThemeDef["rules"], token: string): string | undefined {
    for (const rule of rules) {
        if (rule.token === token && rule.foreground) {
            // Monaco stores colors without '#' prefix
            const fg = rule.foreground;
            return fg.startsWith("#") ? fg : `#${fg}`;
        }
    }
    return undefined;
}

/**
 * Get an editor color from the theme colors map.
 */
function getColor(colors: Record<string, string>, key: string): string | undefined {
    return colors[key];
}

/* ── Public API ────────────────────────────────────────────── */

/**
 * Convert a MonacoThemeDef into an xterm.js ITheme.
 * Maps editor background, foreground, cursor, and ANSI colors from token rules.
 */
export function monacoThemeDefToXterm(theme: MonacoThemeDef): ITheme {
    const isLight = theme.base === "vs" || theme.base === "hc-light";
    const defaults = isLight ? LIGHT_DEFAULTS : DARK_DEFAULTS;

    const bg = getColor(theme.colors, "editor.background") ?? defaults.background;
    const fg = getColor(theme.colors, "editor.foreground") ?? defaults.foreground;
    const cursor = getColor(theme.colors, "editorCursor.foreground") ?? defaults.cursor;
    const selection = getColor(theme.colors, "editor.selectionBackground") ?? defaults.selectionBackground;

    // Map Monaco token colors → ANSI terminal colors
    const red = getTokenColor(theme.rules, "variable") ?? getTokenColor(theme.rules, "tag") ?? defaults.red;
    const green = getTokenColor(theme.rules, "string") ?? defaults.green;
    const yellow = getTokenColor(theme.rules, "number") ?? getTokenColor(theme.rules, "type") ?? defaults.yellow;
    const blue = getTokenColor(theme.rules, "function") ?? defaults.blue;
    const magenta = getTokenColor(theme.rules, "keyword") ?? defaults.magenta;
    const cyan = getTokenColor(theme.rules, "operator") ?? getTokenColor(theme.rules, "regexp") ?? defaults.cyan;

    return {
        background: bg,
        foreground: fg,
        cursor,
        cursorAccent: bg,
        selectionBackground: selection,
        black: isLight ? "#383a42" : getColor(theme.colors, "editorWhitespace.foreground") ?? defaults.black,
        red,
        green,
        yellow,
        blue,
        magenta,
        cyan,
        white: fg ?? defaults.white,
        brightBlack: getColor(theme.colors, "editorLineNumber.foreground") ?? defaults.brightBlack,
        brightRed: red,
        brightGreen: green,
        brightYellow: yellow,
        brightBlue: blue,
        brightMagenta: magenta,
        brightCyan: cyan,
        brightWhite: getColor(theme.colors, "editorLineNumber.activeForeground") ?? defaults.brightWhite,
    };
}

/**
 * Convert a Monaco theme ID to an xterm.js ITheme.
 * Looks up the theme from the registry, falls back to defaults for built-in themes.
 */
export function monacoThemeIdToXterm(themeId: string): ITheme {
    // Check if it's a registered custom/built-in theme
    const def = getTheme(themeId);
    if (def) return monacoThemeDefToXterm(def);

    // Fallback for built-in Monaco themes
    if (themeId === "vs") return LIGHT_DEFAULTS;
    if (themeId === "hc-light") return LIGHT_DEFAULTS;

    // Default: dark theme
    return DARK_DEFAULTS;
}
