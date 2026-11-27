const scope = new URL(self.registration.scope);
const cachePrefix = `clubstride-lite:${encodeURIComponent(scope.pathname)}:`;
const CACHE_NAME = cachePrefix + 'v20';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './tailwind.min.css',
  './clubstride-tokens.css',
  './html2pdf.bundle.min.js',
  // App / PWA icons
  './icon.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './favicon-16.png',
  './favicon-32.png',
  // Clubstride CI brand lockups & symbols
  './assets/brand/L1_lockup_dark.svg',
  './assets/brand/L1_lockup_dark.png',
  './assets/brand/L1_lockup_light.svg',
  './assets/brand/L1_lockup_light.png',
  './assets/brand/L1_symbol_dark.svg',
  './assets/brand/L1_symbol_light.svg',
  './assets/brand/L1_appicon.svg',
  // Clubstride CI components
  './src/components/Icon.js',
  './src/components/SubBadge.js',
  './src/components/cs-init.js',
  // Clubstride CI icon set (24px grid, stroke 2, currentColor)
  './assets/icons/add.svg',
  './assets/icons/assist.svg',
  './assets/icons/attendance.svg',
  './assets/icons/back.svg',
  './assets/icons/camera.svg',
  './assets/icons/card-red.svg',
  './assets/icons/card-yellow.svg',
  './assets/icons/delete.svg',
  './assets/icons/drill-editor.svg',
  './assets/icons/edit.svg',
  './assets/icons/end-match.svg',
  './assets/icons/feedback.svg',
  './assets/icons/goal.svg',
  './assets/icons/home.svg',
  './assets/icons/lock.svg',
  './assets/icons/pause.svg',
  './assets/icons/pdf-export.svg',
  './assets/icons/play.svg',
  './assets/icons/pro-pill.svg',
  './assets/icons/settings.svg',
  './assets/icons/squad.svg',
  './assets/icons/star.svg',
  './assets/icons/stats.svg',
  './assets/icons/sub-in.svg',
  './assets/icons/sub-out.svg',
  './assets/icons/sub-swap.svg',
  './assets/icons/tactics.svg',
  './assets/icons/teams.svg',
  './assets/icons/timer.svg',
  './assets/icons/training.svg',
  './assets/icons/whistle.svg',
  // Fixed-colour substitution badges (never recoloured)
  './assets/icons/badges/sub-in-16.svg',
  './assets/icons/badges/sub-in-24.svg',
  './assets/icons/badges/sub-in-32.svg',
  './assets/icons/badges/sub-out-16.svg',
  './assets/icons/badges/sub-out-24.svg',
  './assets/icons/badges/sub-out-32.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS.map((path) => new Request(new URL(path, scope), { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key.startsWith(cachePrefix) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'clubstride-offline-caches') {
    event.ports[0]?.postMessage({ cacheNames: [CACHE_NAME] });
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.status === 200 && !response.redirected) {
      await cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return await cache.match(new URL('./index.html', scope)) || Response.error();
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.headers.has('range') ||
      url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(networkFirst(request));
});
