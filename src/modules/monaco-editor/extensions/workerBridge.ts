/**
 * @module monaco-editor/extensions/workerBridge
 *
 * Main-thread interface to the extension-loader Web Worker.
 *
 * Responsibilities:
 *   - Spawn / terminate the worker (lifecycle)
 *   - Send typed messages to request folder loads, index init, etc.
 *   - Receive structured data and register into Monaco (main-thread only)
 *
 * Monaco APIs (registerCompletionItemProvider, setLanguageConfiguration, …)
 * can only run on the main thread — the worker handles fetch + IDB, and
 * this bridge handles the last-mile Monaco registration.
 */

import type * as monacoNs from "monaco-editor";
import {
  registerSnippets,
  applyLanguageConfiguration,
  registerGrammar,
} from "./monacoRegistrar";
import { registerTheme } from "../core/theme-registry";
import { injectExtensionCss } from "./cssInjector";
import type { ExtensionContributions } from "./loaders/index";

// Vite ?worker import — resolved at build time
import ExtLoaderWorker from "./extension-loader.worker?worker";

type Monaco = typeof monacoNs;

/* ── Types ─────────────────────────────────────────────────── */

interface WorkerResponse {
  type: "folder-loaded" | "index-ready" | "prefetch-done" | "error" | "ready";
  folder?: string;
  data?: ExtensionContributions | string[];
  error?: string;
}

type FolderCallback = (data: ExtensionContributions | null, err?: string) => void;
type IndexCallback = (folders: string[], err?: string) => void;

/* ── State ─────────────────────────────────────────────────── */

let worker: Worker | null = null;
let monacoInstance: Monaco | null = null;
let workerReady = false;

/** Pending resolve callbacks keyed by `type:folder` */
const pendingFolderCallbacks = new Map<string, FolderCallback>();
let pendingIndexCallback: IndexCallback | null = null;
let pendingPrefetchResolve: (() => void) | null = null;

/* ── Lifecycle ─────────────────────────────────────────────── */

/**
 * Spawn the extension-loader Web Worker.
 * Must be called once, typically in `onMount`.
 *
 * @param monaco  Current Monaco namespace (needed for registrations)
 * @returns       `true` if worker was created, `false` if already running
 */
export function spawnExtensionWorker(monaco: Monaco): boolean {
  if (worker) return false;

  monacoInstance = monaco;

  worker = new ExtLoaderWorker();
  worker.onmessage = handleWorkerMessage;
  worker.onerror = (e) => {
    console.error("[ext-bridge] Worker error:", e);
  };

  return true;
}

/**
 * Terminate the worker and clean up state.
 */
export function terminateExtensionWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  monacoInstance = null;
  workerReady = false;
  pendingFolderCallbacks.clear();
  pendingIndexCallback = null;
  pendingPrefetchResolve = null;
}

/**
 * Check if the worker is alive and ready.
 */
export function isWorkerReady(): boolean {
  return worker !== null && workerReady;
}

/* ── Public API ────────────────────────────────────────────── */

/**
 * Request the worker to initialise the extension folder index from GitHub.
 * Resolves with the folder name array.
 */
export function workerInitIndex(token?: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error("[ext-bridge] Worker not spawned"));
      return;
    }
    pendingIndexCallback = (folders, err) => {
      pendingIndexCallback = null;
      if (err) reject(new Error(err));
      else resolve(folders);
    };
    worker.postMessage({ type: "init-index", token });
  });
}

/**
 * Request the worker to load a single extension folder's contributions.
 * On completion, the bridge auto-registers results into Monaco.
 *
 * Resolves with the contribution data (or null).
 */
export function workerLoadFolder(
  folder: string,
  token?: string,
): Promise<ExtensionContributions | null> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error("[ext-bridge] Worker not spawned"));
      return;
    }
    pendingFolderCallbacks.set(folder, (data, err) => {
      pendingFolderCallbacks.delete(folder);
      if (err) reject(new Error(err));
      else resolve(data);
    });
    worker.postMessage({ type: "load-folder", folder, token });
  });
}

/**
 * Prefetch popular extensions in the background.
 * Worker loads them into IDB; main-thread registration happens lazily
 * when a file of that language is opened.
 */
export function workerPrefetchPopular(
  folders: string[],
  token?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error("[ext-bridge] Worker not spawned"));
      return;
    }
    pendingPrefetchResolve = () => {
      pendingPrefetchResolve = null;
      resolve();
    };
    worker.postMessage({ type: "prefetch-popular", folders, token });
  });
}

/* ── Message handler ──────────────────────────────────────── */

function handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
  const msg = event.data;

  switch (msg.type) {
    case "ready":
      workerReady = true;
      console.log("[ext-bridge] Worker ready");
      break;

    case "index-ready": {
      const folders = (msg.data ?? []) as string[];
      console.log(`[ext-bridge] Index ready: ${folders.length} folders`);
      pendingIndexCallback?.(folders);
      break;
    }

    case "folder-loaded": {
      const folder = msg.folder ?? "";
      const data = msg.data as ExtensionContributions | undefined;

      if (data && monacoInstance) {
        registerContributions(monacoInstance, data);
      }

      const cb = pendingFolderCallbacks.get(folder);
      cb?.(data ?? null);
      break;
    }

    case "prefetch-done":
      console.log("[ext-bridge] Prefetch done");
      pendingPrefetchResolve?.();
      break;

    case "error": {
      console.warn(`[ext-bridge] Worker error for "${msg.folder}":`, msg.error);
      if (msg.folder) {
        const cb = pendingFolderCallbacks.get(msg.folder);
        cb?.(null, msg.error);
      } else {
        pendingIndexCallback?.([], msg.error);
      }
      break;
    }
  }
}

/* ── Monaco registration (main thread only) ───────────────── */

/**
 * Take the contribution data returned by the worker and wire it into Monaco.
 */
function registerContributions(monaco: Monaco, data: ExtensionContributions): void {
  // ── Language configurations ──
  for (const lc of data.languages) {
    applyLanguageConfiguration(monaco, lc.langId, lc.config);
  }

  // ── Grammars ──
  for (const g of data.grammars) {
    if (g.language) {
      registerGrammar(monaco, g.language, g.scopeName, g.grammar);
    }
  }

  // ── Snippets ──
  for (const s of data.snippets) {
    // Build a Map<string, unknown> wrapper that registerSnippets expects
    const snippetMap = new Map<string, unknown>();
    const fileContent: Record<string, { prefix: string[]; body: string; description: string }> = {};

    for (const entry of s.entries) {
      fileContent[entry.name] = {
        prefix: entry.prefix,
        body: entry.body,
        description: entry.description,
      };
    }
    snippetMap.set(`worker-${data.folder}`, fileContent);
    registerSnippets(monaco, s.language, snippetMap);
  }

  // Semantic scopes are already persisted in IDB by the worker.
  // Future: wire into a semantic token provider here if needed.

  // ── Themes ──
  for (const t of data.themes) {
    registerTheme(monaco, {
      id: t.id,
      name: t.name,
      base: t.base,
      inherit: t.inherit,
      rules: t.rules,
      colors: t.colors,
    });
  }

  // ── CSS injection ──
  for (const c of data.css) {
    injectExtensionCss(data.folder, c.path, c.content);
  }

  console.log(
    `[ext-bridge] Registered contributions for "${data.folder}":`,
    `${data.languages.length} lang-configs,`,
    `${data.grammars.length} grammars,`,
    `${data.snippets.length} snippet sets,`,
    `${data.themes.length} themes,`,
    `${data.css.length} css files`,
  );
}
