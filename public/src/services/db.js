import Dexie from "../vendor/dexie.min.mjs";

const db = new Dexie("lew");

db.version(1).stores({
  words: "id, word, level, type",
  progress: "wordId, nextReview, lastReview",
  stats: "date",
  achievements: "id",
});

db.version(2).stores({
  words: "id, word, level, type",
  progress: "wordId, nextReview, lastReview, points, lastTouchedDate",
  stats: "date",
  achievements: "id",
});

db.version(3).stores({
  words: "id, word, level, type",
  progress: "wordId, nextReview, lastReview, points, lastTouchedDate",
  stats: "date",
  achievements: "id, unlockedAt",
});

export default db;

export async function getWord(id) {
  return db.words.get(id);
}

export async function getWordsByLevel(level) {
  return db.words.where("level").equals(level).toArray();
}

export async function getWordsByIds(ids) {
  if (!ids.length) return [];
  return db.words.where("id").anyOf(ids).toArray();
}

export async function getProgress(wordId) {
  return db.progress.get(wordId);
}

export async function getProgressBulk(wordIds) {
  if (!Array.isArray(wordIds) || wordIds.length === 0) return [];
  return db.progress.bulkGet(wordIds);
}

export async function putProgress(progress) {
  return db.progress.put(progress).then(() => invalidateCache("progress"));
}

export async function bulkPutProgress(progresses) {
  return db.progress.bulkPut(progresses).then(() => invalidateCache("progress"));
}

export async function replaceWords(words) {
  return db.transaction("rw", db.words, async () => {
    await db.words.clear();
    if (Array.isArray(words) && words.length) {
      await db.words.bulkPut(words);
    }
  }).then(() => invalidateCache("words"));
}

export async function replaceAll({ words, progress, stats, achievements }) {
  return db.transaction(
    "rw",
    [db.words, db.progress, db.stats, db.achievements],
    async () => {
      await db.words.clear();
      await db.progress.clear();
      await db.stats.clear();
      await db.achievements.clear();
      if (Array.isArray(words) && words.length) await db.words.bulkPut(words);
      if (Array.isArray(progress) && progress.length) await db.progress.bulkPut(progress);
      if (Array.isArray(stats) && stats.length) await db.stats.bulkPut(stats);
      if (Array.isArray(achievements) && achievements.length) await db.achievements.bulkPut(achievements);
    }
  ).then(() => invalidateCache());
}

export async function getStats(date) {
  return db.stats.get(date);
}

export async function putStats(stats) {
  await db.stats.put(stats);
  invalidateCache("stats");
}

export async function getAllProgress() {
  return cached("progress", () => db.progress.toArray());
}

export async function getAllWords() {
  return cached("words", () => db.words.toArray());
}

const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function cached(key, loader) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.value;
  const value = await loader();
  _cache.set(key, { value, ts: Date.now() });
  return value;
}

export function invalidateCache(key) {
  if (key) _cache.delete(key);
  else _cache.clear();
}

export async function getAchievement(id) {
  return db.achievements.get(id);
}

export async function putAchievement(ach) {
  await db.achievements.put(ach);
  invalidateCache("achievements");
}

export async function getAllAchievements() {
  return cached("achievements", () => db.achievements.toArray());
}

export async function wordsCount() {
  return db.words.count();
}

export async function progressCount() {
  return db.progress.count();
}

export async function clearWords() {
  await db.words.clear();
  invalidateCache("words");
}

export async function clearAll() {
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
}

export async function exportAll() {
  const [words, progress, stats, achievements] = await Promise.all([
    db.words.toArray(),
    db.progress.toArray(),
    db.stats.toArray(),
    db.achievements.toArray(),
  ]);
  return { words, progress, stats, achievements, exportedAt: Date.now() };
}

export async function importAll(data) {
  return replaceAll(data);
}

export function withTimeout(promise, ms = 8000, fallback = null) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export { db };
