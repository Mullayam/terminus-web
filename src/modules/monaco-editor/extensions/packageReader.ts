/**
 * @module monaco-editor/extensions/packageReader
 *
 * Reads a VSCode extension's `package.json` from IDB (stored by assetLoader)
 * and parses the `contributes` field into structured types.
 *
 * Single Responsibility: only reads + parses — loading is delegated to loaders/.
 */

import { idbGet, STORE_ASSETS } from "./idb";

/* ── Contribution Types ──────────────────────────────────── */

export interface LanguageContribution {
  id: string;
  aliases?: string[];
  extensions?: string[];
  filenames?: string[];
  firstLine?: string;
  mimetypes?: string[];
  /** Relative path to language-configuration.json (e.g. "./language-configuration.json") */
  configuration?: string;
}

export interface GrammarContribution {
  /** Monaco language ID this grammar applies to */
  language?: string;
  /** TextMate scope name (e.g. "source.js") */
  scopeName: string;
  /** Relative path to .tmLanguage.json file */
  path: string;
  /** Scopes for embedded languages */
  embeddedLanguages?: Record<string, string>;
  /** Token type overrides */
  tokenTypes?: Record<string, string>;
}

export interface SemanticTokenScopeContribution {
  language: string;
  /** Semantic token type → TextMate scope mappings */
  scopes: Record<string, string[]>;
}

export interface SnippetContribution {
  /** Monaco language ID */
  language: string;
  /** Relative path to snippet file */
  path: string;
}

export interface ThemeContribution {
  /** Unique theme ID (e.g. "one-dark-pro") */
  id: string;
  /** Display name shown in theme picker */
  label: string;
  /** Base UI theme: maps to Monaco base ("vs", "vs-dark", "hc-black", "hc-light") */
  uiTheme: string;
  /** Relative path to the theme JSON file (e.g. "./themes/one-dark-pro.json") */
  path: string;
}

export interface CssContribution {
  /** Relative path to a CSS file to inject (e.g. "./css/icons.css") */
  path: string;
}

export interface ContributesResult {
  folder: string;
  languages: LanguageContribution[];
  grammars: GrammarContribution[];
  semanticTokenScopes: SemanticTokenScopeContribution[];
  snippets: SnippetContribution[];
  themes: ThemeContribution[];
  css: CssContribution[];
}

/* ── Reader ───────────────────────────────────────────────── */

/**
 * Read and parse `package.json` for a given extension folder from IDB.
 *
 * The package.json must already be stored by `assetLoader` under key
 * `ext:{folder}:package.json`.
 *
 * Returns null if not found or unparseable.
 */
export async function readPackageJson(folder: string): Promise<ContributesResult | null> {
  // Key must match the one assetLoader uses to store package.json
  const raw = await idbGet(STORE_ASSETS, `ext:${folder}:package.json`);
  if (!raw) {
    console.warn(`[monaco-ext] No package.json in IDB for: ${folder}`);
    return null;
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw);
  } catch (e) {
    console.warn(`[monaco-ext] Failed to parse package.json for: ${folder}`, e);
    return null;
  }

  const contributes = (pkg.contributes ?? {}) as Record<string, unknown>;

  return {
    folder,
    languages: Array.isArray(contributes.languages) ? contributes.languages : [],
    grammars: Array.isArray(contributes.grammars) ? contributes.grammars : [],
    semanticTokenScopes: Array.isArray(contributes.semanticTokenScopes)
      ? contributes.semanticTokenScopes
      : [],
    snippets: Array.isArray(contributes.snippets) ? contributes.snippets : [],
    themes: Array.isArray(contributes.themes) ? contributes.themes : [],
    css: Array.isArray(contributes.css) ? contributes.css : [],
  };
}
