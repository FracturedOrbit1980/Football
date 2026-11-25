/* Football service worker. scripts/build-sw.mjs replaces __BUILD__ and __PRECACHE__ in out/sw.js after `next build`.
   Paths are relative to the registration scope, so it works under /Football/ (GitHub Pages) and at /.
   Only same-origin app files are cached. Supabase and other cross-origin requests (personal data) are never cached. */
const VERSION = "__BUILD__";
const PRECACHE = /** @type {string[]} */ (__PRECACHE__);
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const scope = new URL(self.registration.scope);
const at = (path) => new URL(path, scope).toString();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then(async (cache) => {
      // Add one by one so a single missing file does not abort the install.
      await Promise.all(PRECACHE.map((path) => cache.add(at(path)).catch(() => undefined)));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== RUNTIME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function fromCache(request) {
  return (await caches.match(request, { ignoreSearch: request.mode === "navigate" })) ?? undefined;
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(RUNTIME)).put(request, response.clone());
    return response;
  } catch {
    const url = new URL(request.url);
    const withSlash = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    return (
      (await fromCache(request)) ??
      (await caches.match(url.origin + withSlash)) ??
      (await caches.match(url.origin + withSlash + "index.html")) ??
      (await caches.match(at("index.html"))) ??
      (await caches.match(at(""))) ??
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) (await caches.open(RUNTIME)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const hit = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) (await caches.open(RUNTIME)).put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return hit ?? (await network) ?? new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (request.mode === "navigate") return event.respondWith(networkFirstPage(request));
  if (url.pathname.includes("/_next/static/")) return event.respondWith(cacheFirst(request));
  event.respondWith(staleWhileRevalidate(request));
});
