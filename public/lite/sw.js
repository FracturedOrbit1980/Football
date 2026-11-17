const CACHE_NAME = 'Clubstride Lite-v19';
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Network-first with a cache fallback: a deployed fix has to actually reach installed PWAs, and
  // cache-first pinned every device to whichever index.html was cached at install. Serving the cache
  // copy of a *missing* asset used to hand back index.html, which broke the PDF engine outright.
  if (req.url.startsWith(self.location.origin)) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)));
        }
        return res;
      }).catch(() => caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((res) => res || fetch(req))
  );
});
