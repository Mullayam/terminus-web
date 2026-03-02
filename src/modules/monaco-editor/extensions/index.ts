/**
 * @module monaco-editor/extensions
 *
 * Public API barrel for the GitHub-based VSCode extension loader.
 *
 * Usage:
 * ```ts
 * import {
 *   initExtensionIndex,
 *   onFileOpened,
 *   loadSnippetsFromUrl,
 *   setGitHubToken,
 * } from "@/modules/monaco-editor/extensions";
 *
 * // On editor mount:
 * await initExtensionIndex();
 *
 * // When a file is opened:
 * await onFileOpened("main.py", monaco);
 *
 * // Load custom snippets from a URL:
 * await loadSnippetsFromUrl(
 *   "https://raw.githubusercontent.com/user/repo/main/snippets.json",
 *   "python",
 *   monaco
 * );
 * ```
 */

// Manager (high-level API)
export {
  initExtensionIndex,
  onFileOpened,
  loadSnippetsFromUrl,
  loadAllCustomSnippets,
  loadExtensionByFolder,
  preloadPopularExtensions,
  setGitHubToken,
  resetManager,
  isIndexInitialized,
} from "./manager";

// Asset loader
export {
  loadExtensionAssets,
  isExtensionLoaded,
  getAsset,
} from "./assetLoader";

// Registrar
export {
  registerSnippets,
  applyLanguageConfiguration,
  registerGrammar,
  disposeSnippets,
  disposeAllSnippets,
  resetRegistrarState,
} from "./monacoRegistrar";

// Language map
export {
  getLanguageFromExtension,
  getExtensionFolder,
  resolveFileLanguage,
  getAllKnownExtensions,
  getAllKnownLanguages,
} from "./languageMap";

// GitHub API
export {
  listExtensionFolders,
  fetchFileContent,
  fetchRawFile,
  walkDirectory,
} from "./githubApi";
export type { GitHubEntry, GitHubFileContent } from "./githubApi";

// Cache
export { cachedFetch, invalidateCache, clearExtensionCache } from "./cache";

// IDB (Dexie-based storage)
export { idbGet, idbSet, idbDelete, idbGetAllByPrefix, idbBulkPut, idbClearStore, getExtDb } from "./idb";
export type { StoreName, ExtensionIndexRecord, AssetRecord } from "./idb";

// Package reader
export { readPackageJson } from "./packageReader";
export type {
  LanguageContribution,
  GrammarContribution,
  SemanticTokenScopeContribution,
  SnippetContribution,
  ContributesResult,
} from "./packageReader";

// Loaders (data-only, no Monaco)
export {
  loadAllContributions,
  isFolderLoaded,
  resetLoaders,
  fetchLanguageConfigurations,
  fetchGrammars,
  fetchSnippets,
  storeSemanticTokenScopes,
} from "./loaders/index";
export type {
  ExtensionContributions,
  LanguageConfigData,
  GrammarData,
  SnippetData,
  SnippetEntry,
  SemanticScopeData,
} from "./loaders/index";

// Worker bridge (main-thread ↔ Web Worker)
export {
  spawnExtensionWorker,
  terminateExtensionWorker,
  isWorkerReady,
  workerInitIndex,
  workerLoadFolder,
  workerPrefetchPopular,
} from "./workerBridge";
