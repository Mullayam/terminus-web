/**
 * @module monaco-editor/extensions/loaders/themeLoader
 *
 * SRP: Fetches VS Code theme JSON files from their declared paths in
 * `contributes.themes`, converts them to `MonacoThemeDef` format,
 * and returns plain data. Registration with Monaco happens on main thread.
 */

import { idbGet, idbSet, STORE_ASSETS } from "../idb";
import { cachedFetch } from "../cache";
import { stripJsoncComments } from "../jsonc";
import type { ThemeContribution } from "../packageReader";

/* ── Constants ────────────────────────────────────────────── */

const GITHUB_API_BASE = "https://api.github.com/repos/microsoft/vscode/contents";

function resolveGithubUrl(folder: string, relativePath: string): string {
  const cleanPath = relativePath.replace(/^\.\//, "");
  return `${GITHUB_API_BASE}/extensions/${folder}/${cleanPath}?ref=main`;
}

async function fetchAndDecode(url: string): Promise<string | null> {
  try {
    const res = await cachedFetch(url);
    if (!res.ok) {
      if (res.status === 403) {
        console.warn(`[monaco-ext] GitHub rate limit hit while fetching theme: ${url}`);
      }
      return null;
    }
    const data = await res.json();
    if (data.encoding !== "base64" || !data.content) return null;
    const cleaned = (data.content as string).replace(/\n/g, "");
    const bytes = atob(cleaned);
    const uint8 = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) uint8[i] = bytes.charCodeAt(i);
    return new TextDecoder().decode(uint8);
  } catch (e) {
    console.warn(`[monaco-ext] Theme fetch error`, e);
    return null;
  }
}

/* ── State ────────────────────────────────────────────────── */

const loadedThemes = new Set<string>();

/* ── VS Code Theme JSON shape ─────────────────────────────── */

interface VSCodeThemeJson {
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

/* ── Result type ──────────────────────────────────────────── */

export interface ThemeData {
  /** Unique theme ID (kebab-case) */
  id: string;
  /** Display name */
  name: string;
  /** Monaco base theme */
  base: "vs" | "vs-dark" | "hc-black" | "hc-light";
  /** Whether to inherit base theme rules */
  inherit: boolean;
  /** Monaco token rules (converted from tokenColors) */
  rules: Array<{
    token: string;
    foreground?: string;
    background?: string;
    fontStyle?: string;
  }>;
  /** Editor colors (passthrough from VS Code) */
  colors: Record<string, string>;
}

/* ── Conversion helpers ───────────────────────────────────── */

/**
 * Map VS Code `uiTheme` string to Monaco base theme.
 */
function mapUiThemeToBase(uiTheme: string): "vs" | "vs-dark" | "hc-black" | "hc-light" {
  switch (uiTheme) {
    case "vs":
      return "vs";
    case "vs-dark":
      return "vs-dark";
    case "hc-black":
      return "hc-black";
    case "hc-light":
      return "hc-light";
    default:
      return "vs-dark";
  }
}

/**
 * Convert VS Code `tokenColors` array to Monaco `ITokenThemeRule[]`.
 */
function convertTokenColors(
  tokenColors: VSCodeThemeJson["tokenColors"],
): ThemeData["rules"] {
  if (!tokenColors) return [];

  const rules: ThemeData["rules"] = [];

  for (const entry of tokenColors) {
    const scopes = Array.isArray(entry.scope)
      ? entry.scope
      : entry.scope
        ? [entry.scope]
        : [];

    for (const scope of scopes) {
      const rule: ThemeData["rules"][0] = { token: scope };
      if (entry.settings.foreground) {
        rule.foreground = entry.settings.foreground.replace("#", "");
      }
      if (entry.settings.background) {
        rule.background = entry.settings.background.replace("#", "");
      }
      if (entry.settings.fontStyle) {
        rule.fontStyle = entry.settings.fontStyle;
      }
      rules.push(rule);
    }
  }

  return rules;
}

/* ── Public ───────────────────────────────────────────────── */

/**
 * Fetch, decode, and convert theme files from `contributes.themes`.
 * Returns plain data bags — registration with Monaco happens on main thread.
 */
export async function fetchThemes(
  folder: string,
  themes: ThemeContribution[],
): Promise<ThemeData[]> {
  const results: ThemeData[] = [];

  for (const theme of themes) {
    if (!theme.path || !theme.id) continue;
    if (loadedThemes.has(theme.id)) continue;

    const idbKey = `ext:${folder}:theme:${theme.id}`;
    let content = await idbGet(STORE_ASSETS, idbKey);

    if (!content) {
      const url = resolveGithubUrl(folder, theme.path);
      content = await fetchAndDecode(url);
      if (!content) continue;
      await idbSet(STORE_ASSETS, idbKey, content);
    }

    try {
      const cleaned = stripJsoncComments(content);
      const themeJson: VSCodeThemeJson = JSON.parse(cleaned);

      const themeData: ThemeData = {
        id: theme.id,
        name: theme.label || theme.id,
        base: mapUiThemeToBase(theme.uiTheme),
        inherit: true,
        rules: convertTokenColors(themeJson.tokenColors),
        colors: themeJson.colors ?? {},
      };

      loadedThemes.add(theme.id);
      results.push(themeData);
      console.log(
        `[monaco-ext] Theme parsed: ${theme.id} (base: ${themeData.base})`,
      );
    } catch (e) {
      console.warn(`[monaco-ext] Theme parse failed: ${theme.id}`, e);
    }
  }

  return results;
}

export function resetThemeLoader(): void {
  loadedThemes.clear();
}
