/**
 * @module monaco-editor/extensions/loaders/languageLoader
 *
 * SRP: Fetches + registers language-configuration.json files.
 *
 * Reads the `configuration` path from each LanguageContribution,
 * fetches from GitHub (cache-first via IDB), strips comments,
 * parses, and calls `monaco.languages.setLanguageConfiguration()`.
 */

import { idbGet, idbSet, STORE_ASSETS } from "../idb";
import { cachedFetch } from "../cache";
import type { LanguageContribution } from "../packageReader";

/* ── Constants ────────────────────────────────────────────── */

const GITHUB_API_BASE = "https://api.github.com/repos/microsoft/vscode/contents";

/* ── Helpers ──────────────────────────────────────────────── */

function resolveGithubUrl(folder: string, relativePath: string): string {
  const cleanPath = relativePath.replace(/^\.\//, "");
  return `${GITHUB_API_BASE}/extensions/${folder}/${cleanPath}?ref=main`;
}

async function fetchAndDecode(url: string): Promise<string | null> {
  try {
    const res = await cachedFetch(url);
    if (!res.ok) {
      console.warn(`[monaco-ext] Fetch failed: ${url} (${res.status})`);
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
    console.warn(`[monaco-ext] Fetch error: ${url}`, e);
    return null;
  }
}

/** Strip // and /* comments from JSONC content. */
function stripJsonComments(text: string): string {
  return text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/* ── State ────────────────────────────────────────────────── */

const appliedLangs = new Set<string>();

/* ── Public ───────────────────────────────────────────────── */

/**
 * Result returned after attempting to load language configs.
 * Consumable by the web worker bridge without needing Monaco.
 */
export interface LanguageConfigData {
  langId: string;
  config: Record<string, unknown>;
}

/**
 * Fetch and parse language-configuration.json files.
 * Returns raw data — registration into Monaco happens on main thread.
 */
export async function fetchLanguageConfigurations(
  folder: string,
  languages: LanguageContribution[],
): Promise<LanguageConfigData[]> {
  const results: LanguageConfigData[] = [];

  for (const lang of languages) {
    if (!lang.id || !lang.configuration) continue;
    if (appliedLangs.has(lang.id)) continue;

    const idbKey = `ext:${folder}:lang-config:${lang.id}`;
    let content = await idbGet(STORE_ASSETS, idbKey);

    if (!content) {
      const url = resolveGithubUrl(folder, lang.configuration);
      content = await fetchAndDecode(url);
      if (!content) continue;
      await idbSet(STORE_ASSETS, idbKey, content);
    }

    try {
      const cleaned = stripJsonComments(content);
      const config = JSON.parse(cleaned);
      appliedLangs.add(lang.id);
      results.push({ langId: lang.id, config });
    } catch (e) {
      console.warn(`[monaco-ext] Parse failed for lang-config: ${lang.id}`, e);
    }
  }

  return results;
}

/**
 * Reset internal state (for testing / cleanup).
 */
export function resetLanguageLoader(): void {
  appliedLangs.clear();
}
