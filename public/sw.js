const CACHE = 'gochess-v1'
const STATIC_CACHE = 'gochess-static-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== STATIC_CACHE).map(k => caches.delete(k)))
    )
  )
  clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.includes('firebase') || url.pathname.includes('googleapis')) return

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).then(res => {
        if (!res.ok) return res
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(request, clone))
        return res
      }).catch(() => caches.match(request))
    )
    return
  }

  e.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(res => {
        if (!res.ok) return res
        const clone = res.clone()
        caches.open(STATIC_CACHE).then(c => c.put(request, clone))
        return res
      })
    )
  )
})
