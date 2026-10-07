/*
 * Syllabus Sense service worker. Makes the installed app open without a
 * connection and keeps pages and assets you have already used available:
 *
 *  - pages: network first, falling back to the last copy, then /offline.html
 *  - /_next/static (hashed, never changes): cache first
 *  - icons and the manifest: stale while revalidate
 *  - everything else, including /api and every other origin (Firebase): not
 *    touched, so data and AI calls always go to the network.
 *
 * Bump VERSION to drop every old cache on the next visit.
 */
const VERSION = 'v1';
const SHELL_CACHE = `ss-shell-${VERSION}`;
const PAGE_CACHE = `ss-pages-${VERSION}`;
const ASSET_CACHE = `ss-assets-${VERSION}`;
const CURRENT = [SHELL_CACHE, PAGE_CACHE, ASSET_CACHE];
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icon.svg', '/icons/icon-192x192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('ss-') && !CURRENT.includes(n))
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// A redirect cannot be replayed to a navigation, and only a complete same-origin
// response is worth keeping.
function storable(response) {
  return Boolean(response && response.ok && response.type === 'basic' && !response.redirected);
}

async function put(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (e) {
    // Quota or a Vary: * response: the page still works, it is just not saved.
  }
}

async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (storable(response)) put(cacheName, request, response.clone());
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (storable(response)) put(ASSET_CACHE, request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (storable(response)) put(ASSET_CACHE, request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGE_CACHE, OFFLINE_URL));
  } else if (url.searchParams.has('_rsc')) {
    // Next's client-side navigation data: lets a page you have visited open
    // from the app without a connection.
    event.respondWith(networkFirst(request, PAGE_CACHE));
  } else if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
