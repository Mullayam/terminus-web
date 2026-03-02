/**
 * @module monaco-editor/extensions/manager
 *
 * High-level orchestrator for the GitHub-based VSCode extension loader.
 *
 * Two primary entry points:
 *   - `initExtensionIndex()` — Fetch the top-level extension folder list
 *     from GitHub and persist to IDB. Called once on editor mount.
 *   - `onFileOpened(filePath, monaco)` — Resolve the file's language,
 *     fetch the matching extension's assets (lazy, cache-first), and
 *     register snippets + language-config into Monaco.
 *
 * Also supports loading from custom / user-provided URLs.
 */

import type * as monacoNs from "monaco-editor";
import { idbGet, idbSet, STORE_INDEX } from "./idb";
import { listExtensionFolders, type GitHubEntry } from "./githubApi";
import {
  loadExtensionAssets,
  isExtensionLoaded,
} from "./assetLoader";
import { resolveFileLanguage, getExtensionFolder } from "./languageMap";
import {
  registerSnippets,
  applyLanguageConfiguration,
  registerGrammar,
  resetRegistrarState,
} from "./monacoRegistrar";
import { loadAllContributions, resetLoaders } from "./loaders/index";

type Monaco = typeof monacoNs;

/* ── State ─────────────────────────────────────────────────── */

/** Whether the top-level index has been fetched in this session */
let indexInitialized = false;

/** Set of language IDs that have already been fully loaded */
const fullyLoadedLanguages = new Set<string>();

/** List of custom snippet URLs added by the user */
const customSnippetUrls: string[] = [];

/** Optional GitHub token for higher rate limits */
let _githubToken: string | undefined;

/* ── Index Key ─────────────────────────────────────────────── */

const INDEX_LIST_KEY = "ext-index::folder-list";

/* ── Configuration ─────────────────────────────────────────── */

/**
 * Set a GitHub token for authenticated API requests (60→5000 req/h).
 */
export function setGitHubToken(token: string): void {
  _githubToken = token;
}

/* ── Init: Extension index ─────────────────────────────────── */

/**
 * Fetch the list of all extension folders from GitHub and persist to IDB.
 * This is a lightweight operation — it only fetches the top-level listing.
 * Individual extension assets are loaded lazily on `onFileOpened`.
 *
 * If the index already exists in IDB it is returned from cache.
 */
export async function initExtensionIndex(
  opts?: { baseUrl?: string; token?: string; force?: boolean },
): Promise<string[]> {
  const token = opts?.token ?? _githubToken;

  // Return cached index if available
  if (!opts?.force) {
    const cached = await idbGet(STORE_INDEX, INDEX_LIST_KEY);
    if (cached) {
      try {
        const folders = JSON.parse(cached) as string[];
        indexInitialized = true;
        return folders;
      } catch {
        // Corrupted cache, re-fetch
      }
    }
  }

  try {
    const entries: GitHubEntry[] = await listExtensionFolders({
      baseUrl: opts?.baseUrl,
      token,
    });

    const folderNames = entries.map((e) => e.name);
    await idbSet(STORE_INDEX, INDEX_LIST_KEY, JSON.stringify(folderNames));
    indexInitialized = true;
    console.log(`[ext-manager] Indexed ${folderNames.length} extension folders`);
    return folderNames;
  } catch (err) {
    console.warn("[ext-manager] Failed to fetch extension index:", err);
    return [];
  }
}

/* ── On File Opened ────────────────────────────────────────── */

/**
 * Called when the user opens a file. Resolves the language, lazily
 * downloads the matching extension's assets, and registers them
 * with Monaco.
 *
 * @param filePath  - The file path (e.g. "main.py")
 * @param monaco    - The Monaco namespace
 * @param editor    - Optional editor instance
 * @returns Object with the languageId and what was registered
 */
export async function onFileOpened(
  filePath: string,
  monaco: Monaco,
  _editor?: monacoNs.editor.ICodeEditor,
): Promise<{
  languageId: string | null;
  snippetsRegistered: boolean;
  langConfigApplied: boolean;
  grammarsRegistered: number;
}> {
  const { languageId, extensionFolder } = resolveFileLanguage(filePath);

  const result = {
    languageId,
    snippetsRegistered: false,
    langConfigApplied: false,
    grammarsRegistered: 0,
  };

  if (!languageId) return result;

  // Already fully loaded for this language
  if (fullyLoadedLanguages.has(languageId)) return result;

  const folder = extensionFolder;
  if (!folder) return result;

  try {
    // Ensure package.json is in IDB
    const loaded = await isExtensionLoaded(folder);
    if (!loaded) {
      console.log(`[ext-manager] Fetching package.json for "${folder}" (lang: ${languageId})`);
      await loadExtensionAssets(folder, {
        baseUrl: undefined,
        token: _githubToken,
      });
    }

    // Run all loaders — they read paths from package.json contributes
    // (languages[].configuration, grammars[].path, snippets[].path)
    // and fetch those files dynamically — nothing hardcoded.
    const contributions = await loadAllContributions(folder);
    if (contributions) {
      // ── Register language configurations ──
      for (const lc of contributions.languages) {
        applyLanguageConfiguration(monaco, lc.langId, lc.config);
        result.langConfigApplied = true;
      }

      // ── Register grammars ──
      for (const g of contributions.grammars) {
        if (g.language) {
          registerGrammar(monaco, g.language, g.scopeName, g.grammar);
          result.grammarsRegistered++;
        }
      }

      // ── Register snippets ──
      for (const s of contributions.snippets) {
        const snippetMap = new Map<string, unknown>();
        const fileContent: Record<string, { prefix: string[]; body: string; description: string }> = {};
        for (const entry of s.entries) {
          fileContent[entry.name] = {
            prefix: entry.prefix,
            body: entry.body,
            description: entry.description,
          };
        }
        snippetMap.set(`ext-${folder}`, fileContent);
        registerSnippets(monaco, s.language, snippetMap);
        result.snippetsRegistered = true;
      }
    }

    fullyLoadedLanguages.add(languageId);
  } catch (err) {
    console.warn(`[ext-manager] Failed to load extension for "${languageId}":`, err);
  }

  return result;
}

/* ── Custom Snippet URLs ───────────────────────────────────── */

/**
 * Load snippets from a raw URL (e.g., a GitHub raw content URL).
 * The URL should return a VS Code-compatible snippet JSON.
 *
 * @param url        - Raw URL returning snippet JSON
 * @param languageId - Target Monaco language ID
 * @param monaco     - Monaco namespace
 */
export async function loadSnippetsFromUrl(
  url: string,
  languageId: string,
  monaco: Monaco,
): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[ext-manager] Failed to fetch snippet from ${url}: ${res.status}`);
      return false;
    }

    const json = await res.json();
    if (!json || typeof json !== "object") return false;

    // Wrap in a Map for registerSnippets
    const snippetMap = new Map<string, unknown>();
    snippetMap.set("custom-" + Date.now(), json);

    registerSnippets(monaco, languageId, snippetMap);

    // Track it
    if (!customSnippetUrls.includes(url)) {
      customSnippetUrls.push(url);
    }

    console.log(`[ext-manager] Loaded custom snippets from ${url} for ${languageId}`);
    return true;
  } catch (err) {
    console.warn(`[ext-manager] Error loading snippet URL: ${url}`, err);
    return false;
  }
}

/**
 * Load snippets from all saved custom URLs.
 */
export async function loadAllCustomSnippets(
  monaco: Monaco,
  urls: Array<{ url: string; languageId: string }>,
): Promise<number> {
  let loaded = 0;
  for (const { url, languageId } of urls) {
    const ok = await loadSnippetsFromUrl(url, languageId, monaco);
    if (ok) loaded++;
  }
  return loaded;
}

/* ── Manual language load ──────────────────────────────────── */

/**
 * Manually load an extension folder by name (e.g. "python").
 * Useful for pre-loading before a file is opened.
 */
export async function loadExtensionByFolder(
  folder: string,
  languageId: string,
  monaco: Monaco,
): Promise<boolean> {
  try {
    const loaded = await isExtensionLoaded(folder);
    if (!loaded) {
      await loadExtensionAssets(folder, { token: _githubToken });
    }

    // Use loaders to read paths from package.json contributes dynamically
    const contributions = await loadAllContributions(folder);
    if (contributions) {
      for (const lc of contributions.languages) {
        applyLanguageConfiguration(monaco, lc.langId, lc.config);
      }
      for (const g of contributions.grammars) {
        if (g.language) registerGrammar(monaco, g.language, g.scopeName, g.grammar);
      }
      for (const s of contributions.snippets) {
        const snippetMap = new Map<string, unknown>();
        const fileContent: Record<string, { prefix: string[]; body: string; description: string }> = {};
        for (const entry of s.entries) {
          fileContent[entry.name] = { prefix: entry.prefix, body: entry.body, description: entry.description };
        }
        snippetMap.set(`ext-${folder}`, fileContent);
        registerSnippets(monaco, languageId, snippetMap);
      }
    }

    fullyLoadedLanguages.add(languageId);
    return true;
  } catch (err) {
    console.warn(`[ext-manager] Manual load failed for "${folder}":`, err);
    return false;
  }
}

/* ── Preload popular languages ─────────────────────────────── */

/**
 * Preload extensions for a set of popular languages.
 * Called optionally on idle to warm the cache.
 */
export async function preloadPopularExtensions(monaco: Monaco): Promise<void> {
  const popular = [
    { folder: "javascript", languageId: "javascript" },
    { folder: "typescript-basics", languageId: "typescript" },
    { folder: "python", languageId: "python" },
    { folder: "html", languageId: "html" },
    { folder: "css", languageId: "css" },
    { folder: "json", languageId: "json" },
  ];

  for (const { folder, languageId } of popular) {
    if (!fullyLoadedLanguages.has(languageId)) {
      await loadExtensionByFolder(folder, languageId, monaco).catch(() => {});
    }
  }
}

/* ── Cleanup ───────────────────────────────────────────────── */

/**
 * Reset all in-memory state. Does NOT clear IDB.
 */
export function resetManager(): void {
  indexInitialized = false;
  fullyLoadedLanguages.clear();
  customSnippetUrls.length = 0;
  resetRegistrarState();
  resetLoaders();
}

/**
 * Check if the index has been initialized.
 */
export function isIndexInitialized(): boolean {
  return indexInitialized;
}
