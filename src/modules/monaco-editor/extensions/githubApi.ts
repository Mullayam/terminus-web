/**
 * @module monaco-editor/extensions/githubApi
 *
 * GitHub Contents API fetcher with base64 decoding.
 * Fetches file listings and file contents from the default
 * Microsoft/vscode extensions tree on GitHub.
 *
 * All requests go through the Cache API layer to minimise
 * API calls and avoid GitHub rate limits.
 */

import { cachedFetch } from "./cache";

/* ── Types ─────────────────────────────────────────────────── */

export interface GitHubEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
  size: number;
  url: string;           // API URL for the individual entry
  download_url: string | null;
  html_url: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  content: string;       // base64-encoded
  encoding: "base64";
  size: number;
}

/* ── Constants ─────────────────────────────────────────────── */

/**
 * Default GitHub API base for the official vscode extension folders.
 * Points to the main branch of the vscode repository.
 */
const DEFAULT_BASE_URL =
  "https://api.github.com/repos/microsoft/vscode/contents/extensions";

/**
 * Recommended headers — GitHub rate-limits anonymous requests to 60/h.
 * If users have a token, they can supply it.
 */
function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) h.Authorization = `token ${token}`;
  return h;
}

/* ── Public API ────────────────────────────────────────────── */

/**
 * List directory contents at a given GitHub `path` (relative to repo root).
 * Uses the GitHub Contents API which returns an array of entries.
 */
export async function listDirectory(
  path: string,
  opts?: { baseUrl?: string; token?: string },
): Promise<GitHubEntry[]> {
  const base = opts?.baseUrl ?? DEFAULT_BASE_URL;
  const url = path ? `${base}/${path}` : base;
  const res = await cachedFetch(url);
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText} — ${url}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * List the top-level extension folders (e.g. "javascript", "typescript", "python").
 */
export async function listExtensionFolders(
  opts?: { baseUrl?: string; token?: string },
): Promise<GitHubEntry[]> {
  const entries = await listDirectory("", opts);
  // Only return directories (extension folders)
  return entries.filter((e) => e.type === "dir");
}

/**
 * Fetch a single file and decode its base64 content to a UTF-8 string.
 */
export async function fetchFileContent(
  path: string,
  opts?: { baseUrl?: string; token?: string },
): Promise<string> {
  const base = opts?.baseUrl ?? DEFAULT_BASE_URL;
  const url = `${base}/${path}`;
  const res = await cachedFetch(url);
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText} — ${url}`);
  }
  const data: GitHubFileContent = await res.json();
  return decodeBase64(data.content);
}

/**
 * Fetch a single file's raw content using download_url (avoids base64 overhead).
 * Falls back to base64 API if download_url is not available.
 */
export async function fetchRawFile(
  entry: GitHubEntry,
  opts?: { baseUrl?: string; token?: string },
): Promise<string> {
  if (entry.download_url) {
    const res = await cachedFetch(entry.download_url);
    if (res.ok) return res.text();
  }
  // Fallback to base64 content API
  return fetchFileContent(entry.path, opts);
}

/**
 * Recursively walk a directory and return all file entries.
 * Useful for exploring extension sub-folders like `snippets/`, `syntaxes/`.
 */
export async function walkDirectory(
  path: string,
  opts?: { baseUrl?: string; token?: string },
): Promise<GitHubEntry[]> {
  const entries = await listDirectory(path, opts);
  const results: GitHubEntry[] = [];

  for (const entry of entries) {
    if (entry.type === "file") {
      results.push(entry);
    } else if (entry.type === "dir") {
      const children = await walkDirectory(entry.path, opts);
      results.push(...children);
    }
  }

  return results;
}

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Decode a base64 string (from GitHub Contents API) to UTF-8 text.
 * Handles the line-break-separated base64 that GitHub returns.
 */
function decodeBase64(raw: string): string {
  const cleaned = raw.replace(/\n/g, "");
  const bytes = atob(cleaned);
  // Convert to Uint8Array to handle multi-byte UTF-8
  const uint8 = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    uint8[i] = bytes.charCodeAt(i);
  }
  return new TextDecoder().decode(uint8);
}
