self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch to support online sovereign tally streams
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});