/* Denial Guru offline service worker.
   Bump VER on any release to invalidate old caches. */
const VER = "denial-guru-v2";
const RT  = VER + "-rt";
const APP = ["./", "./index.html", "./manifest.webmanifest",
             "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png",
             "./icon-180.png", "./favicon-32.png", "./favicon-16.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER && k !== RT).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page loads: network first so updates arrive, cached app when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone();
        caches.open(VER).then(c => c.put("./index.html", cp));
        return r;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Same-origin assets (icons, manifest): cache first.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        const cp = r.clone();
        caches.open(VER).then(c => c.put(req, cp));
        return r;
      }))
    );
    return;
  }

  // Google Fonts: serve cached, refresh in background. Offline before first
  // font fetch simply falls back to system fonts.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.open(RT).then(async c => {
        const hit = await c.match(req);
        const net = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
