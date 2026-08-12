import * as storage from "./storage.js";
import db from "./db.js";
import { todayKey } from "./date.js";

const STREAK_KEY = "streakLastDay";
const VISIT_KEY = "lastVisit";

export { todayKey };

function daysBetween(aKey, bKey) {
  const a = new Date(aKey + "T00:00:00");
  const b = new Date(bKey + "T00:00:00");
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function getStreakLastDay() {
  return storage.getString(STREAK_KEY, null);
}

export function setStreakLastDay(key) {
  storage.set(STREAK_KEY, key);
}

export function getCachedStreak() {
  return Number(storage.get("streakCount", 0)) || 0;
}

function setCachedStreak(n) {
  storage.set("streakCount", n);
}

export async function refreshStreakOnVisit() {
  const today = todayKey();
  const lastVisit = storage.getString(VISIT_KEY, null);
  const lastStreakDay = getStreakLastDay();

  let streak = getCachedStreak();

  if (lastStreakDay && lastStreakDay !== today) {
    const gap = daysBetween(lastStreakDay, today);
    if (gap === 1) {
      const hadActivity = await hadActivityOn(lastStreakDay);
      if (hadActivity) {
        streak += 1;
      } else {
        streak = 1;
      }
    } else if (gap > 1) {
      streak = 1;
    }
  } else if (!lastStreakDay) {
    streak = 1;
  }

  setStreakLastDay(today);
  setCachedStreak(streak);
  storage.set(VISIT_KEY, today);
  return streak;
}

export async function getStreak() {
  const cached = getCachedStreak();
  const lastStreakDay = getStreakLastDay();
  if (!lastStreakDay) return 0;
  const today = todayKey();
  if (lastStreakDay === today) return cached || 0;

  const gap = daysBetween(lastStreakDay, today);
  if (gap === 1) {
    const hadActivity = await hadActivityOn(lastStreakDay);
    if (hadActivity) return cached || 0;
    return 0;
  }
  if (gap > 1) return 0;
  return cached || 0;
}

async function hadActivityOn(dateKey) {
  const row = await db.stats.get(dateKey);
  return Boolean(row && (row.reviewed > 0 || row.learned > 0));
}

export async function getRecentAchievements(limit = 3) {
  const list = await db.achievements.orderBy("unlockedAt").reverse().limit(limit).toArray();
  const { ACHIEVEMENTS } = await import("./achievements.js");
  return list.map((a) => {
    const meta = ACHIEVEMENTS.find((x) => x.id === a.id);
    return { ...meta, ...a };
  });
}

export async function getStreakStats() {
  const all = await db.stats.toArray();
  const dates = new Set(all.filter((s) => s.reviewed > 0 || s.learned > 0).map((s) => s.date));
  return {
    activeDays: dates.size,
    longestStreak: computeLongestStreak([...dates]),
    currentStreak: await getStreak(),
  };
}

function computeLongestStreak(dates) {
  if (!dates.length) return 0;
  dates.sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00");
    const cur = new Date(dates[i] + "T00:00:00");
    const diff = Math.round((cur - prev) / (24 * 60 * 60 * 1000));
    if (diff === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}