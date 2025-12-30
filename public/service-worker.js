const CACHE_NAME = 'checkpoint-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.json',
  './alternatif.png'
];

// 1. Yükleme (Install) - Dosyaları önbelleğe al
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Önbellek açıldı');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. İstek Yakalama (Fetch) - İnternet yoksa önbellekten ver
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Önbellekte varsa onu döndür, yoksa internetten çek
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// 3. Aktivasyon (Activate) - Eski önbellekleri temizle
self.addEventListener('activate', function(event) {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});