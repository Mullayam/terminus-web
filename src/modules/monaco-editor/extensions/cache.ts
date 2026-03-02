/**
 * @module monaco-editor/extensions/cache
 *
 * Cache API layer for the VSCode extension loader.
 * Uses the browser's Cache API (cache name: `monaco-ext-v1`) to store
 * GitHub API responses and reduce network calls on repeat visits.
 */

const CACHE_NAME = "monaco-ext-v1";

/**
 * Fetch with cache-first strategy.
 * Checks the Cache API first, falls back to network (and caches the response).
 */
export async function cachedFetch(url: string): Promise<Response> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) return cached;

    const response = await fetch(url);
    if (response.ok) {
      // Clone the response before caching (response can only be read once)
      await cache.put(url, response.clone());
    }
    return response;
  } catch {
    // Fallback to direct fetch if Cache API is unavailable
    return fetch(url);
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
