/**
 * @module monaco-editor/extensions/loaders/grammarLoader
 *
 * SRP: Fetches TextMate grammar files (.tmLanguage.json) and stores
 * them in IDB for use by the tokenizer / semantic-token provider.
 */

import { idbGet, idbSet, STORE_ASSETS } from "../idb";
import { cachedFetch } from "../cache";
import type { GrammarContribution } from "../packageReader";

/* ── Constants ────────────────────────────────────────────── */

const GITHUB_API_BASE = "https://api.github.com/repos/microsoft/vscode/contents";

function resolveGithubUrl(folder: string, relativePath: string): string {
  const cleanPath = relativePath.replace(/^\.\//, "");
  return `${GITHUB_API_BASE}/extensions/${folder}/${cleanPath}?ref=main`;
}

async function fetchAndDecode(url: string): Promise<string | null> {
  try {
    const res = await cachedFetch(url);
    if (!res.ok) {
      if (res.status === 403) {
        console.warn(`[monaco-ext] GitHub rate limit hit while fetching grammar: ${url}`);
      }
      return null;
    }
    const data = await res.json();
    if (data.encoding !== "base64" || !data.content) return null;
    const cleaned = (data.content as string).replace(/\n/g, "");
    const bytes = atob(cleaned);
    const uint8 = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) uint8[i] = bytes.charCodeAt(i);
    return new TextDecoder().decode(uint8);
  } catch (e) {
    console.warn(`[monaco-ext] Grammar fetch error`, e);
    return null;
  }
}

/* ── State ────────────────────────────────────────────────── */

const storedGrammars = new Set<string>();

/* ── Result type ──────────────────────────────────────────── */

export interface GrammarData {
  scopeName: string;
  language: string | undefined;
  embeddedLanguages: Record<string, string>;
  tokenTypes: Record<string, string>;
  grammar: Record<string, unknown>;
}

/* ── Public ───────────────────────────────────────────────── */

/**
 * Fetch, decode, and store TextMate grammars from package.json `contributes.grammars`.
 * Returns parsed grammar data — registration with Monaco happens on main thread.
 */
export async function fetchGrammars(
  folder: string,
  grammars: GrammarContribution[],
): Promise<GrammarData[]> {
  const results: GrammarData[] = [];

  for (const grammar of grammars) {
    if (!grammar.path || !grammar.scopeName) continue;
    if (storedGrammars.has(grammar.scopeName)) continue;

    const idbKey = `ext:${folder}:grammar:${grammar.scopeName}`;
    let content = await idbGet(STORE_ASSETS, idbKey);

    if (!content) {
      const url = resolveGithubUrl(folder, grammar.path);
      content = await fetchAndDecode(url);
      if (!content) continue;
      await idbSet(STORE_ASSETS, idbKey, content);
    }

    try {
      const grammarJson = JSON.parse(content);

      const meta: GrammarData = {
        scopeName: grammar.scopeName,
        language: grammar.language,
        embeddedLanguages: grammar.embeddedLanguages ?? {},
        tokenTypes: grammar.tokenTypes ?? {},
        grammar: grammarJson,
      };

      // Store full grammar metadata for potential textmate service
      await idbSet(
        STORE_ASSETS,
        `grammar-meta:${grammar.scopeName}`,
        JSON.stringify(meta),
      );

      storedGrammars.add(grammar.scopeName);
      results.push(meta);
      console.log(
        `[monaco-ext] Grammar stored: ${grammar.scopeName} → ${grammar.language ?? "no lang"}`,
      );
    } catch (e) {
      console.warn(`[monaco-ext] Grammar parse failed: ${grammar.scopeName}`, e);
    }
  }

  return results;
}

export function resetGrammarLoader(): void {
  storedGrammars.clear();
}
