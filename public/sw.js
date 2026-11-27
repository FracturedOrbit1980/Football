/* Football's build replaces the version and list of exported files in this worker. */
const VERSION = "__BUILD__";
const PRECACHE = /** @type {string[]} */ (__PRECACHE__);
const scope = new URL(self.registration.scope);
const cachePrefix = `clubstride-football:${encodeURIComponent(scope.pathname)}:`;
const cacheName = cachePrefix + VERSION;
const urls = PRECACHE.map((path) => new URL(path, scope).href);
const exported = new Set(urls);

self.addEventListener("install", (event) => {
  // Activate only when the new export can open offline. A failed update leaves the old worker active.
  const requests = urls.map((url) => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "clubstride-offline-caches") {
    event.ports[0]?.postMessage({ cacheNames: [cacheName] });
  }
});

function exportedURL(request) {
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.origin + url.pathname;
  if (exported.has(path)) return path;
  if (request.mode === "navigate") {
    const directory = path.endsWith("/index.html") ? path.slice(0, -"index.html".length) : path + "/";
    if (exported.has(directory)) return directory;
  }
}

async function serve(request, key) {
  const cache = await caches.open(cacheName);
  // Each page must load the scripts from the same successfully installed export.
  return await cache.match(key) || fetch(request);
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.headers.has("range")) return;
  const key = exportedURL(event.request);
  if (key) event.respondWith(serve(event.request, key));
});
