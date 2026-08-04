/*
 * 最小 Service Worker —— AI Life OS
 * 策略：
 *  - 静态资源（/_next/static/*, /icons/*）→ stale-while-revalidate（秒级缓存）
 *  - 导航请求 → network-first（联网优先，离线降级到缓存，最后降级到 /）
 *  - API/POST 等动态请求 → 直通网络，不缓存
 * 仅用于增强 PWA 体验，iOS 不依赖 SW 即可"添加到主屏幕"。
 */
const CACHE = "lifeos-shell-v1";
const SHELL_PRECACHE = ["/", "/icons/career-os-appicon-192.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_PRECACHE).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 静态资源：stale-while-revalidate
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // 导航请求：network-first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/")) || Response.error();
        }),
    );
    return;
  }

  // 其余 GET 走默认（不缓存）
});
