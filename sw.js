// Offline support for the guide app: app files from cache, API always from the network.
const CACHE = 'el-guides-v4';
const SHELL = ['guide.html', 'office.html', 'config.js?v=5', 'app-core.js?v=2', 'logo.png', 'manifest.json', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('script.google.com') || u.hostname.endsWith('googleusercontent.com')) return;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.origin !== location.origin && !isFont) return;
  // network first (fresh when online), cache as fallback (offline)
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: !isFont }).then(r => r || caches.match('guide.html'))));
});
