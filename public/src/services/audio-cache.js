const CACHE_NAME = "lew-audio-v1";

export async function getCached(url) {
  if (!url) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(url);
  } catch (e) {
    return null;
  }
}

export async function precacheUrls(urls, onProgress) {
  const total = urls.length;
  let done = 0;
  for (const url of urls) {
    if (!url) {
      done += 1;
      continue;
    }
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url);
      if (!cached) {
        const res = await fetch(new Request(url, { mode: "no-cors" }));
        if (res && (res.ok || res.type === "opaque")) {
          await cache.put(url, res.clone());
        }
      }
    } catch (e) {
      console.warn("[audio-cache] failed", url, e);
    }
    done += 1;
    if (onProgress) onProgress(done, total);
  }
}

export async function clearAudioCache() {
  return caches.delete(CACHE_NAME);
}

export async function getAudioCacheSize() {
  if (!navigator.storage?.estimate) return 0;
  const est = await navigator.storage.estimate();
  return est.usage || 0;
}