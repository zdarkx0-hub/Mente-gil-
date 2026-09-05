const CACHE_VERSION = "mente-agil-shell-v2";
const OFFLINE_URL = "/offline.html";
const APP_SHELL = [
  "/",
  "/treinar",
  "/treinar/especificos",
  "/revisar",
  "/progresso",
  "/progresso/conquistas",
  "/ranking"
];
const CORE_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

async function cacheShell() {
  const cache = await caches.open(CACHE_VERSION);
  await cache.addAll(CORE_ASSETS);
  await Promise.allSettled(APP_SHELL.map(async (path) => {
    const response = await fetch(path, { cache: "reload" });
    if (response.ok) await cache.put(path, response.clone());
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true }))
      || (fallbackPath ? await cache.match(fallbackPath) : null)
      || await cache.match(OFFLINE_URL);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, APP_SHELL.includes(url.pathname) ? url.pathname : "/"));
    return;
  }

  const isStaticAsset = url.pathname.startsWith("/_next/")
    || url.pathname.startsWith("/icons/")
    || url.pathname === "/manifest.webmanifest"
    || ["script", "style", "font", "image"].includes(request.destination);

  if (isStaticAsset) event.respondWith(cacheFirst(request));
});
