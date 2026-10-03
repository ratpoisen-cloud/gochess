// __GOCHESS_BASE__ and __GOCHESS_VERSION__ are substituted at build time by
// vite.config.ts — public/ files are copied verbatim, so they cannot use
// Vite's %BASE_URL% placeholder. Bumping the version on every deploy makes the
// static cache self-invalidate instead of pinning icons/sounds forever.
const BASE = '__GOCHESS_BASE__'
const VERSION = '__GOCHESS_VERSION__'
const CACHE = `gochess-v${VERSION}`
const STATIC_CACHE = `gochess-static-v${VERSION}`
const SCOPE_PATH = BASE.endsWith('/') ? BASE : `${BASE}/`

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== STATIC_CACHE).map(k => caches.delete(k)))
    )
  )
  clients.claim()
})

function cachePut(cacheName, request, response) {
  // Not awaited on purpose: a quota failure must not break the response, but it
  // must not surface as an unhandled rejection either.
  caches.open(cacheName).then(c => c.put(request, response)).catch(() => {})
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (!url.pathname.startsWith(SCOPE_PATH)) return
  if (url.pathname.includes('firebase') || url.pathname.includes('googleapis')) return

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).then(res => {
        // 206 Partial Response cannot be stored in the Cache API.
        if (!res.ok || res.status === 206) return res
        cachePut(CACHE, request, res.clone())
        return res
      }).catch(() => caches.match(request))
    )
    return
  }

  e.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(res => {
        if (!res.ok || res.status === 206) return res
        cachePut(STATIC_CACHE, request, res.clone())
        return res
      })
    )
  )
})
