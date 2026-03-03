/**
 * @module monaco-editor/extensions/cache
 *
 * Cache API layer for the VSCode extension loader.
 * Uses the browser's Cache API (cache name: `monaco-ext-v1`) to store
 * GitHub API responses and reduce network calls on repeat visits.
 */

const CACHE_NAME = "monaco-ext-v1";

/* ── Global fetch headers (auth token, Accept) ───────────── */

let _globalHeaders: HeadersInit = {
  Accept: "application/vnd.github.v3+json",
};

/**
 * Set global headers used by every `cachedFetch` call.
 * Typically called once with a GitHub token to avoid 60 req/h anonymous limit.
 */
export function setGlobalFetchHeaders(token?: string): void {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) h.Authorization = `token ${token}`;
  _globalHeaders = h;
}

/**
 * Fetch with cache-first strategy.
 * Checks the Cache API first, falls back to network (and caches the response).
 * All network requests include the global auth headers.
 */
export async function cachedFetch(url: string): Promise<Response> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) return cached;

    const response = await fetch(url, { headers: _globalHeaders });
    if (response.ok) {
      // Clone the response before caching (response can only be read once)
      await cache.put(url, response.clone());
    }
    return response;
  } catch {
    // Fallback to direct fetch if Cache API is unavailable
    return fetch(url, { headers: _globalHeaders });
  }
}

/**
 * Bust cache for a specific URL.
 */
export async function invalidateCache(url: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(url);
  } catch {
    // silently fail
  }
}

/**
 * Clear the entire extension cache.
 */
export async function clearExtensionCache(): Promise<void> {
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    // silently fail
  }
}
