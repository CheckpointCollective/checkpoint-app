const CACHE_NAME = 'checkpoint-cache-v2'; // Versiyonu v2 yaptık!
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.json',
  './alternatif.png'
];

// 1. Yükleme (Install)
self.addEventListener('install', function(event) {
  // Yeni SW yüklenirken eskisini bekleme, hemen aktif ol
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Önbellek v2 açıldı');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. İstek Yakalama (Fetch) - ÖNCE İNTERNET, SONRA HAFIZA (Network First)
self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // İnternetten başarılı cevap gelirse:
        // 1. Cevabın bir kopyasını al
        const responseClone = response.clone();
        
        // 2. Yeni versiyonu hafızaya kaydet (Gelecek sefer internetsiz kalırsan kullan diye)
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        
        // 3. Kullanıcıya canlı veriyi ver
        return response;
      })
      .catch(function() {
        // İnternet yoksa veya hata olursa hafızaya dön
        return caches.match(event.request);
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
            console.log('Eski önbellek siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        // Sayfanın kontrolünü hemen ele al
        return self.clients.claim();
    })
  );
});