/**
 * @module monaco-editor/plugins/code-quality/prettier-service
 *
 * Lazy-loading Prettier formatting service.
 * Loads only the parser plugins needed for the current language.
 * Uses the CDN loader with CacheStorage backing.
 */

import {
  loadPrettierForLanguage,
  LANGUAGE_PRETTIER_MAP,
} from "./cdn-loader";

// ── Types ──────────────────────────────────────────────────────
interface PrettierOptions {
  tabWidth?: number;
  useTabs?: boolean;
  printWidth?: number;
  semi?: boolean;
  singleQuote?: boolean;
  trailingComma?: "all" | "es5" | "none";
  bracketSpacing?: boolean;
  arrowParens?: "always" | "avoid";
}

interface LoadedPrettier {
  prettier: { format: (code: string, opts: Record<string, unknown>) => Promise<string> };
  plugins: unknown[];
  parser: string;
}

// ── Per-language cache of loaded Prettier instances ─────────────
const prettierCache = new Map<string, LoadedPrettier>();
const loadingPromises = new Map<string, Promise<LoadedPrettier | null>>();

/**
 * Check if Prettier supports a given language.
 */
export function isPrettierSupported(languageId: string): boolean {
  return languageId in LANGUAGE_PRETTIER_MAP;
}

/**
 * Get or lazily load Prettier for a specific language.
 * Returns null if the language is not supported.
 * Deduplicates concurrent loads for the same language.
 */
async function getPrettier(
  languageId: string,
): Promise<LoadedPrettier | null> {
  if (prettierCache.has(languageId)) return prettierCache.get(languageId)!;

  // Deduplicate in-flight loads
  if (loadingPromises.has(languageId)) return loadingPromises.get(languageId)!;

  const promise = loadPrettierForLanguage(languageId).then((result) => {
    loadingPromises.delete(languageId);
    if (result) {
      prettierCache.set(languageId, result as LoadedPrettier);
    }
    return result as LoadedPrettier | null;
  });

  loadingPromises.set(languageId, promise);
  return promise;
}

/**
 * Format code using Prettier for the given language.
 * Returns the formatted code, or the original code on failure.
 */
export async function formatWithPrettier(
  code: string,
  languageId: string,
  options: PrettierOptions = {},
): Promise<string> {
  const loaded = await getPrettier(languageId);
  if (!loaded) return code;

  try {
    const formatted = await loaded.prettier.format(code, {
      parser: loaded.parser,
      plugins: loaded.plugins,
      tabWidth: options.tabWidth ?? 2,
      useTabs: options.useTabs ?? false,
      printWidth: options.printWidth ?? 80,
      semi: options.semi ?? true,
      singleQuote: options.singleQuote ?? false,
      trailingComma: options.trailingComma ?? "all",
      bracketSpacing: options.bracketSpacing ?? true,
      arrowParens: options.arrowParens ?? "always",
    });
    return formatted;
  } catch {
    // Return original on parse errors (user is mid-edit)
    return code;
  }
}

/**
 * Preload Prettier for a language in the background.
 * Useful when a file is opened — start loading before user formats.
 */
export function preloadPrettier(languageId: string): void {
  if (!isPrettierSupported(languageId)) return;
  getPrettier(languageId);
}
