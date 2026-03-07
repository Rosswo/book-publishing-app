// =====================================
// SERVICE WORKER — Branch 9 (Network-First Shell)
// =====================================
// FIX 3: Shell files now use network-first strategy.
// When online → always fetches fresh JS/CSS/HTML from server.
// When offline → falls back to cache.
// This means APK users always see updates without clearing data.

const CACHE_VERSION = "v3";
const SHELL_CACHE = `bookapp-shell-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `bookapp-dynamic-${CACHE_VERSION}`;

const SHELL_FILES = [
    "/",
    "/index.html",
    "/css/base.css",
    "/css/library.css",
    "/css/reader.css",
    "/css/components.css",
    "/js/history.js",
    "/js/settings.js",
    "/js/ui.js",
    "/js/core.js",
    "/js/app.js"
];

// INSTALL — pre-cache shell files
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => {
            return cache.addAll(SHELL_FILES);
        })
    );
    self.skipWaiting();
});

// ACTIVATE — delete any caches from old versions
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => !key.includes(CACHE_VERSION))
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// FETCH
self.addEventListener("fetch", (event) => {
    const request = event.request;

    // Books content: network-first (always get latest published content)
    if (request.url.includes("/books/")) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    return caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, response.clone());
                        return response;
                    });
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Shell files (JS, CSS, HTML): network-first so updates always apply
    // Falls back to cache if offline
    const isShell = SHELL_FILES.some((path) => request.url.endsWith(path));
    if (isShell) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    return caches.open(SHELL_CACHE).then((cache) => {
                        cache.put(request, response.clone());
                        return response;
                    });
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Everything else: cache-first (icons, fonts, CDN assets)
    event.respondWith(
        caches.match(request).then((cached) => {
            return cached || fetch(request);
        })
    );
});