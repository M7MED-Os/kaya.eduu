const CACHE_NAME = 'thanaweya-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/login.html',
    '/dashboard.html',
    '/assets/css/style.css',
    '/assets/js/main.js',
    '/assets/js/auth.js',
    // Add other critical assets here
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
