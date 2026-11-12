/* Service worker : app utilisable hors ligne, mises à jour récupérées au lancement. */
const VERSION = "ce-v1";
const CORE = ["./", "index.html", "app.js", "config.js", "ce/boot.js", "ce/ai.js", "ce/search.js", "ce/notify.js", "ce/criteria.js", "ce/ce.css", "manifest.webmanifest",
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
  // Code de l'app : ouverture immédiate depuis le cache, mise à jour en arrière-plan
  // (la nouvelle version est utilisée à l'ouverture suivante).
  const net = fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  });
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => caches.match("index.html"));
  }));
});

/* Notifications : affichage et ouverture de l'app au bon endroit. */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Candidature Express", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Candidature Express", {
    body: d.body || "", tag: d.tag || undefined, icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return clients.openWindow(url);
  }));
});
