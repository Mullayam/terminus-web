/**
 * @module lib/context-engine/contextEngineApi
 *
 * Fetches manifests and language/command data from
 * https://cdn.jsdelivr.net/npm/@enjoys/context-engine
 */

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@enjoys/context-engine";
const VERSION_STORAGE_KEY = "terminus-context-engine-version";

/* ── Version helpers ───────────────────────────────────────── */

/**
 * Fetch the latest published version of @enjoys/context-engine from CDN.
 */
export async function fetchContextEngineVersion(): Promise<string> {
    const res = await fetch(`${CDN_BASE}/package.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch context-engine version: ${res.status}`);
    const pkg = await res.json();
    return pkg.version as string;
}

/**
 * Get the locally stored context-engine version (from last install).
 */
export function getStoredContextEngineVersion(): string | null {
    return localStorage.getItem(VERSION_STORAGE_KEY);
}

/**
 * Persist the context-engine version to localStorage.
 */
export function setStoredContextEngineVersion(version: string): void {
    localStorage.setItem(VERSION_STORAGE_KEY, version);
}

/**
 * Compare two semver strings.  Returns true if `remote` is greater than `local`.
 */
export function isNewerVersion(remote: string, local: string): boolean {
    const r = remote.split(".").map(Number);
    const l = local.split(".").map(Number);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
        const rv = r[i] ?? 0;
        const lv = l[i] ?? 0;
        if (rv > lv) return true;
        if (rv < lv) return false;
    }
    return false;
}

/* ── Manifest Types ────────────────────────────────────────── */

export interface ManifestLanguageFiles {
    completion: string;
    definition: string;
    hover: string;
    codeActions: string;
    documentHighlight: string;
    documentSymbol: string;
    links: string;
    typeDefinition: string;
    references: string;
    implementation: string;
    inlineCompletions: string;
    formatting: string;
    codeLens: string;
    color: string;
    declaration: string;
    inlayHints: string;
    signatureHelp: string;
    foldingRange: string;
    rename: string;
    selectionRange: string;
    linkedEditingRange: string;
    onTypeFormatting: string;
    documentRangeFormatting: string;
    semanticTokens: string;
    rangeSemanticTokens: string;
}

export interface ManifestLanguage {
    id: string;
    name: string;
    files: ManifestLanguageFiles;
}

export interface ManifestDirectoryInfo {
    description: string;
    files: string[];
}

export interface ManifestDirectories {
    completion: ManifestDirectoryInfo;
    definition: ManifestDirectoryInfo;
    hover: ManifestDirectoryInfo;
    codeActions: ManifestDirectoryInfo;
    documentHighlight: ManifestDirectoryInfo;
    documentSymbol: ManifestDirectoryInfo;
    links: ManifestDirectoryInfo;
    typeDefinition: ManifestDirectoryInfo;
    references: ManifestDirectoryInfo;
    implementation: ManifestDirectoryInfo;
    inlineCompletions: ManifestDirectoryInfo;
    formatting: ManifestDirectoryInfo;
    codeLens: ManifestDirectoryInfo;
    color: ManifestDirectoryInfo;
    declaration: ManifestDirectoryInfo;
    inlayHints: ManifestDirectoryInfo;
    signatureHelp: ManifestDirectoryInfo;
    foldingRange: ManifestDirectoryInfo;
    rename: ManifestDirectoryInfo;
    selectionRange: ManifestDirectoryInfo;
    linkedEditingRange: ManifestDirectoryInfo;
    onTypeFormatting: ManifestDirectoryInfo;
    documentRangeFormatting: ManifestDirectoryInfo;
    semanticTokens: ManifestDirectoryInfo;
    rangeSemanticTokens: ManifestDirectoryInfo;
}

export interface LanguageManifest {
    version: string;
    description: string;
    generatedAt: string;
    languages: ManifestLanguage[];
    directories: ManifestDirectories;
    totalLanguages: number;
    totalFiles: number;
}

/* ── Terminal Commands Manifest ─────────────────────────────── */

export interface TerminalCommandContext {
    category: string;
    context: string[];
    files: string[];
}

export interface TerminalCommandsManifest {
    files: string[];
    context: TerminalCommandContext[];
}

/* ── Fetch helpers ─────────────────────────────────────────── */

let langManifestCache: LanguageManifest | null = null;
let cmdManifestCache: TerminalCommandsManifest | null = null;

/**
 * Fetch the language manifest (completions, definitions, hover).
 * Cached in memory after first fetch.
 */
export async function fetchLanguageManifest(): Promise<LanguageManifest> {
    if (langManifestCache) return langManifestCache;
    const res = await fetch(`${CDN_BASE}/data/manifest.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch language manifest: ${res.status}`);
    const data = await res.json();
    langManifestCache = data;
    return data;
}

/**
 * Fetch the terminal commands manifest.
 * Cached in memory after first fetch.
 */
export async function fetchTerminalCommandsManifest(): Promise<TerminalCommandsManifest> {
    if (cmdManifestCache) return cmdManifestCache;
    const res = await fetch(`${CDN_BASE}/data/commands/manifest.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch terminal commands manifest: ${res.status}`);
    const data = await res.json();
    cmdManifestCache = data;
    return data;
}

/**
 * Build the CDN URL for a language data file.
 * e.g. fetchLanguageFile("completion/bash.json") → full URL
 */
export function buildLangFileUrl(relativePath: string): string {
    return `${CDN_BASE}/data/${relativePath}`;
}

/**
 * Build the CDN URL for a terminal command file.
 * e.g. buildCmdFileUrl("aws.json") → full URL
 */
export function buildCmdFileUrl(fileName: string): string {
    return `${CDN_BASE}/data/commands/${fileName}`;
}

/**
 * Fetch a single JSON file from CDN.
 */
export async function fetchJsonFile(url: string): Promise<unknown> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.json();
}

/** All provider type keys */
export const PROVIDER_TYPES = [
    "completion",
    "definition",
    "hover",
    "codeActions",
    "documentHighlight",
    "documentSymbol",
    "links",
    "typeDefinition",
    "references",
    "implementation",
    "inlineCompletions",
    "formatting",
    "codeLens",
    "color",
    "declaration",
    "inlayHints",
    "signatureHelp",
    "foldingRange",
    "rename",
    "selectionRange",
    "linkedEditingRange",
    "onTypeFormatting",
    "documentRangeFormatting",
    "semanticTokens",
    "rangeSemanticTokens",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export type LanguageDataResult = Record<ProviderType, unknown>;

/**
 * Fetch all data files for a language in parallel.
 */
export async function fetchLanguageData(
    lang: ManifestLanguage,
): Promise<LanguageDataResult> {
    const entries = await Promise.all(
        PROVIDER_TYPES.map(async (type) => {
            const filePath = lang.files[type];
            const data = filePath ? await fetchJsonFile(buildLangFileUrl(filePath)) : null;
            return [type, data] as const;
        }),
    );
    return Object.fromEntries(entries) as LanguageDataResult;
}

/**
 * Fetch multiple command files in parallel.
 */
export async function fetchCommandFiles(
    fileNames: string[],
): Promise<{ fileName: string; data: unknown }[]> {
    const results = await Promise.all(
        fileNames.map(async (fileName) => {
            const data = await fetchJsonFile(buildCmdFileUrl(fileName));
            return { fileName, data };
        }),
    );
    return results;
}
