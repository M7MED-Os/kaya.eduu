const CACHE_NAME = 'thanaweya-v4'; // Incremented version
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './login.html',
    './dashboard.html',
    './offline.html',
    './assets/css/style.css',
    './assets/js/main.js',
    './assets/js/auth.js',
    './assets/js/supabaseClient.js',
    './manifest.json'
];

// Install
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        )).then(() => self.clients.claim())
    );
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Ignore API calls (Supabase, etc) - let them go to network directly
    if (!url.origin.includes(self.location.origin)) {
        return;
    }

    // 2. Images & Fonts -> Cache First (Save Data!)
    if (event.request.destination === 'image' || event.request.destination === 'font' || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|woff2)$/)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request)
                    .then((networkResponse) => {
                        return caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        });
                    })
                    .catch(() => {
                        // Return nothing or a placeholder if image fails
                        return new Response('', { status: 404, statusText: 'Not Found' });
                    });
            })
        );
        return;
    }

    // 3. HTML (Navigation) -> Network First, Fallback to Offline Page
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    return caches.match(event.request).then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        return caches.match('./offline.html');
                    });
                })
        );
        return;
    }

    // 4. JS, CSS -> Network First
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    // If not in cache, returning undefined here causes the error.
                    // We should return a 404 or empty response if it's not critical, 
                    // or ensure critical assets are undoubtedly in cache.
                    if (cachedResponse) return cachedResponse;
                    return new Response('', { status: 408, statusText: 'Request Timeout' });
                });
            })
    );
});
