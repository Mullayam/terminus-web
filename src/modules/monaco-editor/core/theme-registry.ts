/**
 * @module monaco-editor/core/theme-registry
 *
 * Helpers for registering and managing Monaco themes.
 */

import type { Monaco, MonacoThemeDef } from "../types";

const registeredThemes = new Map<string, MonacoThemeDef>();

/**
 * Register a theme definition. Safe to call multiple times
 * (will overwrite the previous definition with the same ID).
 */
export function registerTheme(monaco: Monaco, theme: MonacoThemeDef): void {
  monaco.editor.defineTheme(theme.id, {
    base: theme.base,
    inherit: theme.inherit,
    rules: theme.rules,
    colors: theme.colors,
  });
  registeredThemes.set(theme.id, theme);
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
