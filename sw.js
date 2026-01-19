const CACHE_NAME = 'thanaweya-v3'; // Incremented version
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './login.html',
    './dashboard.html',
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
    // If found in cache, use it. If not, fetch from net and cache it.
    if (event.request.destination === 'image' || event.request.destination === 'font' || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|woff2)$/)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 3. HTML, JS, CSS -> Network First (Ensure Updates)
    // Try network. If fails (offline), use cache.
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone()); // Update cache with new version
                    return networkResponse;
                });
            })
            .catch(() => {
                return caches.match(event.request); // Fallback to offline cache
            })
    );
});
