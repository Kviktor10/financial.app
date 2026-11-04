const CACHE_NAME = 'mercado-financas-v5-cache';
const APP_CACHE_PREFIX = 'mercado-financas-';
const FILES = [
  './', './index.html', './styles.css', './manifest.webmanifest', './assets/icon.svg',
  './src/boot.js?v=1.4.0', './src/recover-cache.js?v=1.4.0', './src/app.js?v=1.4.0', './src/core/config.js', './src/core/utils.js', './src/core/local-db.js',
  './src/models/default-data.js', './src/security/crypto.js',
  './src/services/finance-service.js', './src/services/shopping-service.js',
  './src/services/product-import-service.js', './src/services/pdf-service.js', './src/services/report-service.js',
  './src/controllers/app-controller.js?v=1.4.0', './src/views/templates.js?v=1.4.0'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names
        .filter(name => name.startsWith(APP_CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação, módulos e folhas de estilo consultam a rede primeiro para evitar JS antigo.
  const updateFirst = request.mode === 'navigate'
    || /\.(?:js|css|html|webmanifest)$/.test(url.pathname);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (!updateFirst && cached) return cached;

    try {
      const response = await fetch(request, updateFirst ? { cache: 'no-store' } : undefined);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (cached) return cached;
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw error;
    }
  })());
});
