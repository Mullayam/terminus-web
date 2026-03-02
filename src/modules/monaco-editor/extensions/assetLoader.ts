/**
 * @module monaco-editor/extensions/assetLoader
 *
 * Fetches the extension folder listing from GitHub and stores
 * `package.json` in IDB. Individual contribution files (lang-config,
 * grammars, snippets) are fetched by the dedicated loaders which read
 * the **declared paths** from `contributes` — nothing is hardcoded.
 */

import { idbGet, idbSet, STORE_ASSETS, STORE_INDEX } from "./idb";
import {
  listDirectory,
  fetchRawFile,
  type GitHubEntry,
} from "./githubApi";

/* ── Key helpers ──────────────────────────────────────────── */

/** Build a storage key for extension index */
export function indexKey(folder: string): string {
  return `folder::${folder}`;
}

/** Build a storage key for an asset */
export function assetKey(folder: string, kind: string, name?: string): string {
  return name
    ? `ext::${folder}::${kind}::${name}`
    : `ext::${folder}::${kind}`;
}

/* ── Types ─────────────────────────────────────────────────── */

export interface ExtensionAssets {
  snippets: Map<string, unknown>;          // filename → parsed JSON
  languageConfig: unknown | null;          // language-configuration.json parsed
  grammars: Map<string, unknown>;          // filename → parsed JSON
}

/* ── Loading logic ────────────────────────────────────────── */

/**
 * Load all assets from a single VSCode extension folder.
 *
 * Only fetches and stores `package.json` into IDB. The actual contribution
 * files (language-config, grammars, snippets) are fetched by the individual
 * loaders which read the **declared paths** from `contributes` — not
 * hardcoded filenames.
 *
 * Returns the parsed assets (also persisted in IDB).
 */
export async function loadExtensionAssets(
  folder: string,
  opts?: { baseUrl?: string; token?: string },
): Promise<ExtensionAssets> {
  const assets: ExtensionAssets = {
    snippets: new Map(),
    languageConfig: null,
    grammars: new Map(),
  };

  try {
    const entries = await listDirectory(folder, opts);
    const entryMap = new Map(entries.map((e) => [e.name.toLowerCase(), e]));

    // ── Store package.json ────────────────────────────────
    // This is the ONLY file we fetch here.
    // Loaders read contributes.languages[].configuration,
    //   contributes.grammars[].path, contributes.snippets[].path
    // and fetch those files by their DECLARED paths — no hardcoded names.
    const pkgJsonEntry = entryMap.get("package.json");
    if (pkgJsonEntry && pkgJsonEntry.type === "file") {
      const parsed = await loadJsonFile(pkgJsonEntry, opts);
      if (parsed) {
        await idbSet(
          STORE_ASSETS,
          `ext:${folder}:package.json`,
          JSON.stringify(parsed),
        );
      }
    }

    // Mark folder as indexed
    await idbSet(STORE_INDEX, indexKey(folder), JSON.stringify({
      folder,
      loadedAt: Date.now(),
    }));
  } catch (err) {
    console.warn(`[ext-loader] Failed to load assets for "${folder}":`, err);
  }

  return assets;
}

/**
 * Check if an extension folder was already loaded (exists in IDB index).
 */
export async function isExtensionLoaded(folder: string): Promise<boolean> {
  const data = await idbGet(STORE_INDEX, indexKey(folder));
  return data !== null;
}

/**
 * Get a single asset from IDB by key.
 */
export async function getAsset(key: string): Promise<string | null> {
  return idbGet(STORE_ASSETS, key);
}

/* ── Internal helpers ─────────────────────────────────────── */

async function loadJsonFile(
  entry: GitHubEntry,
  opts?: { baseUrl?: string; token?: string },
): Promise<unknown | null> {
  try {
    const text = await fetchRawFile(entry, opts);
    return JSON.parse(text);
  } catch {
    return null;
  }
}
