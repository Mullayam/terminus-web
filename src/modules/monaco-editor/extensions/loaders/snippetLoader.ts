/**
 * @module monaco-editor/extensions/loaders/snippetLoader
 *
 * SRP: Fetches VS Code snippet files (.code-snippets / .json) and
 * returns parsed data. Registration as Monaco CompletionItemProviders
 * happens on the main thread.
 */

import { idbGet, idbSet, STORE_ASSETS } from "../idb";
import { cachedFetch } from "../cache";
import type { SnippetContribution } from "../packageReader";

/* ── Constants ────────────────────────────────────────────── */

const GITHUB_API_BASE = "https://api.github.com/repos/microsoft/vscode/contents";

function resolveGithubUrl(folder: string, relativePath: string): string {
  const cleanPath = relativePath.replace(/^\.\//, "");
  return `${GITHUB_API_BASE}/extensions/${folder}/${cleanPath}?ref=main`;
}

async function fetchAndDecode(url: string): Promise<string | null> {
  try {
    const res = await cachedFetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.encoding !== "base64" || !data.content) return null;
    const cleaned = (data.content as string).replace(/\n/g, "");
    const bytes = atob(cleaned);
    const uint8 = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) uint8[i] = bytes.charCodeAt(i);
    return new TextDecoder().decode(uint8);
  } catch (e) {
    console.warn(`[monaco-ext] Snippet fetch error`, e);
    return null;
  }
}

function stripJsonComments(text: string): string {
  return text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/* ── State ────────────────────────────────────────────────── */

const loadedSnippets = new Set<string>();

/* ── Result type ──────────────────────────────────────────── */

export interface SnippetEntry {
  name: string;
  prefix: string[];
  body: string;
  description: string;
}

export interface SnippetData {
  language: string;
  entries: SnippetEntry[];
}

/* ── Public ───────────────────────────────────────────────── */

/**
 * Fetch, decode, and parse snippet files from package.json `contributes.snippets`.
 * Returns structured data. Registration into Monaco happens on main thread.
 */
export async function fetchSnippets(
  folder: string,
  snippets: SnippetContribution[],
): Promise<SnippetData[]> {
  const results: SnippetData[] = [];

  for (const snippet of snippets) {
    if (!snippet.language || !snippet.path) continue;
    const dedupKey = `${folder}:${snippet.language}`;
    if (loadedSnippets.has(dedupKey)) continue;

    const idbKey = `ext:${folder}:snippet:${snippet.language}`;
    let content = await idbGet(STORE_ASSETS, idbKey);

    if (!content) {
      const url = resolveGithubUrl(folder, snippet.path);
      content = await fetchAndDecode(url);
      if (!content) continue;
      await idbSet(STORE_ASSETS, idbKey, content);
    }

    try {
      const cleaned = stripJsonComments(content);
      const snippetMap = JSON.parse(cleaned) as Record<
        string,
        { prefix?: string | string[]; body?: string | string[]; description?: string }
      >;

      const entries: SnippetEntry[] = [];

      for (const [name, def] of Object.entries(snippetMap)) {
        const prefixes = Array.isArray(def.prefix)
          ? def.prefix
          : def.prefix
            ? [def.prefix]
            : [];
        const body = Array.isArray(def.body) ? def.body.join("\n") : String(def.body ?? "");
        if (!body || prefixes.length === 0) continue;

        entries.push({
          name,
          prefix: prefixes,
          body,
          description: def.description ?? name,
        });
      }

      if (entries.length > 0) {
        loadedSnippets.add(dedupKey);
        results.push({ language: snippet.language, entries });
        console.log(
          `[monaco-ext] Snippets parsed: ${snippet.language} (${entries.length} items)`,
        );
      }
    } catch (e) {
      console.warn(`[monaco-ext] Snippet parse failed: ${snippet.language}`, e);
    }
  }

  return results;
}

export function resetSnippetLoader(): void {
  loadedSnippets.clear();
}
