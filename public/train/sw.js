// Escensus training hub offline service worker.
// Caches the launcher shell + the Script Trainer so the hub opens with no internet.
// The Objection Drill has its own service worker under /drill/.

const CACHE = 'escensus-train-v1'
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './script/',
  './script/index.html',
  '../drill/icon-192.png',
  '../drill/icon-512.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return

  // Cache-first: instant offline for the shell; network fills gaps.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit
      return fetch(e.request)
        .then((resp) => {
          if (resp && resp.status === 200 && url.origin === location.origin) {
            const copy = resp.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copy))
          }
          return resp
        })
        .catch(() => caches.match('./index.html'))
    }),
  )
})
