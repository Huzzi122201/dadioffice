// Minimal service worker for PWA "Add to Home Screen" support
const CACHE_NAME = 'costing-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests and http/https protocols
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  // Bypass API requests so network errors are handled directly by the app
  if (e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request).catch(async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      return new Response('Network error occurred. Please check your connection.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain' })
      });
    })
  );
});

