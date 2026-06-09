/* SAPL Service Worker
 * Strategy:
 *  - Precache the app shell + offline fallback.
 *  - Navigations: network-first, fall back to cache, then /offline.
 *  - Static assets (icons, images, _next/static): stale-while-revalidate.
 *  - API / dynamic routes: always go to the network (never serve stale data).
 *  - Auto-update: a new SW takes over immediately (skipWaiting + clients.claim),
 *    so every Vercel deployment refreshes the installed PWA automatically.
 */

const VERSION = "v2"
const STATIC_CACHE = `sapl-static-${VERSION}`
const RUNTIME_CACHE = `sapl-runtime-${VERSION}`
const OFFLINE_URL = "/offline"

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      await cache.addAll(PRECACHE_URLS).catch(() => {})
      // Activate this SW as soon as it finishes installing.
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions.
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

// Allow the page to tell a waiting SW to activate right away.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting()
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/landing/") ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|otf|css|js)$/.test(url.pathname)
  )
}

self.addEventListener("fetch", (event) => {
  const { request } = event

  // Only handle GET requests over http(s) on our own origin.
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache API routes, auth, or server actions — always network.
  if (url.pathname.startsWith("/api/") || request.headers.get("accept")?.includes("text/event-stream")) {
    return
  }

  // App shell navigations: network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          const cache = await caches.open(RUNTIME_CACHE)
          cache.put(request, fresh.clone())
          return fresh
        } catch {
          const cached = await caches.match(request)
          if (cached) return cached
          const offline = await caches.match(OFFLINE_URL)
          return offline || Response.error()
        }
      })(),
    )
    return
  }

  // Static assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) cache.put(request, response.clone())
            return response
          })
          .catch(() => cached)
        return cached || network
      })(),
    )
  }
})

// --- Push notifications -------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "SAPL", body: event.data ? event.data.text() : "" }
  }

  const title = data.title || "SAPL"
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-96.png",
    tag: data.tag || "sapl-notification",
    data: { url: data.url || "/" },
    vibrate: [100, 50, 100],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || "/"
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const existing = allClients.find((client) => client.url.includes(targetUrl))
      if (existing) return existing.focus()
      return self.clients.openWindow(targetUrl)
    })(),
  )
})
