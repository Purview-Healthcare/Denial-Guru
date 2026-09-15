/* Denial Guru offline service worker.
   Bump VER on any release to invalidate old caches. */
const VER = "denial-guru-v5";
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
  if (req.method !== "GET") return;   // never touch the sign-up/login POSTs
  const url = new URL(req.url);

  // Page loads and config.js: network-first so updates (and the SCRIPT_URL) arrive,
  // cached copy when offline.
  if (req.mode === "navigate" || url.pathname.endsWith("/config.js")) {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone();
        caches.open(VER).then(c => c.put(req.mode === "navigate" ? "./index.html" : req, cp));
        return r;
      }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
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

  // Google Fonts: cached, refresh in background.
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
