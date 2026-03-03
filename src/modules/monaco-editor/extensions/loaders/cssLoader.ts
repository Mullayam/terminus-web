/**
 * @module monaco-editor/extensions/loaders/cssLoader
 *
 * SRP: Fetches CSS files declared in `contributes.css` from their paths,
 * and returns raw CSS strings. Injection into the DOM via `<style>` tags
 * happens on the main thread.
 */

import { idbGet, idbSet, STORE_ASSETS } from "../idb";
import { cachedFetch } from "../cache";
import type { CssContribution } from "../packageReader";

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
        console.warn(`[monaco-ext] GitHub rate limit hit while fetching CSS: ${url}`);
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
    console.warn(`[monaco-ext] CSS fetch error`, e);
    return null;
  }
}

/* ── State ────────────────────────────────────────────────── */

const loadedCss = new Set<string>();

/* ── Result type ──────────────────────────────────────────── */

export interface CssData {
  /** The relative path of the CSS file */
  path: string;
  /** Raw CSS content */
  content: string;
}

/* ── Public ───────────────────────────────────────────────── */

/**
 * Fetch and decode CSS files from `contributes.css`.
 * Returns raw CSS strings — injection happens on the main thread.
 */
export async function fetchCssFiles(
  folder: string,
  cssEntries: CssContribution[],
): Promise<CssData[]> {
  const results: CssData[] = [];

  for (const entry of cssEntries) {
    if (!entry.path) continue;
    const dedupKey = `${folder}:${entry.path}`;
    if (loadedCss.has(dedupKey)) continue;

    const idbKey = `ext:${folder}:css:${entry.path}`;
    let content = await idbGet(STORE_ASSETS, idbKey);

    if (!content) {
      const url = resolveGithubUrl(folder, entry.path);
      content = await fetchAndDecode(url);
      if (!content) continue;
      await idbSet(STORE_ASSETS, idbKey, content);
    }

    loadedCss.add(dedupKey);
    results.push({ path: entry.path, content });
    console.log(`[monaco-ext] CSS fetched: ${entry.path}`);
  }

  return results;
}

export function resetCssLoader(): void {
  loadedCss.clear();
}
