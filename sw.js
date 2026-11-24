/* Friday service worker: cache the app shell so the home screen still opens offline. */
var CACHE = "friday-shell-v24";
var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./config.js",
  "./css/app.css",
  "./js/storage.js",
  "./js/orb.js",
  "./js/bubbles.js",
  "./js/voice.js",
  "./js/brain.js",
  "./js/chat.js",
  "./js/pictures.js",
  "./js/robot.js",
  "./js/life.js",
  "./js/extras.js",
  "./js/native.js",
  "./js/private.js",
  "./js/phone.js",
  "./js/eyes.js",
  "./js/neural.js",
  "./js/tools.js",
  "./js/settings.js",
  "./js/app.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && req.url.indexOf("make_profile") === -1) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        if (req.mode === "navigate") return caches.match("./index.html");
        return caches.match(req);
      });
    })
  );
});
