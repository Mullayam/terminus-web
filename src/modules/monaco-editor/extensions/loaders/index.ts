/**
 * @module monaco-editor/extensions/loaders
 *
 * Barrel & orchestrator – runs all four loaders via `loadAllContributions()`.
 *
 * Uses `readPackageJson()` to get contribution manifests, then fans out
 * to language / grammar / snippet / semantic loaders in parallel.
 *
 * The result is a plain data bag — no Monaco references — so it can be
 * returned from a Web Worker or evaluated on the main thread.
 */

import { readPackageJson, type ContributesResult } from "../packageReader";
import {
  fetchLanguageConfigurations,
  type LanguageConfigData,
} from "./languageLoader";
import { fetchGrammars, type GrammarData } from "./grammarLoader";
import { fetchSnippets, type SnippetData } from "./snippetLoader";
import {
  storeSemanticTokenScopes,
  type SemanticScopeData,
} from "./semanticLoader";

/* ── Re-exports ───────────────────────────────────────────── */

export type { LanguageConfigData } from "./languageLoader";
export type { GrammarData } from "./grammarLoader";
export type { SnippetData, SnippetEntry } from "./snippetLoader";
export type { SemanticScopeData } from "./semanticLoader";

export { fetchLanguageConfigurations } from "./languageLoader";
export { fetchGrammars } from "./grammarLoader";
export { fetchSnippets } from "./snippetLoader";
export { storeSemanticTokenScopes } from "./semanticLoader";

/* ── Aggregate result ─────────────────────────────────────── */

export interface ExtensionContributions {
  folder: string;
  languages: LanguageConfigData[];
  grammars: GrammarData[];
  snippets: SnippetData[];
  semanticScopes: SemanticScopeData[];
}

/* ── State ────────────────────────────────────────────────── */

const loadedFolders = new Set<string>();

/* ── Public ───────────────────────────────────────────────── */

/**
 * Load **all** contributions for a single extension folder:
 *
 *  1. Read `package.json` from IDB (must already be stored by assetLoader)
 *  2. Fan out to each individual loader in parallel
 *  3. Return structured data (no Monaco calls)
 *
 * Returns `null` if the folder has no package.json or was already loaded.
 */
export async function loadAllContributions(
  folder: string,
  opts?: { force?: boolean },
): Promise<ExtensionContributions | null> {
  if (!opts?.force && loadedFolders.has(folder)) {
    console.log(`[monaco-ext] Contributions already loaded for: ${folder}`);
    return null;
  }

  const manifest = await readPackageJson(folder);
  if (!manifest) return null;

  const [languageResult, grammarResult, snippetResult, semanticResult] =
    await Promise.allSettled([
      fetchLanguageConfigurations(folder, manifest.languages),
      fetchGrammars(folder, manifest.grammars),
      fetchSnippets(folder, manifest.snippets),
      storeSemanticTokenScopes(folder, manifest.semanticTokenScopes),
    ]);

  const contributions: ExtensionContributions = {
    folder,
    languages: languageResult.status === "fulfilled" ? languageResult.value : [],
    grammars: grammarResult.status === "fulfilled" ? grammarResult.value : [],
    snippets: snippetResult.status === "fulfilled" ? snippetResult.value : [],
    semanticScopes:
      semanticResult.status === "fulfilled" ? semanticResult.value : [],
  };

  loadedFolders.add(folder);

  console.log(
    `[monaco-ext] Contributions loaded for "${folder}":`,
    `${contributions.languages.length} lang-configs,`,
    `${contributions.grammars.length} grammars,`,
    `${contributions.snippets.length} snippet sets,`,
    `${contributions.semanticScopes.length} semantic scopes`,
  );

  return contributions;
}

/**
 * Check if a folder's contributions have already been loaded.
 */
export function isFolderLoaded(folder: string): boolean {
  return loadedFolders.has(folder);
}

/**
 * Reset loader state (not IDB). Call on full editor cleanup.
 */
export function resetLoaders(): void {
  loadedFolders.clear();
}
