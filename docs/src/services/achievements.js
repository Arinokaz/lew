import db from "./db.js";
import { getStreak } from "./streak.js";
import { todayKey } from "./date.js";

export const ACHIEVEMENTS = [
  { id: "first_word", title: "Первое слово", icon: "🎯", check: (s) => s.totalActivated >= 1 },
  { id: "streak_3", title: "Серия 3 дня", icon: "🔥", check: (s) => s.streak >= 3 },
  { id: "streak_7", title: "Серия 7 дней", icon: "🔥🔥", check: (s) => s.streak >= 7 },
  { id: "streak_30", title: "Серия 30 дней", icon: "🔥🔥🔥", check: (s) => s.streak >= 30 },
  { id: "streak_100", title: "Серия 100 дней", icon: "🏆", check: (s) => s.streak >= 100 },
  { id: "words_10", title: "10 слов", icon: "📚", check: (s) => s.totalMastered >= 10 },
  { id: "words_50", title: "50 слов", icon: "📖", check: (s) => s.totalMastered >= 50 },
  { id: "words_100", title: "100 слов", icon: "📕", check: (s) => s.totalMastered >= 100 },
  { id: "words_500", title: "500 слов", icon: "🎓", check: (s) => s.totalMastered >= 500 },
  { id: "words_1000", title: "1000 слов", icon: "👑", check: (s) => s.totalMastered >= 1000 },
  { id: "level_a1_done", title: "A1 завершён", icon: "🥉", check: (s) => s.byLevel.A1 >= s.levelTotals.A1 },
  { id: "level_a2_done", title: "A2 завершён", icon: "🥈", check: (s) => s.byLevel.A2 >= s.levelTotals.A2 },
  { id: "level_b1_done", title: "B1 завершён", icon: "🥇", check: (s) => s.byLevel.B1 >= s.levelTotals.B1 },
  { id: "level_b2_done", title: "B2 завершён", icon: "💎", check: (s) => s.byLevel.B2 >= s.levelTotals.B2 },
  { id: "level_c1_done", title: "C1 завершён", icon: "🏅", check: (s) => s.byLevel.C1 >= s.levelTotals.C1 },
  { id: "polyglot_audio", title: "Полиглот", icon: "🎧", check: (s) => s.audioTotal >= 50 },
  { id: "speed_demon", title: "Скоростной", icon: "⚡", check: (s) => s.maxSpeed >= 20 },
  { id: "points_100_day", title: "100 очков за день", icon: "⭐", check: (s) => s.todayPointsEarned >= 100 },
  { id: "points_500_day", title: "500 очков за день", icon: "🌟", check: (s) => s.todayPointsEarned >= 500 },
];

const LEVEL_TOTALS = {
  A1: 1076,
  A2: 992,
  B1: 903,
  B2: 1573,
  C1: 1404,
};

export async function computeStats() {
  const progresses = await db.progress.toArray();
  const words = await db.words.toArray();
  const wordMap = new Map(words.map((w) => [w.id, w]));

  const byLevel = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  const activeByLevel = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  let totalMastered = 0;
  let totalLearned = 0;
  let totalActivated = 0;

  for (const p of progresses) {
    const w = wordMap.get(p.wordId);
    if (!w) continue;
    const pts = p.points || 0;
    if (byLevel[w.level] !== undefined) {
      if (pts >= 100) {
        byLevel[w.level] += 1;
        totalMastered += 1;
      } else if (pts > 0) {
        activeByLevel[w.level] += 1;
      }
    }
    if (pts >= 20) {
      totalActivated += 1;
    }
    if ((p.successCount || 0) >= 1 || (p.failCount || 0) >= 1) {
      totalLearned += 1;
    }
  }

  const allStats = await db.stats.toArray();
  let totalXP = 0;
  let totalMinutes = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalReviews = 0;
  let maxSpeed = 0;
  let audioTotal = 0;
  for (const s of allStats) {
    totalXP += s.xp || 0;
    totalMinutes += s.minutes || 0;
    totalCorrect += s.correct || 0;
    totalWrong += s.wrong || 0;
    totalReviews += s.reviewed || 0;
    if (s.maxSpeed && s.maxSpeed > maxSpeed) maxSpeed = s.maxSpeed;
    if (s.audioTotal) audioTotal += s.audioTotal;
  }

  const today = todayKey();
  const todayStats = allStats.find((s) => s.date === today);
  const todayPointsEarned = todayStats?.pointsEarned || 0;

  return {
    totalMastered,
    totalLearned,
    totalActivated,
    totalReviews,
    totalXP,
    totalMinutes,
    totalCorrect,
    totalWrong,
    byLevel,
    activeByLevel,
    levelTotals: LEVEL_TOTALS,
    maxSpeed,
    audioTotal,
    todayPointsEarned,
  };
}

export async function checkAndUnlockAchievements() {
  const stats = await computeStats();
  const streak = await getStreak();
  return db.transaction("rw", db.achievements, async () => {
    const existing = await db.achievements.toArray();
    const existingMap = new Map(existing.map((a) => [a.id, a]));
    const newlyUnlocked = [];

    for (const ach of ACHIEVEMENTS) {
      if (existingMap.has(ach.id)) continue;
      const result = ach.check({ ...stats, streak });
      if (result) {
        const rec = {
          id: ach.id,
          unlockedAt: Date.now(),
          notified: false,
        };
        await db.achievements.put(rec);
        newlyUnlocked.push({ ...ach, ...rec });
      }
    }
    return newlyUnlocked;
  });
}

export async function markNotified(achievementId) {
  return db.transaction("rw", db.achievements, async () => {
    const existing = await db.achievements.get(achievementId);
    if (!existing) return;
    existing.notified = true;
    await db.achievements.put(existing);
  });
}

export async function getAllAchievements() {
  const existing = await db.achievements.toArray();
  const existingMap = new Map(existing.map((a) => [a.id, a]));
  return ACHIEVEMENTS.map((ach) => ({
    ...ach,
    unlocked: existingMap.has(ach.id),
    unlockedAt: existingMap.get(ach.id)?.unlockedAt || null,
  }));
}
