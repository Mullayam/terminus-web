/**
 * @module lib/context-engine/contextEngineApi
 *
 * Fetches manifests and language/command data from
 * https://cdn.jsdelivr.net/npm/@enjoys/context-engine
 */

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@enjoys/context-engine";

/* ── Manifest Types ────────────────────────────────────────── */

export interface ManifestLanguage {
    id: string;
    name: string;
    files: {
        completion: string;
        defination: string;
        hover: string;
    };
}

export interface ManifestDirectoryInfo {
    description: string;
    files: string[];
}

export interface LanguageManifest {
    version: string;
    description: string;
    generatedAt: string;
    languages: ManifestLanguage[];
    directories: {
        completion: ManifestDirectoryInfo;
        defination: ManifestDirectoryInfo;
        hover: ManifestDirectoryInfo;
    };
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
    const res = await fetch(`${CDN_BASE}/data/manifest.json`);
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
    const res = await fetch(`${CDN_BASE}/data/commands/manifest.json`);
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
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.json();
}

/**
 * Fetch all three data files for a language in parallel.
 */
export async function fetchLanguageData(
    lang: ManifestLanguage,
): Promise<{ completion: unknown; defination: unknown; hover: unknown }> {
    const [completion, defination, hover] = await Promise.all([
        fetchJsonFile(buildLangFileUrl(lang.files.completion)),
        fetchJsonFile(buildLangFileUrl(lang.files.defination)),
        fetchJsonFile(buildLangFileUrl(lang.files.hover)),
    ]);
    return { completion, defination, hover };
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
