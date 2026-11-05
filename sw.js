
const CACHE = "sql-fraud-trainer-v0.1.0";
const APP_ASSETS = [
  "./","./index.html","./styles.css","./app.js","./tasks.json","./db.sql",
  "./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"
];
const SQL_JS = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js";
const SQL_WASM = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.wasm";

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_ASSETS);
    for (const url of [SQL_JS, SQL_WASM]) {
      try {
        const res = await fetch(url, {mode:"cors"});
        if (res.ok) await cache.put(url, res.clone());
      } catch (_) {}
    }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE);
      if (req.method === "GET") cache.put(req, res.clone()).catch(()=>{});
      return res;
    } catch (e) {
      if (req.mode === "navigate") return caches.match("./index.html");
      throw e;
    }
  })());
});
