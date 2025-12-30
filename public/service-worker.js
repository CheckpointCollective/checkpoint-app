const CACHE_NAME = 'checkpoint-v4-fix'; // İSMİ DEĞİŞTİRDİM (Telefon eskiyi silsin diye)
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.json',
  './alternatif.png'
];

// 1. KURULUM (Eski sürümü hemen devre dışı bırak)
self.addEventListener('install', function(event) {
  self.skipWaiting(); // Bekleme yapma, hemen güncelle!
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Önbellek v4 açıldı');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. İSTEK YAKALAMA (Ağ Öncelikli Strateji - Network First)
self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // İnternet var! En güncel hali aldık.
        // Bunu hemen önbelleğe de atalım ki sonra lazım olur.
        if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
                cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(function() {
        // İnternet yoksa önbellekten ver
        return caches.match(event.request);
      })
  );
});

// 3. AKTİVASYON (Eski çöpleri temizle)
self.addEventListener('activate', function(event) {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Eski önbellek siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        return self.clients.claim();
    })
  );
});