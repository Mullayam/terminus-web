/**
 * @module monaco-editor/core/language-registry
 *
 * Helpers for registering custom languages with Monaco.
 */

import type { Monaco, CustomLanguageDef } from "../types";

const registeredLanguages = new Set<string>();

/**
 * Register a custom language with Monaco.
 * Safe to call multiple times — skips if already registered.
 */
export function registerLanguage(monaco: Monaco, def: CustomLanguageDef): void {
  if (registeredLanguages.has(def.id)) return;

  monaco.languages.register({
    id: def.id,
    extensions: def.extensions,
    aliases: def.aliases,
    mimetypes: def.mimetypes,
  });

  if (def.monarchTokens) {
    monaco.languages.setMonarchTokensProvider(def.id, def.monarchTokens);
  }

  if (def.languageConfig) {
    monaco.languages.setLanguageConfiguration(def.id, def.languageConfig);
  }

  registeredLanguages.add(def.id);
}

/**
 * Register multiple custom languages.
 */
export function registerLanguages(monaco: Monaco, defs: CustomLanguageDef[]): void {
  for (const def of defs) {
    registerLanguage(monaco, def);
  }
}

/**
 * Check if a custom language was registered through this registry.
 */
export function isLanguageRegistered(id: string): boolean {
  return registeredLanguages.has(id);
}
