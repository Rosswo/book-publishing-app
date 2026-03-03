// =====================================
// SERVICE WORKER — Branch 8 (Safe Dynamic Support)
// =====================================

const CACHE_VERSION = "v2";
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

// INSTALL
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => {
            return cache.addAll(SHELL_FILES);
        })
    );
    self.skipWaiting();
});

// ACTIVATE
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

    // 🔹 Network-first for /books/
    if (request.url.includes("/books/")) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    return caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, response.clone());
                        return response;
                    });
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
        return;
    }

    // 🔹 Cache-first for shell
    event.respondWith(
        caches.match(request).then((cached) => {
            return cached || fetch(request);
        })
    );
});