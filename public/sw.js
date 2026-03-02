const CACHE_NAME = 'monaco-extensions-v1';
// Bump this version to invalidate all cached extensions
const CACHE_VERSION = '1.0.0';
const ESM_ORIGIN = 'https://esm.sh';

// On install — activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installed - version:', CACHE_VERSION);
  self.skipWaiting();
});

// On activate — claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old cache versions
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('monaco-extensions-') && key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      )
    ])
  );
});

// Intercept fetch — cache esm.sh @codingame requests
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only intercept esm.sh @codingame requests
  if (!url.startsWith(ESM_ORIGIN)) return;
  if (!url.includes('@codingame/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Check cache first
      const cached = await cache.match(event.request);
      if (cached) {
        console.log('[SW] Cache HIT:', url);
        return cached;
      }

      // Cache MISS — fetch from esm.sh
      console.log('[SW] Cache MISS — fetching:', url);
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          // Clone before consuming — cache the clone
          cache.put(event.request, response.clone());
          console.log('[SW] Cached:', url);
        }
        return response;
      } catch (err) {
        console.error('[SW] Fetch failed:', url, err);
        throw err;
      }
    })
  );
});

// Message handler — allows app to control SW
self.addEventListener('message', (event) => {
  // Clear cache on demand (e.g. version update)
  if (event.data?.type === 'CLEAR_EXTENSION_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Extension cache cleared');
      event.ports[0]?.postMessage({ success: true });
    });
  }

  // List cached URLs
  if (event.data?.type === 'LIST_CACHED') {
    caches.open(CACHE_NAME).then(cache =>
      cache.keys().then(keys => {
        event.ports[0]?.postMessage({
          urls: keys.map(r => r.url)
        });
      })
    );
  }
});
