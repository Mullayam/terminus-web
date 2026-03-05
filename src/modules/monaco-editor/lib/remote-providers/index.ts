/**
 * @module monaco-editor/lib/remote-providers
 *
 * Fetches a manifest + JSON data files from a remote BASE_URL and registers
 * Monaco language providers automatically.
 *
 * ─────────────────────────────────────────────────────────────
 * AUTO-FETCH MODE
 * ─────────────────────────────────────────────────────────────
 *
 *   import { registerRemoteProviders } from "@/modules/monaco-editor";
 *
 *   const registration = await registerRemoteProviders(monaco, {
 *     baseUrl: "https://cdn.example.com/lang-pack/v1",
 *     languages: ["javascript", "typescript"],           // optional filter
 *     providerTypes: ["completion", "hover", "codeLens"], // optional filter
 *   });
 *
 *   // Later: clean up
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
 * MANIFEST FORMAT (BASE_URL/manifest.json)
 * ─────────────────────────────────────────────────────────────
 *
 *   {
 *     "name": "my-pack",
 *     "version": "1.0.0",
 *     "languages": ["javascript", "typescript"],
 *     "providers": {
 *       "completion": {
 *         "javascript": "completion/javascript.json",
 *         "typescript": "completion/typescript.json"
 *       },
 *       "hover": {
 *         "javascript": "hover/javascript.json"
 *       }
 *     }
 *   }
 */

import type * as monacoNs from "monaco-editor";
import type {
  RemoteProviderManifest,
  RemoteProviderConfig,
  RemoteProviderRegistration,
  ProviderKey,
  ProviderDataMap,
  PROVIDER_KEYS,
} from "./types";
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
  const manifest = await fetchManifest(
    base,
    config.manifestFile,
    config.fetchOptions,
  );

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

  for (const [key, langMap] of Object.entries(manifest.providers)) {
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
    manifest,
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
