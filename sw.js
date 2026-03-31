/**
 * c:\Users\PL2\Documents\write\sw.js
 * Service Worker pour Write Online Revolution.
 * Optimisé pour GitHub Pages avec stratégie: Network First => Fallback Cache.
 */

const CACHE_NAME = 'write-online-v4-ghpages';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/style.css',
    './assets/js/app.js',
    './assets/js/db.js',
    './assets/js/ui.js',
    './assets/js/editor.js',
    './assets/js/collab.js',
    
    // Ressources externes (CDN) 
    'https://cdn.quilljs.com/1.3.6/quill.snow.css',
    'https://cdn.quilljs.com/1.3.6/quill.js',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://unpkg.com/turndown/dist/turndown.js',
    
    // Yjs / ESM.sh dependencies (mise en cache des libs collaboration)
    'https://esm.sh/yjs@13.6.8',
    'https://esm.sh/y-webrtc@10.3.0?deps=yjs@13.6.8',
    'https://esm.sh/y-quill@0.1.5?deps=yjs@13.6.8',
    'https://esm.sh/quill-cursors@4.0.2'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(err => console.warn('Cache warning:', err));
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Stratégie: Network First, fallback to cache
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    
    e.respondWith(
        fetch(e.request).then(response => {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
            return response;
        }).catch(() => {
            return caches.match(e.request);
        })
    );
});
