import db, { invalidateCache } from "./db.js";
import { startOfDay, todayKey } from "./date.js";
import { CEFR_LEVELS } from "./settings.js";
import * as storage from "./storage.js";

export { CEFR_LEVELS };

const LEVEL_TOTALS = {
  A1: 1076,
  A2: 992,
  B1: 903,
  B2: 1573,
  C1: 1404,
};

const DAILY_POOL_KEY_PREFIX = "learnDailyPool.";

function loadDailySnapshot(storageKey) {
  const raw = storage.get(storageKey, null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!Array.isArray(raw.ids)) return null;
  return raw;
}

export async function getDailyLearnPool(activeLevels, dailyNorm) {
  const quota = Math.max(0, safeInt(dailyNorm, 0));
  const today = todayKey();
  const storageKey = DAILY_POOL_KEY_PREFIX + today;

  const snapshot = loadDailySnapshot(storageKey);
  if (snapshot && snapshot.quota === quota) {
    const words = await db.words.where("id").anyOf(snapshot.ids).toArray();
    const wordById = new Map(words.map((w) => [w.id, w]));
    return snapshot.ids.map((id) => wordById.get(id)).filter(Boolean);
  }

  const fresh = await getNewWordPool(activeLevels, quota);
  const ids = fresh.map((w) => w.id);
  storage.set(storageKey, { quota, ids });
  return fresh;
}

export function clearDailyLearnPool() {
  const today = todayKey();
  storage.remove(DAILY_POOL_KEY_PREFIX + today);
}

export const MIN_EF = 1.3;
export const MAX_INTERVAL = 365;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const STAGE_UP_POINTS = 20;
export const MAX_POINTS = 100;
export const DAILY_CAP = 20;
export const RESET_WRONG_THRESHOLD = 3;

const DEFAULT_EF = 2.5;
const MASTERED_INITIAL_INTERVAL = 60;

const STAGE_UP_INTERVALS = [null, 1, 6, 16, 45];

function safeNumber(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function safeInt(value, fallback) {
  const n = safeNumber(value, fallback);
  return Math.max(0, Math.floor(n));
}

export function createProgress(wordId) {
  const now = Date.now();
  return {
    wordId,
    EF: DEFAULT_EF,
    interval: 0,
    repetition: 0,
    nextReview: now,
    lastReview: null,
    successCount: 0,
    failCount: 0,
    points: 0,
    pointsAtIntervalStart: 0,
    accumulatedToday: 0,
    wrongToday: 0,
    lastTouchedDate: null,
  };
}

export function normalizeProgress(progress) {
  const today = todayKey();
  const base = {
    wordId: progress?.wordId,
    EF: safeNumber(progress?.EF, DEFAULT_EF),
    interval: safeInt(progress?.interval, 0),
    repetition: safeInt(progress?.repetition, 0),
    successCount: safeInt(progress?.successCount, 0),
    failCount: safeInt(progress?.failCount, 0),
    points: safeInt(progress?.points, 0),
    pointsAtIntervalStart: safeInt(progress?.pointsAtIntervalStart, 0),
    accumulatedToday: safeInt(progress?.accumulatedToday, 0),
    wrongToday: safeInt(progress?.wrongToday, 0),
    lastTouchedDate:
      typeof progress?.lastTouchedDate === "string"
        ? progress.lastTouchedDate
        : null,
    lastReview:
      typeof progress?.lastReview === "number" ? progress.lastReview : null,
    nextReview:
      typeof progress?.nextReview === "number"
        ? progress.nextReview
        : Date.now(),
  };
  if (base.points > MAX_POINTS) base.points = MAX_POINTS;
  if (base.accumulatedToday > DAILY_CAP) base.accumulatedToday = DAILY_CAP;
  if (base.lastTouchedDate && base.lastTouchedDate !== today) {
    base.pointsAtIntervalStart = base.points;
    base.accumulatedToday = 0;
    base.wrongToday = 0;
    base.lastTouchedDate = today;
  }
  return base;
}

export function stageFromPoints(points) {
  if (points >= MAX_POINTS) return 5;
  return Math.max(0, Math.floor(safeInt(points, 0) / STAGE_UP_POINTS));
}

export function isMastered(progress) {
  if (!progress) return false;
  return safeInt(progress.points, 0) >= MAX_POINTS;
}

export const POINTS_FOR_QUIZ_TYPE = {
  "en-to-l1": 5,
  "l1-to-en": 5,
  "audio-to-en": 5,
  "cloze-choice": 5,
  "tile-l1-en": 10,
  "tile-audio-en": 10,
  "type-in": 20,
  "cloze": 20,
  "audio-type-in": 20,
};

export function pointsForQuizType(quizType) {
  return POINTS_FOR_QUIZ_TYPE[quizType] ?? 5;
}

export function sm2(progress, q) {
  if (typeof q !== "number" || !Number.isFinite(q)) q = 5;
  const card = normalizeProgress(progress);

  if (q >= 3) {
    if (card.repetition === 0) card.interval = 1;
    else if (card.repetition === 1) card.interval = 6;
    else card.interval = Math.max(1, Math.round(card.interval * card.EF));
    card.repetition += 1;
    card.successCount += 1;
  } else {
    card.repetition = 0;
    card.interval = 1;
    card.failCount += 1;
  }

  card.EF = card.EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (!Number.isFinite(card.EF)) card.EF = DEFAULT_EF;
  if (card.EF < MIN_EF) card.EF = MIN_EF;
  if (card.interval > MAX_INTERVAL) card.interval = MAX_INTERVAL;
  if (card.interval < 0) card.interval = 0;

  card.lastReview = Date.now();
  card.nextReview = card.lastReview + card.interval * DAY_MS;
  return card;
}

function initMastered(progress) {
  progress.EF = DEFAULT_EF;
  progress.interval = MASTERED_INITIAL_INTERVAL;
  progress.repetition = 0;
  progress.nextReview =
    Date.now() + MASTERED_INITIAL_INTERVAL * DAY_MS;
}

function scheduleStageUp(progress, newStage) {
  if (newStage >= 5) {
    initMastered(progress);
    return;
  }
  const intervalDays = STAGE_UP_INTERVALS[newStage];
  progress.nextReview = Date.now() + intervalDays * DAY_MS;
}

function resetToNew(progress) {
  progress.points = 0;
  progress.pointsAtIntervalStart = 0;
  progress.accumulatedToday = 0;
  progress.wrongToday = 0;
  progress.nextReview = Date.now();
  progress.lastReview = null;
  progress.lastTouchedDate = todayKey();
  progress.successCount = 0;
  progress.failCount = 0;
}

function applyMastered(progress, correct) {
  if (correct) {
    const wasFreshlyPromoted = progress.repetition === 0;
    if (wasFreshlyPromoted) {
      // First correct answer after a word reached stage 5 (mastered).
      // initMastered set interval=60 days. SM-2 with q=5 on repetition=0
      // would set interval=1 day, throwing away the long-mastered reward.
      // Skip SM-2 here — advance repetition 0→1, keep the 60-day interval.
      progress.repetition = 1;
      progress.successCount += 1;
      progress.lastReview = Date.now();
      progress.nextReview = Date.now() + MASTERED_INITIAL_INTERVAL * DAY_MS;
      return "progress";
    }
    const next = sm2(progress, 5);
    progress.EF = next.EF;
    progress.interval = next.interval;
    progress.repetition = next.repetition;
    progress.successCount = next.successCount;
    progress.failCount = next.failCount;
    progress.lastReview = next.lastReview;
    progress.nextReview = next.nextReview;
    return "progress";
  }
  progress.points = 80;
  progress.pointsAtIntervalStart = 80;
  progress.accumulatedToday = 0;
  progress.wrongToday = 0;
  progress.EF = DEFAULT_EF;
  progress.interval = 0;
  progress.repetition = 0;
  progress.successCount += 1;
  progress.failCount += 1;
  progress.lastReview = Date.now();
  progress.nextReview = Date.now() + DAY_MS;
  progress.lastTouchedDate = todayKey();
  return "reset-to-active";
}

function applyActive(progress, quizType, correct) {
  const cost = pointsForQuizType(quizType);
  if (correct) {
    if (progress.accumulatedToday >= DAILY_CAP) {
      progress.lastReview = Date.now();
      progress.lastTouchedDate = todayKey();
      return "no-op-cap-reached";
    }
    const next = Math.min(DAILY_CAP, progress.accumulatedToday + cost);
    progress.accumulatedToday = next;
    progress.successCount += 1;
    progress.lastReview = Date.now();
    progress.lastTouchedDate = todayKey();
    if (progress.accumulatedToday >= DAILY_CAP) {
      progress.points = Math.min(MAX_POINTS, progress.points + STAGE_UP_POINTS);
      progress.wrongToday = 0;
      progress.pointsAtIntervalStart = progress.points;
      const newStage = stageFromPoints(progress.points);
      scheduleStageUp(progress, newStage);
      return progress.points >= MAX_POINTS ? "mastered" : "stage-up";
    }
    return "progress";
  }
  if (progress.accumulatedToday >= DAILY_CAP) {
    progress.lastReview = Date.now();
    progress.lastTouchedDate = todayKey();
    return "no-op-cap-reached";
  }
  progress.wrongToday += 1;
  progress.failCount += 1;
  progress.accumulatedToday = Math.max(0, progress.accumulatedToday - cost);
  progress.lastReview = Date.now();
  progress.lastTouchedDate = todayKey();
  if (progress.wrongToday >= RESET_WRONG_THRESHOLD) {
    resetToNew(progress);
    return "reset-to-new";
  }
  return "progress";
}

export function isNewWord(progress) {
  if (!progress) return true;
  return (
    safeInt(progress.points, 0) === 0 &&
    safeInt(progress.successCount, 0) === 0 &&
    safeInt(progress.failCount, 0) === 0 &&
    progress.lastReview == null
  );
}

export function isStage0(progress) {
  if (!progress) return true;
  return safeInt(progress.points, 0) < STAGE_UP_POINTS;
}

export async function recordQuizResult(wordId, quizType, correct) {
  if (typeof wordId !== "number" || !Number.isFinite(wordId)) {
    throw new Error("recordQuizResult: wordId must be a number");
  }
  if (typeof correct !== "boolean") {
    throw new Error("recordQuizResult: correct must be boolean");
  }
  return db.transaction("rw", db.progress, async () => {
    const existing = await db.progress.get(wordId);
    const raw = existing || createProgress(wordId);
    const progress = normalizeProgress(raw);
    let event;
    if (isMastered(progress)) {
      event = applyMastered(progress, correct);
    } else {
      event = applyActive(progress, quizType, correct);
    }
    await db.progress.put(progress);
    invalidateCache("progress");
    return { progress, event };
  });
}

export async function getDueProgress(limit = 200) {
  const now = Date.now();
  const progresses = await db.progress.toArray();
  const due = progresses.filter(
    (p) =>
      safeInt(p.points, 0) > 0 &&
      safeInt(p.points, 0) < MAX_POINTS &&
      safeInt(p.nextReview, 0) <= now
  );
  due.sort((a, b) => a.nextReview - b.nextReview);
  return due.slice(0, limit);
}

export function getCurrentLevel(activeLevels, masteredByLevel) {
  const ordered = CEFR_LEVELS.filter((l) => activeLevels.includes(l));
  if (ordered.length === 0) return null;
  for (const lvl of ordered) {
    const mastered = masteredByLevel?.[lvl] || 0;
    const total = LEVEL_TOTALS[lvl] || 0;
    if (mastered < total) return lvl;
  }
  return ordered[ordered.length - 1];
}

export async function getDebtByLevel(activeLevels) {
  const now = Date.now();
  const [progresses, words] = await Promise.all([
    db.progress.toArray(),
    db.words.toArray(),
  ]);
  const wordById = new Map(words.map((w) => [w.id, w]));
  const debtByLevel = {};
  for (const lvl of CEFR_LEVELS) debtByLevel[lvl] = 0;
  let total = 0;
  for (const p of progresses) {
    const pts = safeInt(p.points, 0);
    if (pts <= 0 || pts >= MAX_POINTS) continue;
    if (safeInt(p.nextReview, 0) > now) continue;
    const w = wordById.get(p.wordId);
    if (!w || !activeLevels.includes(w.level)) continue;
    debtByLevel[w.level] = (debtByLevel[w.level] || 0) + 1;
    total += 1;
  }
  return { total, byLevel: debtByLevel };
}

export async function getNewWordPool(activeLevels, dailyNorm) {
  const quota = Math.max(0, safeInt(dailyNorm, 0));
  if (quota === 0) return [];
  const orderedActive = CEFR_LEVELS.filter((l) => activeLevels.includes(l));
  if (orderedActive.length === 0) return [];

  const allWords = await db.words.toArray();
  const existing = await db.progress.toArray();
  const existingByWord = new Map(existing.map((p) => [p.wordId, p]));

  const pool = [];
  for (const level of orderedActive) {
    if (pool.length >= quota) break;

    const stage0AtLevel = allWords.filter(
      (word) => word.level === level && isStage0(existingByWord.get(word.id))
    );
    if (stage0AtLevel.length === 0) continue;

    const partial = [];
    const fresh = [];
    for (const word of stage0AtLevel) {
      const p = existingByWord.get(word.id);
      if (p) partial.push(word);
      else fresh.push(word);
    }

    partial.sort((a, b) => {
      const pa = existingByWord.get(a.id);
      const pb = existingByWord.get(b.id);
      const paTouch = pa.lastTouchedDate || "";
      const pbTouch = pb.lastTouchedDate || "";
      if (paTouch !== pbTouch) return paTouch.localeCompare(pbTouch);
      return safeInt(pb.points, 0) - safeInt(pa.points, 0);
    });

    for (let i = fresh.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
    }

    const remaining = quota - pool.length;
    pool.push(...[...partial, ...fresh].slice(0, remaining));
  }

  return pool;
}

export async function getDueSession(activeLevels, sessionSize) {
  const size = Math.max(0, safeInt(sessionSize, 0));
  const due = await getDueProgress(500);
  if (due.length === 0) return [];
  const words = await db.words.toArray();
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const filtered = due
    .filter((p) => {
      const w = wordsById.get(p.wordId);
      return w && activeLevels.includes(w.level);
    })
    .map((p) => ({
      progress: p,
      word: wordsById.get(p.wordId),
    }));
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }
  return filtered.slice(0, size);
}

export { todayKey, startOfDay };
