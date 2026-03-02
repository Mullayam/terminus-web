/**
 * @module monaco-editor/themes/monaco-themes-catalog
 *
 * Lazily imports ALL themes from the `monaco-themes` npm package and converts
 * them into MonacoThemeDef objects ready for `registerTheme()`.
 *
 * Each entry also carries `displayColors` (bg, fg, accent) for the ThemePicker UI.
 */

import type { MonacoThemeDef } from "../types";
 
/* ── Theme list (inlined from package — the package "exports" field
      doesn't expose ./themes/* so we cannot deep-import)  ─── */

const themeList: Record<string, string> = {
  "active4d": "Active4D",
  "all-hallows-eve": "All Hallows Eve",
  "amy": "Amy",
  "birds-of-paradise": "Birds of Paradise",
  "blackboard": "Blackboard",
  "brilliance-black": "Brilliance Black",
  "brilliance-dull": "Brilliance Dull",
  "chrome-devtools": "Chrome DevTools",
  "clouds-midnight": "Clouds Midnight",
  "clouds": "Clouds",
  "cobalt": "Cobalt",
  "cobalt2": "Cobalt2",
  "dawn": "Dawn",
  "dracula": "Dracula",
  "dreamweaver": "Dreamweaver",
  "eiffel": "Eiffel",
  "espresso-libre": "Espresso Libre",
  "github-dark": "GitHub Dark",
  "github-light": "GitHub Light",
  "github": "GitHub",
  "idle": "IDLE",
  "katzenmilch": "Katzenmilch",
  "kuroir-theme": "Kuroir Theme",
  "lazy": "LAZY",
  "magicwb--amiga-": "MagicWB (Amiga)",
  "merbivore-soft": "Merbivore Soft",
  "merbivore": "Merbivore",
  "monokai-bright": "Monokai Bright",
  "monokai": "Monokai",
  "night-owl": "Night Owl",
  "nord": "Nord",
  "oceanic-next": "Oceanic Next",
  "pastels-on-dark": "Pastels on Dark",
  "slush-and-poppies": "Slush and Poppies",
  "solarized-dark": "Solarized-dark",
  "solarized-light": "Solarized-light",
  "spacecadet": "SpaceCadet",
  "sunburst": "Sunburst",
  "textmate--mac-classic-": "Textmate (Mac Classic)",
  "tomorrow-night-blue": "Tomorrow-Night-Blue",
  "tomorrow-night-bright": "Tomorrow-Night-Bright",
  "tomorrow-night-eighties": "Tomorrow-Night-Eighties",
  "tomorrow-night": "Tomorrow-Night",
  "tomorrow": "Tomorrow",
  "twilight": "Twilight",
  "upstream-sunburst": "Upstream Sunburst",
  "vibrant-ink": "Vibrant Ink",
  "xcode-default": "Xcode_default",
  "zenburnesque": "Zenburnesque",
  "iplastic": "iPlastic",
  "idlefingers": "idleFingers",
  "krtheme": "krTheme",
  "monoindustrial": "monoindustrial",
};

/**
 * Raw monaco-themes JSON shape (already Monaco-compatible):
 *   { base, inherit, rules, colors }
 */
interface RawThemeData {
  base: "vs" | "vs-dark" | "hc-black" | "hc-light";
  inherit: boolean;
  rules: Array<{ token: string; foreground?: string; background?: string; fontStyle?: string }>;
  colors: Record<string, string>;
}

/* ── Lazy glob import — Vite resolves node_modules by filesystem path,
      bypassing the restrictive "exports" field ───────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const themeGlob: Record<string, () => Promise<any>> = import.meta.glob(
  "/node_modules/monaco-themes/themes/*.json",
  { import: "default" },
);

/**
 * Build a lookup from kebab-case theme ID → glob dynamic-import function.
 * The glob keys look like "/node_modules/monaco-themes/themes/Active4D.json".
 */
function buildThemeImporters(): Record<string, () => Promise<any>> {
  // Build reverse map: display name → glob key
  const nameToGlob = new Map<string, () => Promise<any>>();
  for (const [globKey, loader] of Object.entries(themeGlob)) {
    // Extract e.g. "Active4D" from "/node_modules/monaco-themes/themes/Active4D.json"
    const file = globKey.split("/").pop()?.replace(/\.json$/, "");
    if (file) nameToGlob.set(file, loader);
  }

  const importers: Record<string, () => Promise<any>> = {};
  for (const [id, displayName] of Object.entries(themeList)) {
    // The JSON filename is the display name (e.g. "Active4D", "All Hallows Eve")
    const loader = nameToGlob.get(displayName);
    if (loader) importers[id] = loader;
  }
  return importers;
}

const themeImporters = buildThemeImporters();

/* ── Display info for ThemePicker ─────────────────────────── */

export interface ThemeDisplayInfo {
  id: string;
  name: string;
  isDark: boolean;
  /** [background, foreground, accent] */
  displayColors: [string, string, string];
}

/**
 * Normalise a hex color: ensure `#` prefix. Some theme JSONs omit it.
 */
function normalizeHex(c: string | undefined, fallback: string): string {
  if (!c) return fallback;
  return c.startsWith("#") ? c : `#${c}`;
}

/**
 * Extract the accent colour from a raw theme — best-effort.
 */
function extractAccent(raw: RawThemeData): string | undefined {
  const colors = raw.colors ?? {};
  // Cursor colour is usually the most visible accent
  if (colors["editorCursor.foreground"]) return colors["editorCursor.foreground"];
  // Selection background can work
  if (colors["editor.selectionBackground"]) return colors["editor.selectionBackground"];
  // Fallback: first keyword-like token
  const keyword = raw.rules.find((r) => r.token === "keyword" || r.token === "string");
  if (keyword?.foreground) return normalizeHex(keyword.foreground, "#569cd6");
  return undefined;
}

/* ── Cache: lazily populated ──────────────────────────────── */

const loadedThemes = new Map<string, MonacoThemeDef>();
const loadedDisplayInfo = new Map<string, ThemeDisplayInfo>();

/**
 * Load one monaco-themes theme by ID. Returns the theme definition
 * and caches it.
 */
export async function loadMonacoTheme(id: string): Promise<MonacoThemeDef | null> {
  if (loadedThemes.has(id)) return loadedThemes.get(id)!;

  const importer = themeImporters[id];
  if (!importer) return null;

  try {
    const raw: RawThemeData = await importer();
    const theme: MonacoThemeDef = {
      id,
      name: (themeList as Record<string, string>)[id] ?? id,
      base: raw.base,
      inherit: raw.inherit,
      rules: raw.rules as MonacoThemeDef["rules"],
      colors: raw.colors ?? {},
    };
    loadedThemes.set(id, theme);
    return theme;
  } catch (err) {
    console.warn(`[monaco-themes-catalog] Failed to load theme "${id}":`, err);
    return null;
  }
}

/**
 * Synchronously get a theme that was already loaded.
 */
export function getLoadedMonacoTheme(id: string): MonacoThemeDef | undefined {
  return loadedThemes.get(id);
}

/**
 * Build the full catalog of display info **synchronously** — uses
 * precomputed metadata (doesn't load the theme JSON).
 *
 * The display-colour data is embedded via a pre-built lookup below.
 */
export function getAllThemeDisplayInfo(): ThemeDisplayInfo[] {
  if (loadedDisplayInfo.size > 0) return Array.from(loadedDisplayInfo.values());

  for (const [id, name] of Object.entries(themeList as Record<string, string>)) {
    const meta = PRECOMPUTED_META[id];
    const isDark = meta?.d ?? true;
    const bg = meta?.bg ?? "#1e1e1e";
    const fg = meta?.fg ?? "#d4d4d4";
    const accent = meta?.ac ?? "#569cd6";

    const info: ThemeDisplayInfo = { id, name, isDark, displayColors: [bg, fg, accent] };
    loadedDisplayInfo.set(id, info);
  }

  return Array.from(loadedDisplayInfo.values());
}

/* ── Precomputed metadata ─────────────────────────────────── */

/**
 * { bg, fg, ac(cent), d(ark) } extracted from each theme JSON.
 * This avoids loading every theme just to show the picker.
 */
const PRECOMPUTED_META: Record<string, { bg: string; fg: string; ac: string; d: boolean }> = {
  "active4d":                { bg: "#FFFFFF", fg: "#000000", ac: "#D01921", d: false },
  "all-hallows-eve":         { bg: "#000000", fg: "#FFFFFF", ac: "#A5C261", d: true },
  "amy":                     { bg: "#200020", fg: "#D0D0FF", ac: "#7090B0", d: true },
  "birds-of-paradise":       { bg: "#372725", fg: "#E6E1C4", ac: "#EF5D32", d: true },
  "blackboard":              { bg: "#0C1021", fg: "#F8F8F8", ac: "#FBDE2D", d: true },
  "brilliance-black":        { bg: "#0D0D0D", fg: "#FFFFFF", ac: "#FB9A4B", d: true },
  "brilliance-dull":         { bg: "#FFFFFF", fg: "#333333", ac: "#FB9A4B", d: false },
  "chrome-devtools":         { bg: "#FFFFFF", fg: "#000000", ac: "#1A1AA6", d: false },
  "clouds-midnight":         { bg: "#191919", fg: "#929292", ac: "#E92E2E", d: true },
  "clouds":                  { bg: "#FFFFFF", fg: "#000000", ac: "#AF956F", d: false },
  "cobalt":                  { bg: "#002240", fg: "#FFFFFF", ac: "#FF9D00", d: true },
  "cobalt2":                 { bg: "#193549", fg: "#e1efff", ac: "#ffc600", d: true },
  "dawn":                    { bg: "#F9F9F9", fg: "#080808", ac: "#794938", d: false },
  "dracula":                 { bg: "#282A36", fg: "#F8F8F2", ac: "#FF79C6", d: true },
  "dreamweaver":             { bg: "#FFFFFF", fg: "#000000", ac: "#0000FF", d: false },
  "eiffel":                  { bg: "#FFFFFF", fg: "#000000", ac: "#0000FF", d: false },
  "espresso-libre":          { bg: "#2A211C", fg: "#BDAE9D", ac: "#44AA43", d: true },
  "github-dark":             { bg: "#24292e", fg: "#e1e4e8", ac: "#79b8ff", d: true },
  "github-light":            { bg: "#ffffff", fg: "#24292e", ac: "#005cc5", d: false },
  "github":                  { bg: "#FFFFFF", fg: "#000000", ac: "#000000", d: false },
  "idle":                    { bg: "#FFFFFF", fg: "#000000", ac: "#FF0000", d: false },
  "katzenmilch":             { bg: "#F3F2F3", fg: "#555555", ac: "#325CC0", d: false },
  "kuroir-theme":            { bg: "#E8E9E8", fg: "#363636", ac: "#397D13", d: false },
  "lazy":                    { bg: "#FFFFFF", fg: "#000000", ac: "#1A1AA6", d: false },
  "magicwb--amiga-":         { bg: "#969696", fg: "#000000", ac: "#DD0000", d: false },
  "merbivore-soft":          { bg: "#1C1C1C", fg: "#E8E8E8", ac: "#FC803A", d: true },
  "merbivore":               { bg: "#161616", fg: "#E8E8E8", ac: "#FC6A24", d: true },
  "monokai-bright":          { bg: "#272822", fg: "#F8F8F2", ac: "#F92672", d: true },
  "monokai":                 { bg: "#272822", fg: "#F8F8F2", ac: "#F92672", d: true },
  "night-owl":               { bg: "#011627", fg: "#d6deeb", ac: "#80a4c2", d: true },
  "nord":                    { bg: "#2E3440", fg: "#D8DEE9", ac: "#88C0D0", d: true },
  "oceanic-next":            { bg: "#1B2B34", fg: "#CDD3DE", ac: "#C594C5", d: true },
  "pastels-on-dark":         { bg: "#211E1E", fg: "#DADADA", ac: "#A165AC", d: true },
  "slush-and-poppies":       { bg: "#FFFFFF", fg: "#000000", ac: "#CC2200", d: false },
  "solarized-dark":          { bg: "#002B36", fg: "#839496", ac: "#268BD2", d: true },
  "solarized-light":         { bg: "#FDF6E3", fg: "#657B83", ac: "#268BD2", d: false },
  "spacecadet":              { bg: "#0D0D0D", fg: "#DDE6ED", ac: "#FF6600", d: true },
  "sunburst":                { bg: "#000000", fg: "#F8F8F8", ac: "#E28964", d: true },
  "textmate--mac-classic-":  { bg: "#FFFFFF", fg: "#000000", ac: "#0066FF", d: false },
  "tomorrow-night-blue":     { bg: "#002451", fg: "#FFFFFF", ac: "#FFC58F", d: true },
  "tomorrow-night-bright":   { bg: "#000000", fg: "#EAEAEA", ac: "#C397D8", d: true },
  "tomorrow-night-eighties": { bg: "#2D2D2D", fg: "#CCCCCC", ac: "#CC99CC", d: true },
  "tomorrow-night":          { bg: "#1D1F21", fg: "#C5C8C6", ac: "#B294BB", d: true },
  "tomorrow":                { bg: "#FFFFFF", fg: "#4D4D4C", ac: "#8959A8", d: false },
  "twilight":                { bg: "#141414", fg: "#F7F7F7", ac: "#CDA869", d: true },
  "upstream-sunburst":       { bg: "#000000", fg: "#F8F8F8", ac: "#E28964", d: true },
  "vibrant-ink":             { bg: "#000000", fg: "#FFFFFF", ac: "#FFCC00", d: true },
  "xcode-default":           { bg: "#FFFFFF", fg: "#000000", ac: "#C800A4", d: false },
  "zenburnesque":            { bg: "#404040", fg: "#DEDEDE", ac: "#7F9F7F", d: true },
  "iplastic":                { bg: "#EEEEEE", fg: "#333333", ac: "#0000FF", d: false },
  "idlefingers":             { bg: "#323232", fg: "#FFFFFF", ac: "#CC7833", d: true },
  "krtheme":                 { bg: "#0B0A09", fg: "#FCFFE0", ac: "#FFCB1F", d: true },
  "monoindustrial":          { bg: "#222C28", fg: "#FFFFFF", ac: "#A8B3AB", d: true },
};

/**
 * All theme IDs from the package.
 */
export function getAllMonacoThemeIds(): string[] {
  return Object.keys(themeList);
}
