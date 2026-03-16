const STATIC_CACHE = "het-noc-static-v2";
const RUNTIME_CACHE = "het-noc-runtime-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./config.js",
  "./assets/css/style.css?v=20260311prod",
  "./assets/js/api.js?v=20260311prod",
  "./assets/js/charts.js?v=20260311prod",
  "./assets/js/render.js?v=20260311prod",
  "./assets/js/app.js?v=20260311prod",
  "./assets/img/icon-192.png",
  "./assets/img/icon-512.png",
  "./assets/img/apple-touch-icon-180.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.pathname.includes("/api/")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (_) {
    if (request.mode === "navigate") {
      const offline = await caches.match("./offline.html");
      if (offline) return offline;
    }
    throw _;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match("./offline.html");
    if (fallback && request.mode === "navigate") return fallback;
    throw _;
  }
}
