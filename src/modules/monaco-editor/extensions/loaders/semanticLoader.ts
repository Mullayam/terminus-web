/**
 * @module monaco-editor/extensions/loaders/semanticLoader
 *
 * SRP: Stores semantic token scope mappings (from package.json contributes)
 * into IDB. No file fetching needed — the data lives inline in package.json.
 */

import { idbSet, STORE_ASSETS } from "../idb";
import type { SemanticTokenScopeContribution } from "../packageReader";

/* ── Result type ──────────────────────────────────────────── */

export interface SemanticScopeData {
  language: string;
  scopes: Record<string, string[]>;
}

/* ── Public ───────────────────────────────────────────────── */

/**
 * Store semantic token scope mappings in IDB for later use
 * by the semantic token provider.
 *
 * No network calls — data comes directly from package.json.
 */
export async function storeSemanticTokenScopes(
  folder: string,
  semanticTokenScopes: SemanticTokenScopeContribution[],
): Promise<SemanticScopeData[]> {
  const results: SemanticScopeData[] = [];

  for (const entry of semanticTokenScopes) {
    if (!entry.language || !entry.scopes) continue;

    const idbKey = `ext:${folder}:semantic-scopes:${entry.language}`;
    await idbSet(STORE_ASSETS, idbKey, JSON.stringify(entry.scopes));

    results.push({ language: entry.language, scopes: entry.scopes });
    console.log(`[monaco-ext] Semantic token scopes stored: ${entry.language}`);
  }

  return results;
}
