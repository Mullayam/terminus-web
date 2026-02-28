/**
 * @module lib/monaco/extensionStorage
 *
 * IndexedDB storage for VS Code extensions installed from Open VSX.
 * Uses Dexie to store extension metadata, themes, grammars, snippets,
 * and raw files in the browser.
 *
 * Database: "terminus-extensions"
 * Tables:
 *   - extensions:  extension metadata (publisher, name, version, etc.)
 *   - themes:      parsed theme JSON keyed by themeId
 *   - grammars:    grammar content keyed by scopeName
 *   - snippets:    snippet content keyed by language
 *   - files:       raw binary files keyed by extensionId + path
 */

import Dexie, { type EntityTable } from "dexie";
import type {
  VSIXContents,
  ExtTheme,
  ExtGrammar,
  ExtSnippet,
  ExtLanguage,
} from "./extractVSIX";

/* ── Record Types ──────────────────────────────────────────── */

/** Status bar item contribution from package.json */
export interface ExtStatusBarItem {
  id: string;
  alignment?: "left" | "right";
  priority?: number;
  text?: string;
  tooltip?: string;
  command?: string;
  color?: string;
}

/** Menu contribution from package.json */
export interface ExtMenuContribution {
  group: string;
  command: string;
  when?: string;
}

/** View container contribution */
export interface ExtViewContainer {
  id: string;
  title: string;
  icon?: string;
}

/** View contribution (sidebar panel) */
export interface ExtView {
  id: string;
  name: string;
  when?: string;
  type?: string;
}

export interface InstalledExtension {
  /** "publisher.name" */
  id: string;
  publisher: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  /** Extension icon URL from Open VSX */
  iconUrl?: string;
  /** Categories from the extension */
  categories?: string[];
  /** When the extension was installed */
  installedAt: number;
  /** Whether the extension is currently enabled */
  enabled: boolean;
  /** README markdown content (from VSIX or Open VSX) */
  readme?: string;
  /** Contributing types: what this extension provides */
  contributes: {
    themes: string[];
    grammars: string[];
    snippets: string[];
    languages: string[];
    iconThemes: string[];
    /** Full language contribution configs (extensions, aliases, filenames) for registration */
    languageConfigs?: ExtLanguage[];
    /** Status bar item contributions */
    statusBar?: ExtStatusBarItem[];
    /** Context menu contributions (editor/context) */
    menus?: Record<string, ExtMenuContribution[]>;
    /** Sidebar view containers */
    viewContainers?: ExtViewContainer[];
    /** Sidebar views */
    views?: Record<string, ExtView[]>;
  };
}

export interface StoredTheme {
  /** Unique ID: "extensionId::themeId" */
  id: string;
  /** Parent extension ID */
  extensionId: string;
  /** Theme slug (used with monaco.editor.defineTheme) */
  themeId: string;
  /** Human-readable label */
  label: string;
  /** Base theme type */
  uiTheme: "vs" | "vs-dark" | "hc-black" | "hc-light";
  /** Full parsed theme JSON */
  content: Record<string, unknown>;
}

export interface StoredGrammar {
  /** Unique ID: "extensionId::scopeName" */
  id: string;
  /** Parent extension ID */
  extensionId: string;
  /** TextMate scope name */
  scopeName: string;
  /** Associated Monaco language ID */
  language?: string;
  /** Raw grammar content (JSON string or plist) */
  content: string;
  /** Parsed grammar (if JSON) */
  parsed?: object;
}

export interface StoredSnippet {
  /** Unique ID: "extensionId::language" */
  id: string;
  /** Parent extension ID */
  extensionId: string;
  /** Language ID */
  language: string;
  /** Parsed snippet JSON */
  content: Record<string, unknown>;
}

export interface StoredFile {
  /** Unique ID: "extensionId::path" */
  id: string;
  /** Parent extension ID */
  extensionId: string;
  /** Relative file path within the extension */
  path: string;
  /** Raw binary data */
  data: Uint8Array;
}

/* ── Database ──────────────────────────────────────────────── */

class ExtensionDB extends Dexie {
  extensions!: EntityTable<InstalledExtension, "id">;
  themes!: EntityTable<StoredTheme, "id">;
  grammars!: EntityTable<StoredGrammar, "id">;
  snippets!: EntityTable<StoredSnippet, "id">;
  files!: EntityTable<StoredFile, "id">;

  constructor() {
    super("terminus-extensions");

    this.version(1).stores({
      extensions: "id, publisher, name, enabled",
      themes: "id, extensionId, themeId",
      grammars: "id, extensionId, scopeName, language",
      snippets: "id, extensionId, language",
      files: "id, extensionId, path",
    });

    // v2: migrate boolean `enabled` → numeric 1/0 so the index works
    this.version(2)
      .stores({
        extensions: "id, publisher, name, enabled",
        themes: "id, extensionId, themeId",
        grammars: "id, extensionId, scopeName, language",
        snippets: "id, extensionId, language",
        files: "id, extensionId, path",
      })
      .upgrade((tx) =>
        tx
          .table("extensions")
          .toCollection()
          .modify((ext) => {
            ext.enabled = ext.enabled ? 1 : 0;
          }),
      );
  }
}

/** Singleton database instance */
const db = new ExtensionDB();

/* ── Extension CRUD ────────────────────────────────────────── */

/**
 * Save an installed extension and all its contents to IndexedDB.
 *
 * @param publisher   Extension publisher (e.g. "Catppuccin")
 * @param name        Extension name (e.g. "catppuccin-vsc")
 * @param vsix        Extracted VSIX contents
 * @param meta        Additional metadata from Open VSX
 */
export async function saveExtension(
  publisher: string,
  name: string,
  vsix: VSIXContents,
  meta?: {
    displayName?: string;
    description?: string;
    version?: string;
    iconUrl?: string;
    categories?: string[];
    readme?: string;
  },
): Promise<InstalledExtension> {
  const extensionId = `${publisher}.${name}`;
  const pkgJson = vsix.packageJson;

  // Build the extension record
  const ext: InstalledExtension = {
    id: extensionId,
    publisher,
    name,
    displayName: meta?.displayName ?? (pkgJson.displayName as string) ?? name,
    description: meta?.description ?? (pkgJson.description as string) ?? "",
    version: meta?.version ?? (pkgJson.version as string) ?? "0.0.0",
    iconUrl: meta?.iconUrl,
    categories: meta?.categories ?? (pkgJson.categories as string[]) ?? [],
    installedAt: Date.now(),
    enabled: 1 as unknown as boolean,
    readme: meta?.readme ?? vsix.readme,
    contributes: {
      themes: vsix.themes.map((t) => t.id),
      grammars: vsix.grammars.map((g) => g.scopeName),
      snippets: vsix.snippets.map((s) => s.language),
      languages: vsix.languages.map((l) => l.id),
      iconThemes: vsix.iconThemes.map((it) => it.id),
      languageConfigs: vsix.languages,
      statusBar: vsix.statusBar,
      menus: vsix.menus,
      viewContainers: vsix.viewContainers,
      views: vsix.views,
    },
  };

  // Use a transaction for atomicity
  await db.transaction("rw", [db.extensions, db.themes, db.grammars, db.snippets, db.files], async () => {
    // Remove any previous version
    await removeExtensionData(extensionId);

    // Save extension metadata
    await db.extensions.put(ext);

    // Save themes
    for (const theme of vsix.themes) {
      await db.themes.put({
        id: `${extensionId}::${theme.id}`,
        extensionId,
        themeId: theme.id,
        label: theme.label,
        uiTheme: theme.uiTheme,
        content: theme.content,
      });
    }

    // Save grammars
    for (const grammar of vsix.grammars) {
      await db.grammars.put({
        id: `${extensionId}::${grammar.scopeName}`,
        extensionId,
        scopeName: grammar.scopeName,
        language: grammar.language,
        content: grammar.content,
        parsed: grammar.parsed,
      });
    }

    // Save snippets
    for (const snippet of vsix.snippets) {
      await db.snippets.put({
        id: `${extensionId}::${snippet.language}`,
        extensionId,
        language: snippet.language,
        content: snippet.content,
      });
    }

    // Save raw files (for icon themes, config files, etc.)
    for (const [path, data] of vsix.files) {
      await db.files.put({
        id: `${extensionId}::${path}`,
        extensionId,
        path,
        data,
      });
    }
  });

  return ext;
}

/**
 * Remove all data for an extension.
 */
async function removeExtensionData(extensionId: string): Promise<void> {
  await Promise.all([
    db.themes.where("extensionId").equals(extensionId).delete(),
    db.grammars.where("extensionId").equals(extensionId).delete(),
    db.snippets.where("extensionId").equals(extensionId).delete(),
    db.files.where("extensionId").equals(extensionId).delete(),
    db.extensions.delete(extensionId),
  ]);
}

/**
 * Uninstall an extension (remove from IDB).
 */
export async function uninstallExtension(extensionId: string): Promise<void> {
  await db.transaction("rw", [db.extensions, db.themes, db.grammars, db.snippets, db.files], async () => {
    await removeExtensionData(extensionId);
  });
}

/**
 * Enable/disable an extension.
 */
export async function toggleExtension(extensionId: string, enabled: boolean): Promise<void> {
  // Store as 1/0 because IndexedDB cannot index booleans
  await db.extensions.update(extensionId, { enabled: (enabled ? 1 : 0) as unknown as boolean });
}

/* ── Queries ───────────────────────────────────────────────── */

/**
 * Get all installed extensions.
 * Normalises the `enabled` field from its stored 1/0 number form back to boolean.
 */
export async function getInstalledExtensions(): Promise<InstalledExtension[]> {
  const rows = await db.extensions.toArray();
  return rows.map(normalizeEnabled);
}

/**
 * Get enabled extensions only.
 * IndexedDB stores `enabled` as 1/0 (booleans are not valid index keys).
 */
export async function getEnabledExtensions(): Promise<InstalledExtension[]> {
  const rows = await db.extensions.where("enabled").equals(1).toArray();
  return rows.map(normalizeEnabled);
}

/** Convert the stored 1/0 number back to a proper boolean. */
function normalizeEnabled(ext: InstalledExtension): InstalledExtension {
  return { ...ext, enabled: Boolean(ext.enabled) };
}

/**
 * Check if an extension is installed.
 */
export async function isExtensionInstalled(extensionId: string): Promise<boolean> {
  return (await db.extensions.get(extensionId)) !== undefined;
}

/**
 * Get a specific installed extension.
 */
export async function getInstalledExtension(extensionId: string): Promise<InstalledExtension | undefined> {
  return db.extensions.get(extensionId);
}

/**
 * Get all stored themes (from all enabled extensions).
 */
export async function getAllThemes(): Promise<StoredTheme[]> {
  const enabledExts = await getEnabledExtensions();
  const ids = enabledExts.map((e) => e.id);
  if (ids.length === 0) return [];
  return db.themes.where("extensionId").anyOf(ids).toArray();
}

/**
 * Get all stored themes from a specific extension.
 */
export async function getThemesByExtension(extensionId: string): Promise<StoredTheme[]> {
  return db.themes.where("extensionId").equals(extensionId).toArray();
}

/**
 * Get a single stored theme by its themeId.
 */
export async function getThemeById(themeId: string): Promise<StoredTheme | undefined> {
  return db.themes.where("themeId").equals(themeId).first();
}

/**
 * Get all stored grammars (from enabled extensions).
 */
export async function getAllGrammars(): Promise<StoredGrammar[]> {
  const enabledExts = await getEnabledExtensions();
  const ids = enabledExts.map((e) => e.id);
  if (ids.length === 0) return [];
  return db.grammars.where("extensionId").anyOf(ids).toArray();
}

/**
 * Get a grammar by its scopeName.
 */
export async function getGrammarByScope(scopeName: string): Promise<StoredGrammar | undefined> {
  return db.grammars.where("scopeName").equals(scopeName).first();
}

/**
 * Get grammar by language ID.
 */
export async function getGrammarByLanguage(language: string): Promise<StoredGrammar | undefined> {
  return db.grammars.where("language").equals(language).first();
}

/**
 * Get all stored snippets for a language (merged from all enabled extensions).
 */
export async function getSnippetsByLanguage(language: string): Promise<StoredSnippet[]> {
  const enabledExts = await getEnabledExtensions();
  const ids = enabledExts.map((e) => e.id);
  if (ids.length === 0) return [];
  return db.snippets
    .where("extensionId")
    .anyOf(ids)
    .and((s) => s.language === language)
    .toArray();
}

/**
 * Get a raw file from an extension.
 */
export async function getExtensionFile(extensionId: string, path: string): Promise<Uint8Array | undefined> {
  const record = await db.files.get(`${extensionId}::${path}`);
  return record?.data;
}

/**
 * Get the total storage used by all extensions (approximate).
 */
export async function getStorageUsage(): Promise<{
  extensionCount: number;
  themeCount: number;
  grammarCount: number;
  snippetCount: number;
  fileCount: number;
}> {
  const [extensionCount, themeCount, grammarCount, snippetCount, fileCount] = await Promise.all([
    db.extensions.count(),
    db.themes.count(),
    db.grammars.count(),
    db.snippets.count(),
    db.files.count(),
  ]);
  return { extensionCount, themeCount, grammarCount, snippetCount, fileCount };
}

/**
 * Clear all extension data from the database.
 */
export async function clearAllExtensions(): Promise<void> {
  await db.transaction("rw", [db.extensions, db.themes, db.grammars, db.snippets, db.files], async () => {
    await db.extensions.clear();
    await db.themes.clear();
    await db.grammars.clear();
    await db.snippets.clear();
    await db.files.clear();
  });
}
