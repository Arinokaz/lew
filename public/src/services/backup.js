import db, { replaceAll, replaceWords, invalidateCache } from "./db.js";

const LS_PREFIX = "lew.";

export function clearAllLocalStorage() {
  if (typeof localStorage === "undefined") return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LS_PREFIX)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}

export async function exportToJson() {
  const [words, progress, stats, achievements] = await Promise.all([
    db.words.toArray(),
    db.progress.toArray(),
    db.stats.toArray(),
    db.achievements.toArray(),
  ]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    words: words.length,
    progress: progress.length,
    stats: stats.length,
    achievements: achievements.length,
    data: { words, progress, stats, achievements },
  };
}

export function downloadJson(data, filename = `lew-backup-${Date.now()}.json`) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importFromJson(jsonText, opts = {}) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("Backup is not valid JSON");
  }
  if (!data || !data.data) throw new Error("Invalid backup format");
  const { words, progress, stats, achievements } = data.data;
  const counts = {
    words: Array.isArray(words) ? words.length : 0,
    progress: Array.isArray(progress) ? progress.length : 0,
    stats: Array.isArray(stats) ? stats.length : 0,
    achievements: Array.isArray(achievements) ? achievements.length : 0,
  };
  if (opts.replace) {
    await replaceAll({ words, progress, stats, achievements });
  } else {
    if (Array.isArray(words)) await db.words.bulkPut(words);
    if (Array.isArray(progress)) await db.progress.bulkPut(progress);
    if (Array.isArray(stats)) await db.stats.bulkPut(stats);
    if (Array.isArray(achievements)) await db.achievements.bulkPut(achievements);
    invalidateCache();
  }
  return counts;
}

export async function reimportDataset(onProgress) {
  const res = await fetch("./data/words.json");
  if (!res.ok) throw new Error("Failed to load words.json");
  const raw = await res.json();
  const { mapAll } = await import("./import.js");
  const mapped = mapAll(raw);
  await replaceWords(mapped);
  if (onProgress) onProgress(mapped.length, mapped.length);
  return mapped.length;
}

export async function resetAll() {
  await db.transaction(
    "rw",
    [db.words, db.progress, db.stats, db.achievements],
    async () => {
      await db.words.clear();
      await db.progress.clear();
      await db.stats.clear();
      await db.achievements.clear();
    }
  );
  invalidateCache();
  clearAllLocalStorage();
}
