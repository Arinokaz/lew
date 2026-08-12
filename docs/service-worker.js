const BUILD = "v2";
const APP_CACHE = `lew-app-${BUILD}`;
const DATA_CACHE = `lew-data-${BUILD}`;
const AUDIO_CACHE = `lew-audio-${BUILD}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./404.html",
  "./manifest.json",
  "./styles/reset.css",
  "./styles/tokens.css",
  "./styles/base.css",
  "./styles/components.css",
  "./src/vendor/dexie.min.mjs",
  "./src/app.js",
  "./src/router.js",
  "./src/services/db.js",
  "./src/services/srs.js",
  "./src/services/import.js",
  "./src/services/storage.js",
  "./src/services/settings.js",
  "./src/services/i18n.js",
  "./src/services/date.js",
  "./src/services/random.js",
  "./src/services/stats.js",
  "./src/services/streak.js",
  "./src/services/audio.js",
  "./src/services/audio-cache.js",
  "./src/services/achievements.js",
  "./src/services/backup.js",
  "./src/services/quiz-factory.js",
  "./src/components/icon.js",
  "./src/components/dialog.js",
  "./src/components/app-shell.js",
  "./src/components/toast.js",
  "./src/components/word-card.js",
  "./src/components/audio-player.js",
  "./src/components/quiz-choice.js",
  "./src/components/quiz-letters.js",
  "./src/components/quiz-input.js",
  "./src/components/quiz-cloze.js",
  "./src/components/progress-bar.js",
  "./src/components/streak-badge.js",
  "./src/components/stat-tile.js",
  "./src/components/toggle.js",
  "./src/components/slider.js",
  "./src/components/level-meter.js",
  "./src/pages/dashboard.js",
  "./src/pages/onboarding.js",
  "./src/pages/learn.js",
  "./src/pages/repeat.js",
  "./src/pages/quiz.js",
  "./src/pages/dictionary.js",
  "./src/pages/stats.js",
  "./src/pages/settings.js",
];

const DATA_URLS = ["./data/words.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const [appCache, dataCache] = await Promise.all([
        caches.open(APP_CACHE),
        caches.open(DATA_CACHE),
      ]);
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            await appCache.add(url);
          } catch (e) {
            console.warn("[SW] failed to precache", url);
          }
        })
      );
      await Promise.all(
        DATA_URLS.map(async (url) => {
          try {
            await dataCache.add(url);
          } catch (e) {
            console.warn("[SW] failed to precache data", url);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![APP_CACHE, DATA_CACHE, AUDIO_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (isOxfordAudio(url)) {
    event.respondWith(audioStrategy(req));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.endsWith("/words.json")) {
    event.respondWith(cacheFirst(req, DATA_CACHE));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(navigationStrategy(req));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, APP_CACHE));
    return;
  }
});

function isOxfordAudio(url) {
  return (
    url.hostname === "www.oxfordlearnersdictionaries.com" &&
    (url.pathname.endsWith(".mp3") || url.pathname.endsWith(".ogg"))
  );
}

async function audioStrategy(req) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(new Request(req.url, { mode: "no-cors" }));
    if (res && (res.ok || res.type === "opaque")) {
      try { cache.put(req, res.clone()); } catch (e) {}
    }
    return res;
  } catch (e) {
    return new Response("Audio unavailable offline", { status: 503 });
  }
}

async function navigationStrategy(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) {
      try { await cache.put(req, res.clone()); } catch (e) {}
      return res;
    }
    if (res.status === 404 || res.status === 0) {
      const cached = await cache.match("./index.html");
      if (cached) return cached;
    }
    return res;
  } catch (e) {
    const cached = await cache.match("./index.html");
    if (cached) return cached;
    return new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return cached || new Response("Offline", { status: 503 });
  }
}