import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import "fake-indexeddb/auto";

let dom;

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
  try {
    const { invalidateCache } = await import("../docs/src/services/db.js");
    invalidateCache();
  } catch (e) {}
}

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
});

describe("db + SRS integration", () => {
  beforeEach(async () => {
    await resetDb();
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  test("import words, then answer word updates progress", async () => {
    const dbMod = await import("../docs/src/services/db.js");
    const db = dbMod.default;
    const { importFromArray } = await import("../docs/src/services/import.js");
    const { recordQuizResult, createProgress } = await import("../docs/src/services/srs.js");

    await db.words.clear();
    await db.progress.clear();

    const raw = [
      {
        id: 1,
        value: {
          word: "test",
          translations: { ru: "тест", ua: "тест" },
          type: "noun",
          level: "A1",
          us: {},
          uk: {},
          phonetics: {},
          examples: [],
        },
      },
      {
        id: 2,
        value: {
          word: "run",
          translations: { ru: "бежать", ua: "бігти" },
          type: "verb",
          level: "A2",
          us: {},
          uk: {},
          phonetics: {},
          examples: [],
        },
      },
    ];

    const { imported, skipped } = await importFromArray(raw);
    assert.equal(imported, 2);
    assert.equal(skipped, 0);
    const stored = await db.words.toArray();
    assert.equal(stored.length, 2);
    assert.equal(stored[0].word, "test");

    const prog1 = createProgress(1);
    assert.equal(prog1.repetition, 0);
    assert.equal(prog1.EF, 2.5);
    assert.equal(prog1.points, 0);

    const updated = await recordQuizResult(1, "type-in", true);
    assert.equal(updated.progress.wordId, 1);
    assert.equal(updated.progress.points, 20);
    assert.equal(updated.progress.successCount, 1);
    assert.equal(updated.event, "stage-up");

    const futureCheck = await db.progress.where("nextReview").above(Date.now() - 1000).count();
    assert.ok(futureCheck >= 1);
  });

  test("recordQuizResult second hard quiz same day returns no-op-cap-reached", async () => {
    const db = (await import("../docs/src/services/db.js")).default;
    const { recordQuizResult } = await import("../docs/src/services/srs.js");

    await db.progress.clear();
    const first = await recordQuizResult(1, "type-in", true);
    assert.equal(first.progress.points, 20);
    assert.equal(first.event, "stage-up");

    const second = await recordQuizResult(1, "type-in", true);
    assert.equal(second.progress.points, 20);
    assert.equal(second.event, "no-op-cap-reached");
  });

  test("wrong answer does not drop below pointsAtIntervalStart", async () => {
    const db = (await import("../docs/src/services/db.js")).default;
    const { recordQuizResult } = await import("../docs/src/services/srs.js");

    await db.progress.clear();
    await recordQuizResult(1, "type-in", true);

    const failed = await recordQuizResult(1, "type-in", false);
    assert.equal(failed.progress.points, 20);
    assert.equal(failed.event, "no-op-cap-reached");
    assert.equal(failed.progress.failCount, 0, "after cap: extra quizzes do not touch counters");
    assert.equal(failed.progress.wrongToday, 0);
  });

  test("getDueProgress returns due entries", async () => {
    const db = (await import("../docs/src/services/db.js")).default;
    const { importFromArray } = await import("../docs/src/services/import.js");
    const { recordQuizResult, getDueProgress } = await import("../docs/src/services/srs.js");

    await db.words.clear();
    await db.progress.clear();

    await importFromArray([
      {
        id: 1,
        value: {
          word: "x",
          translations: { ru: "у", ua: "у" },
          type: "noun",
          level: "A1",
          examples: [],
        },
      },
    ]);
    await recordQuizResult(1, "type-in", true);
    const stored = await db.progress.get(1);
    await db.progress.put({ ...stored, nextReview: Date.now() - 1000 });
    const due = await getDueProgress(50);
    const found = due.find((p) => p.wordId === 1);
    assert.ok(found);
    assert.equal(found.points, 20);
  });

  test("stats table records review correctly", async () => {
    const db = (await import("../docs/src/services/db.js")).default;
    const { recordReview, ensureTodayStats } = await import("../docs/src/services/stats.js");

    await db.stats.clear();
    await ensureTodayStats();
    const s1 = await recordReview({ correct: true, isNew: false, minutes: 0, xp: 5 });
    assert.equal(s1.reviewed, 1);
    assert.equal(s1.correct, 1);
    assert.equal(s1.xp, 5);

    const s2 = await recordReview({ correct: false, isNew: true, minutes: 0, xp: 1 });
    assert.equal(s2.reviewed, 2);
    assert.equal(s2.correct, 1);
    assert.equal(s2.wrong, 1);
    assert.equal(s2.learned, 0);
  });

  test("stats recordReview tracks audioTotal and maxSpeed", async () => {
    const db = (await import("../docs/src/services/db.js")).default;
    const { recordReview, ensureTodayStats } = await import("../docs/src/services/stats.js");

    await db.stats.clear();
    await ensureTodayStats();
    const s1 = await recordReview({ correct: true, audio: true, speed: 10 });
    assert.equal(s1.audioTotal, 1);
    assert.equal(s1.maxSpeed, 10);

    const s2 = await recordReview({ correct: false, audio: true, speed: 5 });
    assert.equal(s2.audioTotal, 1, "wrong audio answer should not count");
    assert.equal(s2.maxSpeed, 10, "lower speed should not replace max");

    const s3 = await recordReview({ correct: true, audio: true, speed: 25 });
    assert.equal(s3.audioTotal, 2);
    assert.equal(s3.maxSpeed, 25);
  });

  test("resetAll wipes IDB, cache, and lew.* LocalStorage", async () => {
    const db = (await import("../docs/src/services/db.js")).default;
    await db.words.bulkPut([{ id: 1, word: "x", level: "A1", type: "noun", translations: { ru: "", ua: "" }, audio: {}, phonetics: {}, examples: [] }]);
    await db.progress.bulkPut([{ wordId: 1, points: 50, successCount: 1, failCount: 0 }]);
    await db.stats.put({ date: "2026-08-11", reviewed: 1, learned: 1, correct: 1, wrong: 0, minutes: 0, xp: 5, pointsEarned: 5, stageUps: 0, audioTotal: 0, maxSpeed: 0 });

    localStorage.setItem("lew.streakLastDay", "2026-08-10");
    localStorage.setItem("lew.streakCount", "5");
    localStorage.setItem("lew.lastVisit", "2026-08-10");
    localStorage.setItem("lew.dailyPool.2026-08-10", "{}");
    localStorage.setItem("not-lew.foo", "bar");

    const { getAllProgress, getAllWords } = await import("../docs/src/services/db.js");
    await getAllProgress();
    await getAllWords();

    const { resetAll } = await import("../docs/src/services/backup.js");
    await resetAll();

    assert.equal(await db.words.count(), 0, "words cleared");
    assert.equal(await db.progress.count(), 0, "progress cleared");
    assert.equal(await db.stats.count(), 0, "stats cleared");

    const cachedProgress = await getAllProgress();
    assert.equal(cachedProgress.length, 0, "progress cache invalidated");
    const cachedWords = await getAllWords();
    assert.equal(cachedWords.length, 0, "words cache invalidated");

    assert.equal(localStorage.getItem("lew.streakLastDay"), null, "streak cleared");
    assert.equal(localStorage.getItem("lew.streakCount"), null, "streakCount cleared");
    assert.equal(localStorage.getItem("lew.lastVisit"), null, "lastVisit cleared");
    assert.equal(localStorage.getItem("lew.dailyPool.2026-08-10"), null, "dailyPool cleared");
    assert.equal(localStorage.getItem("not-lew.foo"), "bar", "non-lew keys untouched");
  });

  test("importFromArray invalidates words cache", async () => {
    const db = (await import("../docs/src/services/db.js")).default;
    await db.words.bulkPut([{ id: 99, word: "stale", level: "A1", type: "noun", translations: { ru: "", ua: "" }, audio: {}, phonetics: {}, examples: [] }]);
    const { getAllWords } = await import("../docs/src/services/db.js");
    const stale = await getAllWords();
    assert.equal(stale.length, 1);
    assert.equal(stale[0].word, "stale");

    const { importFromArray } = await import("../docs/src/services/import.js");
    await importFromArray([
      { id: 99, value: { word: "fresh", translations: { ru: "", ua: "" }, level: "A1", type: "noun" } },
    ]);

    const fresh = await getAllWords();
    assert.equal(fresh.length, 1, "cache should reflect new import");
    assert.equal(fresh[0].word, "fresh", "stale entry replaced by fresh");
  });

  test("computeStats totalReviews comes from db.stats.reviewed, not progress counters", async () => {
    const db = (await import("../docs/src/services/db.js")).default;
    await db.stats.clear();
    await db.words.clear();
    await db.progress.clear();

    await db.words.bulkPut([
      { id: 1, word: "a", level: "A1", type: "noun", translations: { ru: "", ua: "" }, audio: {}, phonetics: {}, examples: [] },
    ]);
    await db.stats.bulkPut([
      { date: "2026-08-10", reviewed: 3, learned: 0, correct: 0, wrong: 3, minutes: 0, xp: 0, pointsEarned: 0, stageUps: 0, audioTotal: 0, maxSpeed: 0 },
      { date: "2026-08-11", reviewed: 5, learned: 1, correct: 5, wrong: 0, minutes: 0, xp: 25, pointsEarned: 20, stageUps: 1, audioTotal: 0, maxSpeed: 0 },
    ]);

    const { computeStats } = await import("../docs/src/services/achievements.js");
    const stats = await computeStats();

    assert.equal(stats.totalReviews, 8, "totalReviews = sum of stats.reviewed (3+5)");
    assert.equal(stats.totalCorrect, 5);
    assert.equal(stats.totalWrong, 3);
  });
});