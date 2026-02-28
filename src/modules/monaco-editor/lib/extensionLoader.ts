/**
 * @module lib/monaco/extensionLoader
 *
 * Loads installed extension data from IndexedDB into Monaco at runtime.
 * Handles:
 *  - Registering themes (defineTheme)
 *  - Registering contributed languages
 *  - Registering snippet completion providers
 *
 * Grammars from VSIX extensions are stored in IDB but language
 * highlighting relies on Monaco's built-in tokenizers + LSP semantic
 * tokens. No TextMate / vscode-oniguruma dependencies.
 *
 * Also provides the high-level `installExtensionFromOpenVSX()` function
 * that orchestrates: fetch metadata → download VSIX → extract → store → load.
 */

import type * as monacoNs from "monaco-editor";
import { refreshLanguageCache } from "../utils/language-detect";
import { convertVSCodeLanguageConfig } from "../utils/convert-language-config";

import { getExtension, downloadVSIX, type OpenVSXExtension } from "./openVSX";
import { extractVSIX, type VSIXContents, type ExtLanguage } from "./extractVSIX";
import {
  saveExtension,
  uninstallExtension,
  toggleExtension,
  getInstalledExtensions,
  getEnabledExtensions,
  getAllThemes,
  getAllGrammars,
  getSnippetsByLanguage,
  getThemeById,
  getGrammarByScope,
  type InstalledExtension,
  type StoredTheme,
  type StoredGrammar,
  type StoredSnippet,
} from "./extensionStorage";

type Monaco = typeof monacoNs;

/* ── State ─────────────────────────────────────────────────── */

/** Track which extension themes have been registered with Monaco */
const registeredThemes = new Set<string>();

/** Track which extension grammars/languages have been registered */
const registeredGrammars = new Set<string>();

/** Track snippet disposables per language (extension-contributed) */
const extensionSnippetDisposables = new Map<string, monacoNs.IDisposable[]>();

/** Install progress callback type */
export type InstallProgress = (
  stage: "fetching" | "downloading" | "extracting" | "storing" | "loading" | "done" | "error",
  detail?: string,
) => void;

/* ── Theme Loading ─────────────────────────────────────────── */

/**
 * Register a stored theme with Monaco's `defineTheme`.
 */
export function registerExtensionTheme(monaco: Monaco, theme: StoredTheme): void {
  if (registeredThemes.has(theme.themeId)) return;

  const content = theme.content as {
    type?: string;
    colors?: Record<string, string>;
    tokenColors?: Array<{
      name?: string;
      scope?: string | string[];
      settings: { foreground?: string; background?: string; fontStyle?: string };
    }>;
  };

  const base: "vs" | "vs-dark" | "hc-black" =
    theme.uiTheme === "vs" ? "vs" : theme.uiTheme === "hc-black" ? "hc-black" : "vs-dark";

  // Convert tokenColors to Monaco token rules
  const rules: monacoNs.editor.ITokenThemeRule[] = [];
  for (const entry of content.tokenColors ?? []) {
    const scopes = Array.isArray(entry.scope)
      ? entry.scope
      : entry.scope
        ? [entry.scope]
        : [];

    for (const scope of scopes) {
      const rule: monacoNs.editor.ITokenThemeRule = { token: scope };
      if (entry.settings.foreground) rule.foreground = entry.settings.foreground.replace("#", "");
      if (entry.settings.background) rule.background = entry.settings.background.replace("#", "");
      if (entry.settings.fontStyle) rule.fontStyle = entry.settings.fontStyle;
      rules.push(rule);
    }
  }

  try {
    monaco.editor.defineTheme(theme.themeId, {
      base,
      inherit: true,
      rules,
      colors: content.colors ?? {},
    });
  } catch (err) {
    // When @codingame/monaco-editor-wrapper replaces the standalone theme
    // service, defineTheme may not exist — themes are handled via VS Code
    // extension contributions instead.
    console.warn(`[extensionLoader] defineTheme("${theme.themeId}") unavailable:`, err);
  }

  registeredThemes.add(theme.themeId);
}

/**
 * Register all enabled extension themes with Monaco.
 */
export async function loadAllExtensionThemes(monaco: Monaco): Promise<string[]> {
  const themes = await getAllThemes();
  const loaded: string[] = [];
  for (const theme of themes) {
    try {
      registerExtensionTheme(monaco, theme);
      loaded.push(theme.themeId);
    } catch (err) {
      console.warn(`[extensionLoader] Failed to load theme "${theme.themeId}":`, err);
    }
  }
  return loaded;
}

/* ── Grammar / Language Registration ───────────────────────── */

/**
 * Register a grammar's associated language with Monaco.
 * The grammar content is stored in IDB but we don't wire TextMate;
 * Monaco's built-in tokenizer handles highlighting.
 */
export async function registerExtensionGrammar(
  monaco: Monaco,
  grammar: StoredGrammar,
  _editor?: monacoNs.editor.ICodeEditor,
): Promise<boolean> {
  if (registeredGrammars.has(grammar.scopeName)) return true;

  try {
    if (grammar.language) {
      // Ensure the language is registered with Monaco
      const existing = monaco.languages.getLanguages().find((l) => l.id === grammar.language);
      if (!existing) {
        monaco.languages.register({ id: grammar.language });
      }
      registeredGrammars.add(grammar.scopeName);
      return true;
    }

    return false;
  } catch (err) {
    console.warn(`[extensionLoader] Failed to register grammar language "${grammar.scopeName}":`, err);
    return false;
  }
}

/**
 * Load all enabled extension grammars.
 */
export async function loadAllExtensionGrammars(
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
): Promise<string[]> {
  const grammars = await getAllGrammars();
  const loaded: string[] = [];
  for (const grammar of grammars) {
    const ok = await registerExtensionGrammar(monaco, grammar, editor);
    if (ok) loaded.push(grammar.scopeName);
  }
  return loaded;
}

/* ── Snippet Loading ───────────────────────────────────────── */

/**
 * Register extension-contributed snippets for a specific language.
 */
export async function loadExtensionSnippets(
  monaco: Monaco,
  langId: string,
): Promise<monacoNs.IDisposable[]> {
  const snippets = await getSnippetsByLanguage(langId);
  if (snippets.length === 0) return [];

  // Dispose previous registrations for this language
  const existing = extensionSnippetDisposables.get(langId);
  if (existing) {
    existing.forEach((d) => d.dispose());
  }

  const disposables: monacoNs.IDisposable[] = [];

  for (const snippet of snippets) {
    const entries = Object.entries(snippet.content) as [string, {
      prefix: string | string[];
      body: string | string[];
      description?: string;
    }][];

    if (entries.length === 0) continue;

    const disposable = monaco.languages.registerCompletionItemProvider(langId, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range: monacoNs.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: monacoNs.languages.CompletionItem[] = entries.map(
          ([name, snip]) => {
            const prefixes = Array.isArray(snip.prefix) ? snip.prefix : [snip.prefix];
            const body = Array.isArray(snip.body) ? snip.body.join("\n") : snip.body;

            return {
              label: prefixes[0],
              kind: monaco.languages.CompletionItemKind.Snippet,
              documentation: snip.description
                ? { value: `**${name}**\n\n${snip.description}` }
                : undefined,
              insertText: body,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: `${name} (extension)`,
              range,
              filterText: prefixes.join(" "),
              sortText: `zzz_ext_${prefixes[0]}`,
            };
          },
        );

        return { suggestions };
      },
    });

    disposables.push(disposable);
  }

  extensionSnippetDisposables.set(langId, disposables);
  return disposables;
}

/* ── Language Registration ─────────────────────────────────── */

/**
 * Register contributed languages from enabled extensions.
 *
 * Uses the full `languageConfigs` stored in each extension record
 * (extensions, aliases, filenames) so Monaco can:
 *  1. Detect file types for extension-contributed languages
 *  2. List them in language pickers
 *
 * Falls back to grammar-based registration for older records that
 * don't have `languageConfigs` populated (backwards compatibility).
 */
export async function registerExtensionLanguages(monaco: Monaco): Promise<void> {
 try {
   const extensions = await getEnabledExtensions();
  const existingLangs = new Set(monaco.languages.getLanguages().map((l) => l.id));
  let registered = false;
  
  for (const ext of extensions) {
    // Prefer full language configs (new format with extensions/aliases/filenames)
    const langConfigs = ext.contributes.languageConfigs;
 
    if (langConfigs && langConfigs.length > 0) {
      for (const lang of langConfigs) {
        if (!existingLangs.has(lang.id)) {
          monaco.languages.register({
            id: lang.id,
            extensions: lang.extensions,
            aliases: lang.aliases,
            filenames: lang.filenames,
          });
          existingLangs.add(lang.id);
          registered = true;
        }

        // Apply language configuration (brackets, auto-close, comments, etc.)
        if (lang.configurationContent) {
          try {
            const monacoConfig = convertVSCodeLanguageConfig(lang.configurationContent);
            monaco.languages.setLanguageConfiguration(lang.id, monacoConfig);
          } catch (err) {
            console.warn(`[extensionLoader] Failed to set language config for "${lang.id}":`, err);
          }
        }
      }
    } else {
      // Backwards compatibility: register language IDs from grammar or language list
      const langIds = ext.contributes.languages ?? [];
      for (const langId of langIds) {
        if (typeof langId === "string" && !existingLangs.has(langId)) {
          monaco.languages.register({ id: langId });
          existingLangs.add(langId);
          registered = true;
        }
      }
    }
  }

  // Also check grammars for languages not yet registered
  const grammars = await getAllGrammars();
  for (const grammar of grammars) {
    if (grammar.language && !existingLangs.has(grammar.language)) {
      monaco.languages.register({ id: grammar.language });
      existingLangs.add(grammar.language);
      registered = true;
    }
  }

  // Refresh the language detection cache if we registered anything new
  if (registered) {
    refreshLanguageCache(monaco);
  }
 
 } catch (error) {
  console.log(error)
 }
}

/* ── Full Lifecycle ────────────────────────────────────────── */

/**
 * Load all resources from all enabled extensions into Monaco.
 * Call this once on editor initialization.
 */
export async function loadAllExtensions(
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
): Promise<{
  themes: string[];
  grammars: string[];
  extensions: InstalledExtension[];
}> {
  const extensions = await getEnabledExtensions();
 
  // Register languages first
  await registerExtensionLanguages(monaco);

  // Then themes and grammars
  const [themes, grammars] = await Promise.all([
    loadAllExtensionThemes(monaco),
    loadAllExtensionGrammars(monaco, editor),
  ]);

  return { themes, grammars, extensions };
}

/**
 * High-level: install an extension from Open VSX.
 *
 * 1. Fetch metadata from Open VSX
 * 2. Download the VSIX archive
 * 3. Extract contents (themes, grammars, snippets, etc.)
 * 4. Store everything in IndexedDB
 * 5. Load into the current Monaco editor
 *
 * @param publisher   Extension publisher (e.g. "Catppuccin")
 * @param name        Extension name (e.g. "catppuccin-vsc")
 * @param monaco      Monaco namespace
 * @param editor      Optional editor instance
 * @param onProgress  Progress callback
 */
export async function installExtensionFromOpenVSX(
  publisher: string,
  name: string,
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
  onProgress?: InstallProgress,
): Promise<InstalledExtension> {
  try {
    // 1. Fetch metadata
    onProgress?.("fetching", `${publisher}.${name}`);
    const extMeta = await getExtension(publisher, name);

    // 2. Download VSIX
    onProgress?.("downloading", `${extMeta.version}`);
    if (!extMeta.files.download) {
      throw new Error("No download URL found for this extension");
    }
    const buffer = await downloadVSIX(extMeta.files.download);

    // 3. Extract
    onProgress?.("extracting");
    const vsix = await extractVSIX(buffer);

    // 3b. Fetch README from Open VSX if not in VSIX
    let readme = vsix.readme;
    if (!readme && extMeta.files.readme) {
      try {
        const readmeRes = await fetch(extMeta.files.readme);
        if (readmeRes.ok) readme = await readmeRes.text();
      } catch { /* ignore README fetch failure */ }
    }

    // 4. Store in IDB
    onProgress?.("storing");
    const installed = await saveExtension(publisher, name, vsix, {
      displayName: extMeta.displayName,
      description: extMeta.description,
      version: extMeta.version,
      iconUrl: extMeta.files.icon,
      categories: extMeta.categories,
      readme,
    });

    // 5. Load into Monaco
    onProgress?.("loading");

    // Register contributed languages first (with extensions, aliases, filenames)
    const existingLangs = new Set(monaco.languages.getLanguages().map((l) => l.id));
    for (const lang of vsix.languages) {
      if (!existingLangs.has(lang.id)) {
        monaco.languages.register({
          id: lang.id,
          extensions: lang.extensions,
          aliases: lang.aliases,
          filenames: lang.filenames,
        });
        existingLangs.add(lang.id);
      }

      // Apply language configuration (brackets, auto-close, comments, etc.)
      if (lang.configurationContent) {
        try {
          const monacoConfig = convertVSCodeLanguageConfig(lang.configurationContent);
          monaco.languages.setLanguageConfiguration(lang.id, monacoConfig);
        } catch (err) {
          console.warn(`[extensionLoader] Failed to set language config for "${lang.id}":`, err);
        }
      }
    }

    // Refresh detection cache after registering new languages
    if (vsix.languages.length > 0) {
      refreshLanguageCache(monaco);
    }

    for (const theme of vsix.themes) {
      const storedTheme: StoredTheme = {
        id: `${installed.id}::${theme.id}`,
        extensionId: installed.id,
        themeId: theme.id,
        label: theme.label,
        uiTheme: theme.uiTheme,
        content: theme.content,
      };
      registerExtensionTheme(monaco, storedTheme);
    }

    for (const grammar of vsix.grammars) {
      const storedGrammar: StoredGrammar = {
        id: `${installed.id}::${grammar.scopeName}`,
        extensionId: installed.id,
        scopeName: grammar.scopeName,
        language: grammar.language,
        content: grammar.content,
        parsed: grammar.parsed,
      };
      await registerExtensionGrammar(monaco, storedGrammar, editor);
    }

    onProgress?.("done", installed.id);
    return installed;
  } catch (err) {
    onProgress?.("error", (err as Error).message);
    throw err;
  }
}

/**
 * Uninstall an extension and clean up Monaco registrations.
 * Note: themes defined with defineTheme cannot be unregistered —
 * they'll be gone on next page load.
 */
export async function uninstallExtensionFull(extensionId: string): Promise<void> {
  await uninstallExtension(extensionId);
  // Mark themes as unregistered so they re-register next time if re-installed
  // (Monaco doesn't support undefining themes, but they won't load on next session)
}

/**
 * Install a VSIX extension from a File (drag-and-drop or file picker).
 *
 * @param file        The .vsix file
 * @param monaco      Monaco namespace
 * @param editor      Optional editor instance
 * @param onProgress  Progress callback
 */
export async function installExtensionFromVSIX(
  file: File,
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
  onProgress?: InstallProgress,
): Promise<InstalledExtension> {
  try {
    onProgress?.("extracting", file.name);
    const buffer = await file.arrayBuffer();
    const vsix = await extractVSIX(buffer);

    const pkgJson = vsix.packageJson;
    const publisher = (pkgJson.publisher as string) ?? "local";
    const name = (pkgJson.name as string) ?? file.name.replace(/\.vsix$/i, "");
    const displayName = (pkgJson.displayName as string) ?? name;
    const description = (pkgJson.description as string) ?? "";
    const version = (pkgJson.version as string) ?? "0.0.0";

    onProgress?.("storing", `${publisher}.${name}`);
    const installed = await saveExtension(publisher, name, vsix, {
      displayName,
      description,
      version,
      readme: vsix.readme,
    });

    onProgress?.("loading");

    // Register contributed languages
    const existingLangs = new Set(monaco.languages.getLanguages().map((l) => l.id));
    for (const lang of vsix.languages) {
      if (!existingLangs.has(lang.id)) {
        monaco.languages.register({
          id: lang.id,
          extensions: lang.extensions,
          aliases: lang.aliases,
          filenames: lang.filenames,
        });
      }

      // Apply language configuration (brackets, auto-close, comments, etc.)
      if (lang.configurationContent) {
        try {
          const monacoConfig = convertVSCodeLanguageConfig(lang.configurationContent);
          monaco.languages.setLanguageConfiguration(lang.id, monacoConfig);
        } catch (err) {
          console.warn(`[extensionLoader] Failed to set language config for "${lang.id}":`, err);
        }
      }
    }
    if (vsix.languages.length > 0) {
      refreshLanguageCache(monaco);
    }

    // Register themes
    for (const theme of vsix.themes) {
      const storedTheme: StoredTheme = {
        id: `${installed.id}::${theme.id}`,
        extensionId: installed.id,
        themeId: theme.id,
        label: theme.label,
        uiTheme: theme.uiTheme,
        content: theme.content,
      };
      registerExtensionTheme(monaco, storedTheme);
    }

    // Register grammars
    for (const grammar of vsix.grammars) {
      const storedGrammar: StoredGrammar = {
        id: `${installed.id}::${grammar.scopeName}`,
        extensionId: installed.id,
        scopeName: grammar.scopeName,
        language: grammar.language,
        content: grammar.content,
        parsed: grammar.parsed,
      };
      await registerExtensionGrammar(monaco, storedGrammar, editor);
    }

    onProgress?.("done", installed.id);
    return installed;
  } catch (err) {
    onProgress?.("error", (err as Error).message);
    throw err;
  }
}

/**
 * Toggle an extension on/off.
 */
export { toggleExtension, getInstalledExtensions, getEnabledExtensions };

/**
 * Get a list of all available theme IDs from installed extensions.
 */
export async function getAvailableExtensionThemes(): Promise<
  Array<{ themeId: string; label: string; extensionId: string; uiTheme: string }>
> {
  const themes = await getAllThemes();
  return themes.map((t) => ({
    themeId: t.themeId,
    label: t.label,
    extensionId: t.extensionId,
    uiTheme: t.uiTheme,
  }));
}