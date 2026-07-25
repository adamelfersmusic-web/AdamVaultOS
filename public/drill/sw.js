// Escensus drill — offline service worker.
// Caches the app shell + all voice clips so the drill runs with no internet
// (practice anywhere; the AssemblyAI transcript, when wired, still needs signal).

const CACHE = 'escensus-drill-v1'
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './audio/too-expensive.mp3',
  './audio/spouse.mp3',
  './audio/coverage-work.mp3',
  './audio/think-about-it.mp3',
  './audio/bank-info.mp3',
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
  // Never intercept the transcription API — it must hit the network.
  if (url.pathname.includes('/.netlify/functions/')) return
  if (e.request.method !== 'GET') return

  // Cache-first: instant offline for the shell + audio; network fills gaps.
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
