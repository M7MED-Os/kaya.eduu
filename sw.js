const CACHE_NAME = 'thanawya-v1.42';
const STATIC_ASSETS = [
    './',
    './index.html',
    './dashboard.html',
    './curriculum.html',
    './subject.html',
    './squad.html',
    './todo.html',
    './profile.html',
    './leaderboard.html',
    './lecture.html',
    './student-profile.html',
    './squad-profile.html',
    './assets/css/style.css',
    './assets/js/main.js',
    './assets/js/auth.js',
    // './assets/js/squad.js',
    './assets/js/dashboard.js',
    './assets/js/subject.js',
    './assets/js/profile.js',
    './assets/js/exam.js',
    './assets/js/supabaseClient.js',
    './assets/js/utils.js',
    './assets/js/utils/sounds.js',
    './assets/js/constants.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap'
];

// 1. Install - Cache Static Assets
self.addEventListener('install', (event) => {
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// 2. Activate - Cleanup Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    // Take control of all pages immediately
    self.clients.claim();
});

// 3. Fetch Strategy: Cache-First for static assets, Network-First for API
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Network-First for Supabase API calls (GET only - fresh data)
    if (url.hostname.includes('supabase.co')) {
        // Only cache GET requests (POST/RPC cannot be cached)
        if (request.method === 'GET') {
            event.respondWith(
                fetch(request)
                    .then((networkResponse) => {
                        // Cache successful GET responses
                        if (networkResponse.status === 200) {
                            const cacheCopy = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, cacheCopy));
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Fallback to cache if network fails
                        return caches.match(request);
                    })
            );
        }
        // For POST/RPC, just pass through (no caching)
        return;
    }

    // Cache-First for static assets (HTML, CSS, JS, images)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(request).then((networkResponse) => {
                // Cache new static assets on the fly
                if (request.method === 'GET' && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, cacheCopy));
                }
                return networkResponse;
            });
        }).catch(() => {
            // Offline Fallback for HTML
            if (request.headers.get('accept').includes('text/html')) {
                return caches.match('./dashboard.html');
            }
        })
    );
});

// 4. Handle skipWaiting message
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
