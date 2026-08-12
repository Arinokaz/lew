import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import "fake-indexeddb/auto";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

async function resetDb() {
  if (!indexedDB.databases) return;
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs.map(
      (db) =>
        new Promise((resolve) => {
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = req.onerror = req.onblocked = () => resolve();
        })
    )
  );
}

describe("streak in LocalStorage (SPEC §11)", () => {
  beforeEach(async () => {
    await resetDb();
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  test("getStreakLastDay reads from LS", async () => {
    const { setStreakLastDay, getStreakLastDay } = await import("../docs/src/services/streak.js");
    setStreakLastDay("2026-01-15");
    assert.equal(getStreakLastDay(), "2026-01-15");
  });

  test("initial streak is 0 when no LS key", async () => {
    const { getStreak } = await import("../docs/src/services/streak.js");
    const streak = await getStreak();
    assert.equal(streak, 0);
  });

  test("refreshStreakOnVisit sets LS key", async () => {
    const { refreshStreakOnVisit, getStreakLastDay } = await import("../docs/src/services/streak.js");
    await refreshStreakOnVisit();
    const key = getStreakLastDay();
    assert.ok(key, "LS key should be set after visit");
    assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("achievements completeness (SPEC §11)", () => {
  test("has 19 achievements including polyglot_audio and speed_demon", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    assert.equal(ACHIEVEMENTS.length, 19);
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.ok(ids.includes("polyglot_audio"));
    assert.ok(ids.includes("speed_demon"));
    assert.ok(ids.includes("points_100_day"));
    assert.ok(ids.includes("points_500_day"));
  });

  test("polyglot_audio triggers at 50 audioTotal", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const a = ACHIEVEMENTS.find((x) => x.id === "polyglot_audio");
    assert.equal(a.check({ audioTotal: 0 }), false);
    assert.equal(a.check({ audioTotal: 49 }), false);
    assert.equal(a.check({ audioTotal: 50 }), true);
  });

  test("points_100_day triggers at 100 todayPointsEarned", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const a = ACHIEVEMENTS.find((x) => x.id === "points_100_day");
    assert.equal(a.check({ todayPointsEarned: 99 }), false);
    assert.equal(a.check({ todayPointsEarned: 100 }), true);
  });

  test("speed_demon triggers at 20 maxSpeed", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const a = ACHIEVEMENTS.find((x) => x.id === "speed_demon");
    assert.equal(a.check({ maxSpeed: 19 }), false);
    assert.equal(a.check({ maxSpeed: 20 }), true);
  });

  test("first_word triggers on totalActivated (points >= 20)", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const a = ACHIEVEMENTS.find((x) => x.id === "first_word");
    assert.equal(a.check({ totalActivated: 0, totalLearned: 5 }), false);
    assert.equal(a.check({ totalActivated: 1 }), true);
  });
});

describe("stats.addSessionBonus (SPEC §11)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("adds 25 XP bonus after session", async () => {
    const db = (await import("../docs/src/services/db.js")).default;
    const { ensureTodayStats, addSessionBonus } = await import("../docs/src/services/stats.js");
    await ensureTodayStats();
    const before = await db.stats.toArray();
    const beforeXp = before[0]?.xp || 0;
    await addSessionBonus(25, 5);
    const after = await db.stats.toArray();
    assert.equal(after[0].xp, beforeXp + 25);
    assert.equal(after[0].minutes, 5);
  });
});