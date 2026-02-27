/**
 * @module lib/monaco/loadCustomTheme
 *
 * Loads VS Code-compatible theme JSON files from /public/themes/ and
 * registers them with `monaco.editor.defineTheme()`.
 *
 * Theme files should be placed as:
 *   public/themes/one-dark-pro.json
 *   public/themes/dracula.json
 *   etc.
 *
 * The JSON should follow the VS Code theme format:
 * {
 *   "name": "One Dark Pro",
 *   "type": "dark",
 *   "colors": { ... },
 *   "tokenColors": [ ... ]
 * }
 */

import type * as monacoNs from "monaco-editor";

type Monaco = typeof monacoNs;

/* ── State ─────────────────────────────────────────────────── */
const loadedThemes = new Set<string>();
const loadPromises = new Map<string, Promise<boolean>>();

/** VS Code theme JSON shape */
interface VSCodeTheme {
  name?: string;
  type?: "dark" | "light" | "hc";
  colors?: Record<string, string>;
  tokenColors?: Array<{
    name?: string;
    scope?: string | string[];
    settings: {
      foreground?: string;
      background?: string;
      fontStyle?: string;
    };
  }>;
}

/**
 * Convert VS Code theme tokenColors into Monaco token rules.
 */
function convertTokenColors(
  tokenColors: VSCodeTheme["tokenColors"],
): monacoNs.editor.ITokenThemeRule[] {
  if (!tokenColors) return [];

  const rules: monacoNs.editor.ITokenThemeRule[] = [];

  for (const entry of tokenColors) {
    const scopes = Array.isArray(entry.scope)
      ? entry.scope
      : entry.scope
        ? [entry.scope]
        : [];

    for (const scope of scopes) {
      const rule: monacoNs.editor.ITokenThemeRule = { token: scope };
      if (entry.settings.foreground) rule.foreground = entry.settings.foreground.replace("#", "");
      if (entry.settings.background) rule.background = entry.settings.background.replace("#", "");
      if (entry.settings.fontStyle) rule.fontStyle = entry.settings.fontStyle;
      rules.push(rule);
    }
  }

  return rules;
}

/**
 * Convert VS Code colors map into Monaco editor colors.
 * VS Code uses hex strings like "#1e1e1e"; Monaco expects the same format.
 */
function convertColors(colors?: Record<string, string>): Record<string, string> {
  if (!colors) return {};
  // Monaco uses the same format as VS Code for editor colors
  return { ...colors };
}

/**
 * Load a theme from /public/themes/<themeId>.json and register it with Monaco.
 *
 * @param monaco   The Monaco namespace
 * @param themeId  Theme file name (without .json), e.g. "one-dark-pro"
 * @returns true if loaded and registered successfully
 *
 * ```ts
 * import { loadCustomTheme } from "@/modules/monaco-editor";
 *
 * const ok = await loadCustomTheme(monaco, "one-dark-pro");
 * if (ok) monaco.editor.setTheme("one-dark-pro");
 * ```
 */
export async function loadCustomTheme(
  monaco: Monaco,
  themeId: string,
): Promise<boolean> {
  // Already loaded
  if (loadedThemes.has(themeId)) return true;

  // Deduplicate in-flight requests
  if (loadPromises.has(themeId)) return loadPromises.get(themeId)!;

  const promise = (async () => {
    try {
      const res = await fetch(`/themes/${themeId}.json`);
      if (!res.ok) {
        console.warn(`[loadCustomTheme] Theme not found: /themes/${themeId}.json (${res.status})`);
        return false;
      }

      const themeData: VSCodeTheme = await res.json();
      const base: "vs" | "vs-dark" | "hc-black" =
        themeData.type === "light" ? "vs" : themeData.type === "hc" ? "hc-black" : "vs-dark";

      monaco.editor.defineTheme(themeId, {
        base,
        inherit: true,
        rules: convertTokenColors(themeData.tokenColors),
        colors: convertColors(themeData.colors),
      });

      loadedThemes.add(themeId);
      return true;
    } catch (err) {
      console.error(`[loadCustomTheme] Error loading ${themeId}:`, err);
      return false;
    } finally {
      loadPromises.delete(themeId);
    }
  })();

  loadPromises.set(themeId, promise);
  return promise;
}

/**
 * Pre-load multiple themes at once.
 */
export async function preloadThemes(
  monaco: Monaco,
  themeIds: string[],
): Promise<void> {
  await Promise.allSettled(themeIds.map((id) => loadCustomTheme(monaco, id)));
}

/**
 * Check if a theme has already been loaded.
 */
export function isThemeLoaded(themeId: string): boolean {
  return loadedThemes.has(themeId);
}
