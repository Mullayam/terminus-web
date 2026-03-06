/**
 * @module monaco-editor/lib/remote-providers
 *
 * Fetches a manifest + JSON data files from a remote BASE_URL and registers
 * Monaco language providers automatically. Supports 26 provider types.
 *
 * ─────────────────────────────────────────────────────────────
 * AUTO-FETCH MODE (with CDN)
 * ─────────────────────────────────────────────────────────────
 *
 *   import { registerRemoteProviders, fetchManifest, getAvailableLanguages } from "@/modules/monaco-editor";
 *
 *   // 1. Fetch manifest to show available languages in UI
 *   const manifest = await fetchManifest("https://cdn.jsdelivr.net/npm/@enjoys/context-engine/data");
 *   const languages = getAvailableLanguages(manifest);
 *   // → [{ id: "javascript", name: "JavaScript", providers: ["completion", "hover", ...] }, ...]
 *
 *   // 2. User clicks "Install" on a language
 *   const registration = await registerRemoteProviders(monaco, {
 *     baseUrl: "https://cdn.jsdelivr.net/npm/@enjoys/context-engine/data",
 *     languages: ["javascript"],           // only install selected languages
 *     providerTypes: ["completion", "hover"], // optional: filter provider types
 *   });
 *
 *   // 3. Uninstall
 *   registration.dispose();
 *
 * ─────────────────────────────────────────────────────────────
 * MANUAL MODE (individual adapters)
 * ─────────────────────────────────────────────────────────────
 *
 *   import { createCompletionProvider, createHoverProvider } from "@/modules/monaco-editor";
 *
 *   const data = await fetch("/my-api/completions.json").then(r => r.json());
 *   const disposable = createCompletionProvider(monaco, "javascript", data);
 *
 * ─────────────────────────────────────────────────────────────
 * MANIFEST FORMATS (auto-detected)
 * ─────────────────────────────────────────────────────────────
 *
 * Format A: Language-first (CDN style, @enjoys/context-engine)
 *
 *   {
 *     "version": "1.0.0",
 *     "languages": [
 *       {
 *         "id": "javascript",
 *         "name": "JavaScript",
 *         "files": {
 *           "completion": "completion/javascript.json",
 *           "hover": "hover/javascript.json",
 *           "definition": "definition/javascript.json"
 *         }
 *       }
 *     ]
 *   }
 *
 * Format B: Provider-first (legacy)
 *
 *   {
 *     "version": "1.0.0",
 *     "languages": ["javascript", "typescript"],
 *     "providers": {
 *       "completion": {
 *         "javascript": "completion/javascript.json",
 *         "typescript": "completion/typescript.json"
 *       }
 *     }
 *   }
 *
 * ─────────────────────────────────────────────────────────────
 * SUPPORTED PROVIDER TYPES (26 total)
 * ─────────────────────────────────────────────────────────────
 *
 *   completion, definition, hover, codeActions, documentHighlight,
 *   documentSymbol, links, typeDefinition, references, implementation,
 *   inlineCompletions, formatting, codeLens, color, declaration,
 *   inlayHints, signatureHelp, linkedEditingRange, rangeFormatting,
 *   onTypeFormatting, foldingRange, rename, newSymbolNames,
 *   selectionRange, semanticTokens, rangeSemanticTokens
 */

import type * as monacoNs from "monaco-editor";
import type {
  RemoteProviderManifest,
  RemoteProviderConfig,
  RemoteProviderRegistration,
  ProviderKey,
  ProviderDataMap,
  LanguageEntry,
} from "./types";
import { isLanguageFirstManifest } from "./types";
import { ADAPTERS } from "./adapters";

type Monaco = typeof monacoNs;

/* ── Module-level tracking ─────────────────────────────────── */

const allDisposables: monacoNs.IDisposable[] = [];

/* ── Helpers ───────────────────────────────────────────────── */

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function fetchJson<T>(
  url: string,
  fetchOptions?: RequestInit,
): Promise<T> {
  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ── Transform language-first to provider-first ────────────── */

/**
 * Transform a language-first manifest (CDN style) to the provider-first format.
 * This allows the same registration logic to work with both formats.
 */
interface NormalizedManifest {
  version: string;
  name?: string;
  description?: string;
  languages: string[];
  providers: Partial<Record<ProviderKey, Record<string, string>>>;
}

function transformToProviderFirst(
  manifest: RemoteProviderManifest & { languages: LanguageEntry[] }
): NormalizedManifest {
  const providers: Record<string, Record<string, string>> = {};
  const languageIds: string[] = [];

  for (const lang of manifest.languages) {
    languageIds.push(lang.id);
    for (const [providerKey, filePath] of Object.entries(lang.files)) {
      if (!providers[providerKey]) {
        providers[providerKey] = {};
      }
      providers[providerKey][lang.id] = filePath;
    }
  }

  return {
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    languages: languageIds,
    providers,
  };
}

/**
 * Normalize a manifest to the provider-first format.
 * Supports both language-first (CDN style) and provider-first formats.
 */
function normalizeManifest(manifest: RemoteProviderManifest): NormalizedManifest {
  if (isLanguageFirstManifest(manifest)) {
    return transformToProviderFirst(manifest);
  }
  
  // Provider-first format
  return {
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    languages: manifest.languages as string[],
    providers: manifest.providers ?? {},
  };
}

/**
 * Get available languages from a manifest (supports both formats).
 * Useful for displaying in UI before installation.
 */
export function getAvailableLanguages(manifest: RemoteProviderManifest): Array<{
  id: string;
  name: string;
  providers: ProviderKey[];
}> {
  if (isLanguageFirstManifest(manifest)) {
    return manifest.languages.map((lang) => ({
      id: lang.id,
      name: lang.name,
      providers: Object.keys(lang.files) as ProviderKey[],
    }));
  }

  // Provider-first format - cast to the correct type since type guard already checked
  const langMap = new Map<string, Set<ProviderKey>>();
  const providerEntries = (manifest as { providers?: Record<string, Record<string, string>> }).providers ?? {};
  for (const [key, langFiles] of Object.entries(providerEntries)) {
    if (!langFiles) continue;
    for (const langId of Object.keys(langFiles)) {
      if (!langMap.has(langId)) {
        langMap.set(langId, new Set());
      }
      langMap.get(langId)!.add(key as ProviderKey);
    }
  }

  return Array.from(langMap.entries()).map(([id, providers]) => ({
    id,
    name: id, // No display name in provider-first format
    providers: Array.from(providers),
  }));
}

/* ── Fetch manifest ────────────────────────────────────────── */

/**
 * Fetch and parse the manifest file from a remote URL.
 */
export async function fetchManifest(
  baseUrl: string,
  manifestFile = "manifest.json",
  fetchOptions?: RequestInit,
): Promise<RemoteProviderManifest> {
  const url = `${normalizeBaseUrl(baseUrl)}/${manifestFile}`;
  return fetchJson<RemoteProviderManifest>(url, fetchOptions);
}

/* ── Main registration ─────────────────────────────────────── */

/**
 * Fetch a manifest + all referenced JSON data files and register
 * Monaco providers for each language/provider-type combination.
 *
 * Returns a `RemoteProviderRegistration` with a `dispose()` method
 * to unregister everything at once.
 */
export async function registerRemoteProviders(
  monaco: Monaco,
  config: RemoteProviderConfig,
): Promise<RemoteProviderRegistration> {
  const base = normalizeBaseUrl(config.baseUrl);
  const rawManifest = await fetchManifest(
    base,
    config.manifestFile,
    config.fetchOptions,
  );

  // Auto-detect and normalize manifest format
  const normalized = normalizeManifest(rawManifest);

  const disposables: monacoNs.IDisposable[] = [];
  const registered = new Map<string, Set<ProviderKey>>();

  // Determine which languages and provider types to process
  const allowedLangs = config.languages
    ? new Set(config.languages)
    : null;
  const allowedTypes = config.providerTypes
    ? new Set(config.providerTypes)
    : null;

  // Collect all fetch tasks
  const tasks: Array<{
    key: ProviderKey;
    langId: string;
    url: string;
  }> = [];

  for (const [key, langMap] of Object.entries(normalized.providers)) {
    const providerKey = key as ProviderKey;
    if (allowedTypes && !allowedTypes.has(providerKey)) continue;
    if (!langMap) continue;

    for (const [langId, relativePath] of Object.entries(langMap)) {
      if (allowedLangs && !allowedLangs.has(langId)) continue;
      tasks.push({
        key: providerKey,
        langId,
        url: `${base}/${relativePath}`,
      });
    }
  }

  // Fetch and register all providers concurrently
  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      const data = await fetchJson<ProviderDataMap[typeof task.key]>(
        task.url,
        config.fetchOptions,
      );

      const adapter = ADAPTERS[task.key] as (
        m: Monaco,
        l: string,
        d: ProviderDataMap[ProviderKey],
      ) => monacoNs.IDisposable;

      const disposable = adapter(monaco, task.langId, data);
      disposables.push(disposable);
      allDisposables.push(disposable);

      // Track what was registered
      if (!registered.has(task.langId)) {
        registered.set(task.langId, new Set());
      }
      registered.get(task.langId)!.add(task.key);
    }),
  );

  // Report errors via callback
  if (config.onError) {
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        config.onError!(tasks[i].key, tasks[i].langId, result.reason);
      }
    });
  }

  return {
    manifest: rawManifest,
    registered,
    dispose() {
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          // Swallow disposal errors
        }
      }
      disposables.length = 0;
      // Also remove from module-level tracking
      for (const d of disposables) {
        const idx = allDisposables.indexOf(d);
        if (idx !== -1) allDisposables.splice(idx, 1);
      }
    },
  };
}

/* ── Register from pre-fetched data ────────────────────────── */

/**
 * Register a single provider from pre-fetched JSON data.
 * Use this when you've already fetched the data yourself.
 *
 * ```ts
 * const data = await fetch("/api/hover/javascript.json").then(r => r.json());
 * const d = registerProviderFromData(monaco, "hover", "javascript", data);
 * ```
 */
export function registerProviderFromData<K extends ProviderKey>(
  monaco: Monaco,
  providerKey: K,
  langId: string,
  data: ProviderDataMap[K],
): monacoNs.IDisposable {
  const adapter = ADAPTERS[providerKey] as (
    m: Monaco,
    l: string,
    d: ProviderDataMap[K],
  ) => monacoNs.IDisposable;
  const disposable = adapter(monaco, langId, data);
  allDisposables.push(disposable);
  return disposable;
}

/* ── Global dispose ────────────────────────────────────────── */

/**
 * Dispose ALL remote providers registered across all calls.
 */
export function disposeAllRemoteProviders(): void {
  for (const d of allDisposables) {
    try {
      d.dispose();
    } catch {
      // Swallow disposal errors
    }
  }
  allDisposables.length = 0;
}

/* ── Re-exports ────────────────────────────────────────────── */

export type {
  RemoteProviderManifest,
  RemoteProviderConfig,
  RemoteProviderRegistration,
  ProviderKey,
  ProviderDataMap,
  LanguageEntry,
  // JSON data types (for manual mode consumers)
  CompletionData,
  CompletionItemData,
  DefinitionData,
  HoverData,
  CodeActionData,
  CodeActionItemData,
  DocumentHighlightData,
  DocumentSymbolData,
  DocumentSymbolPattern,
  LinkData,
  LinkPatternData,
  TypeDefinitionData,
  ReferenceData,
  ImplementationData,
  InlineCompletionData,
  InlineCompletionItemData,
  FormattingData,
  FormattingRuleData,
  CodeLensData,
  CodeLensPattern,
  ColorData,
  ColorPatternData,
  DeclarationData,
  InlayHintData,
  InlayHintPattern,
  SignatureHelpData,
  SignatureData,
  SignatureParameterData,
  LinkedEditingRangeData,
  RangeFormattingData,
  OnTypeFormattingData,
  OnTypeFormattingRule,
  FoldingRangeData,
  FoldingRangePattern,
  RenameData,
  NewSymbolNamesData,
  NewSymbolNameSuggestion,
  SelectionRangeData,
  SelectionRangePattern,
  SemanticTokensData,
  SemanticTokenPattern,
  RangeSemanticTokensData,
  JsonRange,
  JsonLocation,
  JsonMarkdownString,
  JsonCommand,
} from "./types";

export {
  createCompletionProvider,
  createDefinitionProvider,
  createHoverProvider,
  createCodeActionProvider,
  createDocumentHighlightProvider,
  createDocumentSymbolProvider,
  createLinkProvider,
  createTypeDefinitionProvider,
  createReferenceProvider,
  createImplementationProvider,
  createInlineCompletionsProvider,
  createFormattingProvider,
  createCodeLensProvider,
  createColorProvider,
  createDeclarationProvider,
  createInlayHintsProvider,
  createSignatureHelpProvider,
  createLinkedEditingRangeProvider,
  createRangeFormattingProvider,
  createOnTypeFormattingProvider,
  createFoldingRangeProvider,
  createRenameProvider,
  createNewSymbolNamesProvider,
  createSelectionRangeProvider,
  createSemanticTokensProvider,
  createRangeSemanticTokensProvider,
} from "./adapters";
