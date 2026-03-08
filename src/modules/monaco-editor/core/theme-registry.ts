/**
 * @module monaco-editor/core/theme-registry
 *
 * Helpers for registering and managing Monaco themes.
 */

import type { Monaco, MonacoThemeDef } from "../types";

const registeredThemes = new Map<string, MonacoThemeDef>();

/* ── Color helpers ─────────────────────────────────────────── */

/**
 * Parse a hex color to RGB values.
 * Handles #RGB, #RGBA, #RRGGBB, #RRGGBBAA formats.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) {
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  }
  if (h.length >= 6) {
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  return null;
}

/** Lighten or darken a hex color by a factor (-1..1). Positive = lighter. */
function adjustColor(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const adjust = (c: number) =>
    Math.round(Math.min(255, Math.max(0, factor > 0 ? c + (255 - c) * factor : c + c * factor)));
  const r = adjust(rgb.r).toString(16).padStart(2, "0");
  const g = adjust(rgb.g).toString(16).padStart(2, "0");
  const b = adjust(rgb.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

/**
 * Ensure theme colors include all keys needed for context menus,
 * widgets, and list elements to match the editor theme.
 * Only fills in missing keys — never overwrites existing ones.
 */
export function ensureWidgetColors(
  colors: Record<string, string>,
  isDark: boolean,
): Record<string, string> {
  const bg = colors["editor.background"] ?? (isDark ? "#1e1e1e" : "#ffffff");
  const fg = colors["editor.foreground"] ?? (isDark ? "#d4d4d4" : "#000000");
  // Surface: slightly lighter/darker than editor background
  const surface = adjustColor(bg, isDark ? 0.08 : -0.03);
  // Hover: more visible highlight
  const hover = adjustColor(bg, isDark ? 0.14 : -0.06);
  // Selection: prominent
  const selection = adjustColor(bg, isDark ? 0.22 : -0.12);
  // Border: subtle
  const border = adjustColor(bg, isDark ? 0.20 : -0.10);
  // Separator: very subtle line
  const separator = adjustColor(bg, isDark ? 0.15 : -0.08);

  const defaults: Record<string, string> = {
    // Context menu
    "menu.background": surface,
    "menu.foreground": fg,
    "menu.selectionBackground": selection,
    "menu.selectionForeground": fg,
    "menu.separatorBackground": separator,
    "menu.border": border,
    // Widget (suggestions, hover tooltip, etc.)
    "editorWidget.background": surface,
    "editorWidget.foreground": fg,
    "editorWidget.border": border,
    // List (autocomplete, code actions dropdown)
    "list.hoverBackground": hover,
    "list.hoverForeground": fg,
    "list.activeSelectionBackground": selection,
    "list.activeSelectionForeground": fg,
    "list.focusBackground": selection,
    "list.focusForeground": fg,
    "list.highlightForeground": colors["editorCursor.foreground"] ?? (isDark ? "#569cd6" : "#0066bf"),
    // Input (find widget, rename input)
    "input.background": adjustColor(bg, isDark ? 0.05 : -0.02),
    "input.foreground": fg,
    "input.border": border,
    "inputOption.activeBorder": colors["editorCursor.foreground"] ?? (isDark ? "#569cd6" : "#0066bf"),
    // Suggest widget specifics
    "editorSuggestWidget.background": surface,
    "editorSuggestWidget.foreground": fg,
    "editorSuggestWidget.border": border,
    "editorSuggestWidget.selectedBackground": selection,
    "editorSuggestWidget.highlightForeground": colors["editorCursor.foreground"] ?? (isDark ? "#569cd6" : "#0066bf"),
    // Hover widget
    "editorHoverWidget.background": surface,
    "editorHoverWidget.foreground": fg,
    "editorHoverWidget.border": border,
    // Peek view (go to definition)
    "peekView.border": colors["editorCursor.foreground"] ?? (isDark ? "#569cd6" : "#0066bf"),
    "peekViewEditor.background": adjustColor(bg, isDark ? 0.04 : -0.01),
    "peekViewResult.background": surface,
    "peekViewResult.selectionBackground": selection,
    "peekViewTitle.background": adjustColor(bg, isDark ? 0.06 : -0.02),
  };

  const enriched = { ...colors };
  for (const [key, value] of Object.entries(defaults)) {
    if (!enriched[key]) enriched[key] = value;
  }
  return enriched;
}

/**
 * Register a theme definition. Safe to call multiple times
 * (will overwrite the previous definition with the same ID).
 * Automatically injects menu/widget colors from the editor background/foreground
 * if they are not already present.
 */
export function registerTheme(monaco: Monaco, theme: MonacoThemeDef): void {
  const isDark = theme.base === "vs-dark" || theme.base === "hc-black";
  const enrichedColors = ensureWidgetColors(theme.colors, isDark);

  monaco.editor.defineTheme(theme.id, {
    base: theme.base,
    inherit: theme.inherit,
    rules: theme.rules,
    colors: enrichedColors,
  });
  registeredThemes.set(theme.id, { ...theme, colors: enrichedColors });
}

/**
 * Register multiple themes at once.
 */
export function registerThemes(monaco: Monaco, themes: MonacoThemeDef[]): void {
  for (const theme of themes) {
    registerTheme(monaco, theme);
  }
}

/**
 * Get a registered theme definition by ID.
 */
export function getTheme(id: string): MonacoThemeDef | undefined {
  return registeredThemes.get(id);
}

/**
 * Get all registered theme definitions.
 */
export function getAllThemes(): MonacoThemeDef[] {
  return Array.from(registeredThemes.values());
}

/**
 * Check if a theme is registered.
 */
export function hasTheme(id: string): boolean {
  return registeredThemes.has(id);
}
