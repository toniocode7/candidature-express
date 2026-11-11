/* Service worker : app utilisable hors ligne, mises à jour récupérées au lancement. */
const VERSION = "ce-v1";
const CORE = ["./", "index.html", "app.js", "config.js", "ce/boot.js", "ce/ai.js", "ce/ce.css", "manifest.webmanifest",
  "vendor/supabase.js", "icons/icon-192.png", "icons/apple-touch-icon.png"];
const LAZY = /\/vendor\/|fonts\.(googleapis|gstatic)\.com/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !LAZY.test(req.url)) return;
  if (LAZY.test(req.url)) {
    // Bibliothèques et polices : le cache d'abord.
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // Code de l'app : le réseau d'abord (mises à jour), le cache si hors ligne.
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("index.html"))));
});
