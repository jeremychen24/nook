// Network first so updates show up right away; the cache keeps the app working offline.

const CACHE = 'nook-v13';
// Paintings are big and never change, so they keep their own cache across app updates.
const ART_CACHE = 'nook-art-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/timer.js',
  'js/tasks.js',
  'js/sounds.js',
  'js/lock.js',
  'js/rewards.js',
  'js/stats.js',
  'js/charts.js',
  'js/exams.js',
  'js/plan.js',
  'js/planview.js',
  'js/ics.js',
  'js/quit.js',
  'js/spare.js',
  'js/badges.js',
  'js/pixel.js',
  'js/decor.js',
  'js/scenes/index.js',
  'js/scenes/outside.js',
  'js/scenes/cafe.js',
  'js/scenes/library.js',
  'js/scenes/classroom.js',
  'js/scenes/train.js',
  'js/scenes/rooftop.js',
  'js/scenes/art.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== ART_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// GitHub Pages tells browsers to reuse files for 10 minutes. 'no-cache' asks the server whether
// each file changed (a tiny check when it hasn't), so a new version shows on the next open.
// Page loads can't take extra fetch options, so those are fetched by URL.
const fresh = req => (req.mode === 'navigate'
  ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
  : fetch(req, { cache: 'no-cache' }));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Paintings download the first time a scene shows them, then come from the cache.
  if (new URL(req.url).pathname.includes('/art/')) {
    e.respondWith(caches.open(ART_CACHE).then(c => c.match(req).then(hit => hit ?? fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  e.respondWith(
    fresh(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});
