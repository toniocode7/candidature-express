/* Service worker : app utilisable hors ligne, mises à jour récupérées au lancement. */
const VERSION = "ce-v1";
// Données de la carte : elles ne changent pas d'une version à l'autre, elles gardent leur propre cache.
const GEO_CACHE = "ce-geo-v1";
const CORE = ["./", "index.html", "app.js", "config.js", "ce/errors.js", "ce/boot.js", "ce/ai.js", "ce/search.js", "ce/notify.js", "ce/criteria.js", "ce/ce.css", "manifest.webmanifest",
  "vendor/supabase.js", "icons/icon-192.png", "icons/apple-touch-icon.png"];
const LAZY = /\/vendor\/|fonts\.(googleapis|gstatic)\.com/;

// Empreinte de chaque fichier, écrite à la publication (tests/publier.cjs). Vide en local : tout est téléchargé.
const HASH = {};

// Installation d'une nouvelle version : un fichier dont l'empreinte n'a pas changé est recopié depuis la version
// précédente déjà sur l'appareil ; seuls les fichiers modifiés sont téléchargés.
async function prendre(cache, f) {
  const h = HASH[f], key = h ? f + "?h=" + h : f;
  if (h) {
    const old = await caches.match(new URL(key, self.registration.scope).href);
    if (old) return cache.put(key, old);
  }
  const res = await fetch(f, { cache: "no-cache" });
  if (!res.ok) throw new Error(f + " : " + res.status);
  return cache.put(key, res);
}
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(f => prendre(c, f)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== GEO_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !LAZY.test(req.url)) return;
  if (same && /\/geo\.json$/.test(url.pathname)) {
    e.respondWith(caches.open(GEO_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
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
  // Pastille sur l'icône : mise à jour même app fermée quand la notification en donne le nombre.
  if (typeof d.badge === "number" && self.navigator && self.navigator.setAppBadge) {
    try { (d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()).catch(() => {}); } catch (_) {}
  }
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
