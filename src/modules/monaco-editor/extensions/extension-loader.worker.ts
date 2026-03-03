/**
 * @module monaco-editor/extensions/extension-loader.worker
 *
 * Dedicated Web Worker for loading VSCode extension contributions.
 *
 * Offloads GitHub fetches, base64 decoding, JSONC parsing, and IDB
 * writes off the main thread. The main thread sends a message with
 * the folder name and receives structured contribution data back.
 *
 * Messages IN  → { type, folder, token? }
 * Messages OUT → { type, folder, data?, error? }
 */

import { idbGet, idbSet, STORE_ASSETS, STORE_INDEX } from "./idb";
import { listDirectory, fetchRawFile, type GitHubEntry } from "./githubApi";
import {
  loadAllContributions,
  type ExtensionContributions,
} from "./loaders/index";
import { setGlobalFetchHeaders } from "./cache";

/* ── Message types ────────────────────────────────────────── */

interface LoadFolderRequest {
  type: "load-folder";
  folder: string;
  token?: string;
  baseUrl?: string;
}

interface InitIndexRequest {
  type: "init-index";
  token?: string;
  baseUrl?: string;
}

interface PrefetchRequest {
  type: "prefetch-popular";
  folders: string[];
  token?: string;
}

type WorkerRequest = LoadFolderRequest | InitIndexRequest | PrefetchRequest;

interface WorkerResponse {
  type: "folder-loaded" | "index-ready" | "prefetch-done" | "error";
  folder?: string;
  data?: ExtensionContributions | string[];
  error?: string;
}

/* ── Key helpers (duplicated from assetLoader for isolation) ── */

function indexKey(folder: string): string {
  return `folder::${folder}`;
}

/* ── Core: load a single extension folder + contributions ── */

/**
 * Load contributions for a single extension folder.
 *
 * Flow:
 *  1. Fetch the folder listing from GitHub
 *  2. Find and store package.json in IDB
 *  3. Call loadAllContributions() — reads package.json contributes,
 *     then each loader fetches the actual files by their DECLARED paths
 *     (e.g. languages[].configuration, grammars[].path, snippets[].path)
 *
 * NO hardcoded filenames — everything is driven by package.json contributes.
 */
async function loadFolder(
  folder: string,
  opts?: { baseUrl?: string; token?: string; prefetchOnly?: boolean },
): Promise<ExtensionContributions | null> {
  // 1. Check if package.json already in IDB
  const hasPackageJson = await idbGet(STORE_ASSETS, `ext:${folder}:package.json`);

  // 2. If not, fetch the folder listing and store package.json
  if (!hasPackageJson) {
    try {
      const entries = await listDirectory(folder, opts);
      const entryMap = new Map(entries.map((e) => [e.name.toLowerCase(), e]));

      // Only need package.json — loaders will fetch individual files
      // by reading the actual paths from contributes fields
      const pkgEntry = entryMap.get("package.json");
      if (pkgEntry && pkgEntry.type === "file") {
        await loadJsonAndStore(pkgEntry, `ext:${folder}:package.json`, opts);
      }

      // Mark as indexed
      await idbSet(STORE_INDEX, indexKey(folder), JSON.stringify({
        folder,
        loadedAt: Date.now(),
      }));
    } catch (err) {
      console.warn(`[ext-worker] Failed to fetch package.json for "${folder}":`, err);
    }
  }

  // 3. Run all loaders — they read package.json from IDB,
  //    parse contributes, and fetch files by their declared paths.
  //    When prefetching, use `skipDedup` so the folder is NOT marked
  //    as loaded — the real load happens when a file is opened.
  const contributions = await loadAllContributions(folder, {
    skipDedup: opts?.prefetchOnly,
  });
  return contributions;
}

/* ── Helpers ──────────────────────────────────────────────── */

async function loadJsonAndStore(
  entry: GitHubEntry,
  idbKey: string,
  opts?: { baseUrl?: string; token?: string },
): Promise<void> {
  try {
    const text = await fetchRawFile(entry, opts);
    const parsed = JSON.parse(text);
    await idbSet(STORE_ASSETS, idbKey, JSON.stringify(parsed));
  } catch (e) {
    console.warn(`[ext-worker] Failed to load/store ${idbKey}:`, e);
  }
}

/* ── Init index (fetch top-level folder list) ─────────────── */

async function initIndex(
  opts?: { baseUrl?: string; token?: string },
): Promise<string[]> {
  const INDEX_LIST_KEY = "ext-index::folder-list";
  const INDEX_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Return cached if valid and not expired
  const cached = await idbGet(STORE_INDEX, INDEX_LIST_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as
        | string[]
        | { folders: string[]; fetchedAt: number };

      // Legacy plain array — treat as valid
      if (Array.isArray(parsed)) return parsed;

      // Check 7-day TTL
      if (
        parsed.folders &&
        parsed.fetchedAt &&
        Date.now() - parsed.fetchedAt < INDEX_TTL_MS
      ) {
        return parsed.folders;
      }

      console.log("[ext-worker] Index cache expired (>7 days), re-fetching");
    } catch {
      // corrupted, re-fetch
    }
  }

  try {
    // Dynamic import to avoid circular deps in worker
    const { listExtensionFolders } = await import("./githubApi");
    const entries = await listExtensionFolders(opts);
    const folders = entries.map((e) => e.name);
    await idbSet(
      STORE_INDEX,
      INDEX_LIST_KEY,
      JSON.stringify({ folders, fetchedAt: Date.now() }),
    );
    return folders;
  } catch (err) {
    console.warn("[ext-worker] Failed to init index:", err);
    return [];
  }
}

/* ── Message handler ──────────────────────────────────────── */

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case "load-folder": {
        if (msg.token) setGlobalFetchHeaders(msg.token);
        const data = await loadFolder(msg.folder, {
          token: msg.token,
          baseUrl: msg.baseUrl,
        });
        const response: WorkerResponse = {
          type: "folder-loaded",
          folder: msg.folder,
          data: data ?? undefined,
        };
        self.postMessage(response);
        break;
      }

      case "init-index": {
        if (msg.token) setGlobalFetchHeaders(msg.token);
        const folders = await initIndex({
          token: msg.token,
          baseUrl: msg.baseUrl,
        });
        const response: WorkerResponse = {
          type: "index-ready",
          data: folders,
        };
        self.postMessage(response);
        break;
      }

      case "prefetch-popular": {
        if (msg.token) setGlobalFetchHeaders(msg.token);
        for (const folder of msg.folders) {
          try {
            await loadFolder(folder, { token: msg.token, prefetchOnly: true });
          } catch {
            // skip individual failures
          }
        }
        const response: WorkerResponse = {
          type: "prefetch-done",
        };
        self.postMessage(response);
        break;
      }
    }
  } catch (err) {
    const response: WorkerResponse = {
      type: "error",
      folder: "folder" in msg ? msg.folder : undefined,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};

// Signal ready
self.postMessage({ type: "ready" });
