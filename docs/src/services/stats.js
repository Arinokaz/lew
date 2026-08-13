import db from "./db.js";
import { todayKey } from "./date.js";

function freshStats(date) {
  return {
    date,
    reviewed: 0,
    learned: 0,
    correct: 0,
    wrong: 0,
    minutes: 0,
    xp: 0,
    pointsEarned: 0,
    stageUps: 0,
    audioTotal: 0,
    maxSpeed: 0,
  };
}

export async function ensureTodayStats() {
  const today = todayKey();
  return db.transaction("rw", db.stats, async () => {
    const existing = await db.stats.get(today);
    if (existing) return existing;
    const fresh = freshStats(today);
    await db.stats.put(fresh);
    return fresh;
  });
}

export async function recordReview({
  correct,
  isNew = false,
  minutes = 0,
  xp = 0,
  pointsEarned = 0,
  stageUp = false,
  audio = false,
  speed = 0,
  neutral = false,
} = {}) {
  const today = todayKey();
  return db.transaction("rw", db.stats, async () => {
    const existing = (await db.stats.get(today)) || freshStats(today);
    existing.reviewed += 1;
    if (!neutral) {
      if (correct) existing.correct += 1;
      else existing.wrong += 1;
      if (isNew && correct) existing.learned += 1;
    }
    existing.minutes += minutes;
    existing.xp += xp;
    if (pointsEarned) existing.pointsEarned += pointsEarned;
    if (stageUp) existing.stageUps += 1;
    if (audio && correct) existing.audioTotal = (existing.audioTotal || 0) + 1;
    if (speed > 0) {
      const prev = existing.maxSpeed || 0;
      if (speed > prev) existing.maxSpeed = speed;
    }
    await db.stats.put(existing);
    return existing;
  });
}

export async function addSessionBonus(xp = 25, minutes = 0) {
  const today = todayKey();
  return db.transaction("rw", db.stats, async () => {
    const existing = (await db.stats.get(today)) || freshStats(today);
    existing.xp += xp;
    existing.minutes += minutes;
    await db.stats.put(existing);
    return existing;
  });
}

export async function getStatsByDateRange(fromDate, toDate) {
  const all = await db.stats.toArray();
  return all
    .filter((s) => s.date >= fromDate && s.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLast7DaysStats() {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(todayKey(d));
  }
  const all = await db.stats.toArray();
  return dates.map((date) => all.find((s) => s.date === date) || null);
}
