const CACHE_NAME = 'geointerpreter-cache-v1';
const urlsToCache = [
  '/',
  '/Geointerpreter.html',
  '/css/bootstrap.min.css',
  '/css/fontgis.min.css',
  '/css/geointerpreter.css',
  '/css/datatables.min.css',
  '/scripts/geointerpreter_entryapp.js',
  // IMPORTANT: You will need to update the paths to your WASM and database files
  // based on your final application structure.
  // e.g., '/node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to cache resources during install:', error);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a stream and can only be consumed once.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response because it's a stream and can only be consumed once.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});
