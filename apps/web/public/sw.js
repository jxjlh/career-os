/*
 * 最小 Service Worker —— AI Life OS
 * 策略（弱网优先）：
 *  - 静态资源（/_next/static/*, /icons/*）→ cache-first + 后台更新（秒级）
 *  - 导航请求（页面 HTML）→ cache-first + 后台更新；无缓存时才等网络，超时降级
 *  - API/POST 等动态请求 → 直通网络，不缓存
 * 弱网/离线体验的关键：HTML 与 JS/CSS 都从本地缓存秒出，网络只做后台刷新。
 * 仅用于增强 PWA 体验，iOS 不依赖 SW 即可"添加到主屏幕"。
 */
const CACHE = "lifeos-shell-v3";
const SHELL_PRECACHE = ["/", "/icons/career-os-appicon-192.png", "/icons/apple-touch-icon.png"];

// 无缓存时等待网络的上限（毫秒）。弱网下超时应尽快给出反馈，而不是干等。
const NAV_TIMEOUT = 3000;

const OFFLINE_FALLBACK = new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>离线</title>
  <div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#333;background:#F8F9FC;padding:24px;text-align:center">
    <div style="font-size:18px;font-weight:600">当前网络不可用</div>
    <div style="font-size:14px;color:#666;line-height:1.6">这个页面还没缓存过。<br/>请联网打开一次，之后就能离线秒开了。</div>
  </div>`,
  { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
);

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
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/")
  ) {
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

  // 导航请求：cache-first + 后台更新（弱网秒开的关键）
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);

        // 后台刷新：不论有没有缓存都发起，成功后写回缓存供下次使用
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone()).catch(() => undefined);
            return res;
          })
          .catch(() => undefined);

        // 命中缓存 → 立刻返回，不等网络
        if (cached) return cached;

        // 未命中 → 等网络，但最多等 NAV_TIMEOUT
        const timeout = new Promise((resolve) => setTimeout(() => resolve(undefined), NAV_TIMEOUT));
        const fresh = await Promise.race([network, timeout]);
        if (fresh) return fresh;

        return (await caches.match("/")) || OFFLINE_FALLBACK;
      })(),
    );
    return;
  }

  // 其余 GET 走默认（不缓存）
});
