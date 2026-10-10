// Only the public offline explanation is cached. API responses and account data
// always go to the network; installing the app never stores private records.
const CACHE = 'mentra-offline-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/offline.html')));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mentra-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate' && url.origin === self.location.origin && !/^\/api(?:\/|$)/.test(url.pathname)) {
    event.respondWith(self.navigator.onLine === false
      ? caches.match('/offline.html')
      : fetch(event.request, {cache: 'no-store'}).catch(() => caches.match('/offline.html')));
  }
});
