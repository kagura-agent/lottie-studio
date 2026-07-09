const CACHE_VERSION = 'lottie-studio-v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/offline.html',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_OFFLINE_STATUS') {
    event.ports[0].postMessage({ isOffline: !navigator.onLine });
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for queued messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-chat-messages') {
    event.waitUntil(notifyClientsToSync());
  }
  if (event.tag === 'sync-animations') {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_REQUESTED' });
  }
}

// Fetch: apply caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip WebSocket upgrade requests
  if (request.headers.get('upgrade') === 'websocket') return;

  // Skip chat/LLM API calls — unique per request, never cache
  if (url.pathname.startsWith('/api/chat')) return;

  // Cache-first for static assets (Next.js build output)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Cache animation JSON for offline viewing
  if (url.pathname.match(/^\/api\/animations\/[^/]+\/json/)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Cache animation metadata for offline gallery
  if (url.pathname.match(/^\/api\/animations\/[^/]+$/) && !url.pathname.includes('/api/animations/explore')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Cache thumbnails for offline gallery
  if (url.pathname.match(/^\/api\/animations\/[^/]+\/thumbnail/)) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Cache animation list for offline gallery
  if (url.pathname === '/api/animations' && url.searchParams.has('mine')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Network-first for other API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Stale-while-revalidate for page navigations
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: cache-first for other static resources
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match('/offline.html');
  }
}

// Network-first strategy
async function networkFirst(request, cacheName = DYNAMIC_CACHE) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(STATIC_CACHE);
        cache.then((c) => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Return cached version immediately, update in background
    void fetchPromise;
    return cached;
  }

  // No cache — wait for network
  const response = await fetchPromise;
  if (response) return response;

  return caches.match('/offline.html');
}
