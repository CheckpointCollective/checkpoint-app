const CACHE_NAME = 'cp-app-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/CP_Logo.png'
];

// Kurulum: Dosyaları önbelleğe al
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Fetch: İnternet varsa oradan, yoksa hafızadan getir
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});