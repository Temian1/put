// Offline support. Hashed build assets never change, so they are cache-first.
// The page itself is network-first so a new deploy is picked up on the next
// online visit, falling back to the cached copy when offline.
const VERSION = "mamaput-v2";
const SCOPE = self.registration.scope;
const SHELL = [
  "./",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL.map((p) => new URL(p, SCOPE))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const putInCache = (request, response) => {
  if (response.ok || response.type === "opaque") {
    const copy = response.clone();
    caches.open(VERSION).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const fonts =
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com";
  if (!fonts && !request.url.startsWith(SCOPE)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => putInCache(new URL("./", SCOPE), res))
        .catch(() => caches.match(new URL("./", SCOPE))),
    );
    return;
  }
  // Editable lists such as food/manifest.json: fresh when online.
  if (url.pathname.endsWith(".json") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(
      fetch(request)
        .then((res) => putInCache(request, res))
        .catch(() => caches.match(request)),
    );
    return;
  }
  // Fonts, hashed assets, icons and food art: serve from cache, fill on first use.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request)
          .then((res) => putInCache(request, res))
          .catch(() => hit),
    ),
  );
});
