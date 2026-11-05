/* Lista Esperta service worker.
 * - Pages: network first, falling back to the cached copy, then to /offline.
 * - /_next/static and icons: cache first (file names are content-hashed).
 * - API calls (another origin) and non-GET requests are never touched.
 * Bump VERSION to drop old caches.
 */
const VERSION = "v1";
const SHELL_CACHE = `le-shell-${VERSION}`;
const PAGE_CACHE = `le-pages-${VERSION}`;
const STATIC_CACHE = `le-static-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/logo_lista_esperta.webp"];
const MAX_PAGES = 30;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, PAGE_CACHE, STATIC_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
      void trimCache(PAGE_CACHE, MAX_PAGES);
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreVary: true });
    return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});

// Price alerts (Web Push). The API sends { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let message = { title: "Lista Esperta", body: "", url: "/alerts" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // A push without JSON still shows something useful.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/alerts", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => client.url === target);
      if (open) return open.focus();
      return self.clients.openWindow(target);
    })(),
  );
});
