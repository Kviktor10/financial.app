const CACHE_NAME = 'mercado-financas-v1-cache';
const FILES = [
  './', './index.html', './styles.css', './manifest.webmanifest', './assets/icon.svg',
  './src/app.js', './src/core/config.js', './src/core/utils.js', './src/core/local-db.js',
  './src/models/default-data.js', './src/security/crypto.js',
  './src/services/finance-service.js', './src/services/shopping-service.js',
  './src/controllers/auth-controller.js', './src/controllers/app-controller.js', './src/views/templates.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
