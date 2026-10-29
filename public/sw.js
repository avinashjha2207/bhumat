// public/sw.js - Minimal PWA Service Worker for Android Chrome Installability
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle all live API / Supabase requests
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});