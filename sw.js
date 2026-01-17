/**
 * EBC Hub Service Worker
 * Enables offline functionality and app-like experience
 */

const CACHE_NAME = 'ebc-hub-v1';

// Base path detection (works for both localhost and GitHub Pages)
const BASE_PATH = self.location.pathname.replace('/sw.js', '');

const STATIC_ASSETS = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/styles.css`,
    `${BASE_PATH}/app.js`,
    `${BASE_PATH}/firebase-config.js`,
    `${BASE_PATH}/assets/splash-desktop.jpg`,
    `${BASE_PATH}/assets/splash-mobile.jpg`,
    `${BASE_PATH}/assets/icon-192.svg`,
    `${BASE_PATH}/assets/icon-512.svg`
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('📦 Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.warn('📦 Service Worker: Cache failed for some assets', error);
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('🗑️ Service Worker: Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Firebase and external requests - always go to network
    if (url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('gstatic')) {
        return;
    }

    // For navigation requests, try network first then cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match(`${BASE_PATH}/index.html`))
        );
        return;
    }

    // For other requests, try cache first then network
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then((networkResponse) => {
                    // Cache successful responses for static assets
                    if (networkResponse.ok &&
                        (url.pathname.endsWith('.js') ||
                            url.pathname.endsWith('.css') ||
                            url.pathname.endsWith('.png') ||
                            url.pathname.endsWith('.jpg'))) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                });
            })
    );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
