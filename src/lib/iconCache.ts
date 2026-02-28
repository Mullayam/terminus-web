/**
 * @module iconCache
 *
 * Cache Storage helper scoped to vscode-icons CDN URLs.
 *
 * Uses the browser Cache API to persist icon SVGs across sessions,
 * eliminating redundant network requests for the same icons.
 *
 * Usage:
 *   const url = await cachedIconUrl("https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_ts.svg");
 *   <img src={url} />
 *
 * Returned URL is either the original (cache-hit piped through Cache API)
 * or a blob URL created from the response body.
 */

const CACHE_NAME = "terminus-vscode-icons-v1";
const ORIGIN_PREFIX =
  "https://raw.githubusercontent.com/vscode-icons/vscode-icons/";

/** In-flight dedup map so parallel requests for the same URL share one fetch */
const inFlight = new Map<string, Promise<string>>();

/** Blob URL memo — once created we never revoke, they live as long as the page */
const blobUrls = new Map<string, string>();

/**
 * Return a usable image `src` for the given vscode-icons CDN URL.
 *
 * 1. If a blob URL was already created this session → return it instantly.
 * 2. If the response exists in Cache Storage → create blob URL from cache.
 * 3. Otherwise fetch from network, store in cache, create blob URL.
 *
 * Falls back to the raw URL if Cache API is unavailable.
 */
export async function cachedIconUrl(url: string): Promise<string> {
  // Only cache vscode-icons URLs
  if (!url.startsWith(ORIGIN_PREFIX)) return url;

  // Fast path — already resolved this session
  const existing = blobUrls.get(url);
  if (existing) return existing;

  // Dedup concurrent calls for the same URL
  const pending = inFlight.get(url);
  if (pending) return pending;

  const work = _resolve(url);
  inFlight.set(url, work);

  try {
    return await work;
  } finally {
    inFlight.delete(url);
  }
}

async function _resolve(url: string): Promise<string> {
  try {
    const cache = await caches.open(CACHE_NAME);

    // 1. Check cache
    const cached = await cache.match(url);
    if (cached) {
      const blob = await cached.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrls.set(url, blobUrl);
      return blobUrl;
    }

    // 2. Fetch from network
    const response = await fetch(url);
    if (!response.ok) return url; // fallback to raw URL

    // Clone before consuming — one copy for cache, one for blob
    const clone = response.clone();
    await cache.put(url, clone);

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    blobUrls.set(url, blobUrl);
    return blobUrl;
  } catch {
    // Cache API unavailable (e.g. insecure context) — fall back
    return url;
  }
}

/**
 * Pre-warm the cache for a list of icon URLs (fire-and-forget).
 */
export function prewarmIcons(urls: string[]): void {
  for (const url of urls) {
    cachedIconUrl(url).catch(() => {});
  }
}
