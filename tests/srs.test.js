import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

import {
  sm2,
  createProgress,
  stageFromPoints,
  isMastered,
  pointsForQuizType,
  recordQuizResult,
  MAX_POINTS,
  DAILY_CAP,
  RESET_WRONG_THRESHOLD,
  MIN_EF,
  MAX_INTERVAL,
  DAY_MS,
} from "../public/src/services/srs.js";
import db from "../public/src/services/db.js";

const fresh = () => createProgress(1);

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

describe("stageFromPoints", () => {
  test("stage 0 for 0 pts", () => assert.equal(stageFromPoints(0), 0));
  test("stage 1 for 20 pts", () => assert.equal(stageFromPoints(20), 1));
  test("stage 2 for 40 pts", () => assert.equal(stageFromPoints(40), 2));
  test("stage 3 for 60 pts", () => assert.equal(stageFromPoints(60), 3));
  test("stage 4 for 80 pts", () => assert.equal(stageFromPoints(80), 4));
  test("stage 5 for 100+ pts", () => assert.equal(stageFromPoints(100), 5));
  test("stage 5 caps at 5", () => assert.equal(stageFromPoints(999), 5));
  test("stage derived from any points value", () => {
    assert.equal(stageFromPoints(5), 0);
    assert.equal(stageFromPoints(19), 0);
    assert.equal(stageFromPoints(39), 1);
    assert.equal(stageFromPoints(99), 4);
  });
});

describe("isMastered", () => {
  test("false when no progress", () => assert.equal(isMastered(null), false));
  test("false below 100 pts", () => assert.equal(isMastered({ points: 80 }), false));
  test("true at 100 pts", () => assert.equal(isMastered({ points: 100 }), true));
  test("true above 100 pts", () => assert.equal(isMastered({ points: 120 }), true));
});

describe("pointsForQuizType", () => {
  test("easy quizzes: 5 pts", () => {
    assert.equal(pointsForQuizType("en-to-l1"), 5);
    assert.equal(pointsForQuizType("l1-to-en"), 5);
    assert.equal(pointsForQuizType("audio-to-en"), 5);
  });
  test("medium quizzes: 10 pts", () => {
    assert.equal(pointsForQuizType("tile-l1-en"), 10);
    assert.equal(pointsForQuizType("tile-audio-en"), 10);
  });
  test("hard quizzes: 20 pts", () => {
    assert.equal(pointsForQuizType("type-in"), 20);
    assert.equal(pointsForQuizType("cloze"), 20);
    assert.equal(pointsForQuizType("audio-type-in"), 20);
  });
  test("cloze-choice: 5 pts (easy)", () => {
    assert.equal(pointsForQuizType("cloze-choice"), 5);
  });
});

describe("createProgress defaults", () => {
  test("wordId set", () => {
    const p = createProgress(42);
    assert.equal(p.wordId, 42);
  });
  test("points starts at 0", () => {
    const p = createProgress(42);
    assert.equal(p.points, 0);
  });
  test("accumulatedToday starts at 0", () => {
    const p = createProgress(42);
    assert.equal(p.accumulatedToday, 0);
  });
  test("wrongToday starts at 0", () => {
    const p = createProgress(42);
    assert.equal(p.wrongToday, 0);
  });
  test("lastTouchedDate is null", () => {
    const p = createProgress(42);
    assert.equal(p.lastTouchedDate, null);
  });
  test("EF is 2.5", () => assert.equal(createProgress(1).EF, 2.5));
});

describe("sm2 (mastered phase reference)", () => {
  test("first correct answer", () => {
    const card = sm2(fresh(), 5);
    assert.equal(card.repetition, 1);
    assert.equal(card.interval, 1);
    assert.equal(card.EF, 2.6);
    assert.equal(card.successCount, 1);
  });
  test("EF never below 1.3", () => {
    let c = { EF: MIN_EF, interval: 1, repetition: 1, successCount: 0, failCount: 0 };
    for (let i = 0; i < 50; i++) c = sm2(c, 0);
    assert.ok(c.EF >= MIN_EF - 1e-9);
  });
  test("interval never exceeds 365", () => {
    let c = { EF: 2.5, interval: 200, repetition: 5, successCount: 5, failCount: 0 };
    c = sm2(c, 5);
    assert.ok(c.interval <= MAX_INTERVAL);
  });
  test("nextReview always > lastReview", () => {
    for (const q of [0, 1, 2, 3, 4, 5]) {
      const c = sm2(fresh(), q);
      assert.ok(c.nextReview >= c.lastReview);
    }
  });
  test("original card not mutated", () => {
    const original = fresh();
    const snapshot = JSON.stringify(original);
    sm2(original, 5);
    assert.equal(JSON.stringify(original), snapshot);
  });
});

describe("recordQuizResult — new word lifecycle", () => {
  beforeEach(async () => {
    await resetDb();
    await db.open();
  });

  test("4 easy quizzes accumulate 20 pts and stage-up to 1", async () => {
    let lastResult;
    for (let i = 0; i < 4; i++) {
      lastResult = await recordQuizResult(1, "en-to-l1", true);
    }
    const p = lastResult.progress;
    assert.equal(p.points, 20);
    assert.equal(p.accumulatedToday, 20, "cap stays at 20 to prevent same-day double stage-up");
    assert.equal(p.pointsAtIntervalStart, 20);
    assert.equal(p.lastTouchedDate, new Date().toISOString().slice(0, 10));
    assert.equal(lastResult.event, "stage-up");
  });

  test("1 hard quiz closes daily cap in one shot", async () => {
    const result = await recordQuizResult(2, "type-in", true);
    assert.equal(result.progress.points, 20);
    assert.equal(result.event, "stage-up");
  });

  test("1 hard wrong quiz does not push below starting 0", async () => {
    const result = await recordQuizResult(3, "type-in", false);
    assert.equal(result.progress.points, 0);
    assert.equal(result.progress.wrongToday, 1);
    assert.equal(result.event, "progress");
  });

  test("wrong on new word never drops below 0", async () => {
    let r;
    r = await recordQuizResult(4, "en-to-l1", false);
    assert.equal(r.progress.points, 0);
    assert.equal(r.progress.wrongToday, 1);
  });

  test("3 wrong resets new word to 0 (no change visible but wrongToday=0)", async () => {
    await recordQuizResult(5, "en-to-l1", false);
    await recordQuizResult(5, "en-to-l1", false);
    const r = await recordQuizResult(5, "en-to-l1", false);
    assert.equal(r.progress.points, 0);
    assert.equal(r.progress.wrongToday, 0);
    assert.equal(r.event, "reset-to-new");
  });

  test("word persists in IDB after answer", async () => {
    await recordQuizResult(6, "en-to-l1", true);
    const stored = await db.progress.get(6);
    assert.ok(stored);
    assert.equal(stored.wordId, 6);
    assert.equal(stored.accumulatedToday, 5);
  });
});

describe("recordQuizResult — active phase (stages 1-4)", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  async function makeActive(wordId, points) {
    const today = new Date().toISOString().slice(0, 10);
    await db.progress.put({
      wordId,
      EF: 2.5,
      interval: 6,
      repetition: 1,
      nextReview: Date.now(),
      lastReview: Date.now(),
      successCount: 2,
      failCount: 0,
      points,
      pointsAtIntervalStart: points,
      accumulatedToday: 0,
      wrongToday: 0,
      lastTouchedDate: today,
    });
  }

  test("wrong answer does not drop below pointsAtIntervalStart", async () => {
    await makeActive(10, 40);
    const r = await recordQuizResult(10, "type-in", false);
    assert.equal(r.progress.points, 40);
    assert.equal(r.progress.accumulatedToday, 0);
    assert.equal(r.progress.wrongToday, 1);
  });

  test("wrong with accumulated progress decreases accumulatedToday only", async () => {
    await makeActive(11, 40);
    await recordQuizResult(11, "en-to-l1", true);
    await recordQuizResult(11, "en-to-l1", true);
    let r = await db.progress.get(11);
    assert.equal(r.accumulatedToday, 10);
    r = await recordQuizResult(11, "en-to-l1", false);
    assert.equal(r.progress.points, 40);
    assert.equal(r.progress.accumulatedToday, 5);
  });

  test("hard correct closes cap and stage-ups", async () => {
    await makeActive(12, 40);
    const r = await recordQuizResult(12, "type-in", true);
    assert.equal(r.progress.points, 60);
    assert.equal(r.progress.accumulatedToday, 20);
    assert.equal(r.event, "stage-up");
  });

  test("4 easy correct closes cap and stage-ups", async () => {
    await makeActive(13, 40);
    let r;
    for (let i = 0; i < 4; i++) {
      r = await recordQuizResult(13, "en-to-l1", true);
    }
    assert.equal(r.progress.points, 60);
    assert.equal(r.event, "stage-up");
  });

  test("3 wrong on active word resets to 0 (stage 0)", async () => {
    await makeActive(14, 60);
    await recordQuizResult(14, "en-to-l1", false);
    await recordQuizResult(14, "en-to-l1", false);
    const r = await recordQuizResult(14, "en-to-l1", false);
    assert.equal(r.progress.points, 0);
    assert.equal(r.progress.wrongToday, 0);
    assert.equal(r.event, "reset-to-new");
  });

  test("stage-up advances interval based on new stage", async () => {
    await makeActive(15, 20);
    const r = await recordQuizResult(15, "type-in", true);
    assert.equal(r.progress.points, 40);
    const intervalDays = (r.progress.nextReview - r.progress.lastReview) / DAY_MS;
    assert.equal(intervalDays, 6);
  });

  test("stage-up to 80 schedules +45 days", async () => {
    await makeActive(16, 60);
    const r = await recordQuizResult(16, "type-in", true);
    assert.equal(r.progress.points, 80);
    const intervalDays = (r.progress.nextReview - r.progress.lastReview) / DAY_MS;
    assert.equal(intervalDays, 45);
  });

  test("stage-up to 100 initializes SM-2 fields", async () => {
    await makeActive(17, 80);
    const r = await recordQuizResult(17, "type-in", true);
    assert.equal(r.progress.points, 100);
    assert.equal(r.event, "mastered");
    assert.equal(r.progress.EF, 2.5);
    assert.equal(r.progress.interval, 60);
    assert.equal(r.progress.repetition, 0);
  });
});

describe("recordQuizResult — mastered phase (stage 5)", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  async function makeMastered(wordId) {
    await db.progress.put({
      wordId,
      EF: 2.5,
      interval: 60,
      repetition: 0,
      nextReview: Date.now() + 60 * DAY_MS,
      lastReview: Date.now(),
      successCount: 5,
      failCount: 0,
      points: 100,
      pointsAtIntervalStart: 100,
      accumulatedToday: 0,
      wrongToday: 0,
      lastTouchedDate: new Date().toISOString().slice(0, 10),
    });
  }

  test("first mastered correct keeps initial interval of 60", async () => {
    await makeMastered(20);
    const r = await recordQuizResult(20, "en-to-l1", true);
    assert.equal(r.event, "progress");
    assert.equal(r.progress.interval, 60);
    assert.equal(r.progress.repetition, 1);
  });

  test("subsequent corrects follow SM-2 progression", async () => {
    await makeMastered(20);
    await recordQuizResult(20, "en-to-l1", true);
    await recordQuizResult(20, "en-to-l1", true);
    const r = await recordQuizResult(20, "en-to-l1", true);
    assert.ok(r.progress.interval >= 6);
  });

  test("wrong drops to stage 4 (80 pts) and back to active", async () => {
    await makeMastered(21);
    const r = await recordQuizResult(21, "en-to-l1", false);
    assert.equal(r.progress.points, 80);
    assert.equal(r.event, "reset-to-active");
    assert.equal(r.progress.interval, 0);
    assert.equal(r.progress.repetition, 0);
    assert.equal(r.progress.EF, 2.5);
  });

  test("mastered nextReview scheduling respects cap 365", async () => {
    await makeMastered(22);
    let r;
    for (let i = 0; i < 10; i++) {
      r = await recordQuizResult(22, "en-to-l1", true);
    }
    assert.ok(r.progress.interval <= MAX_INTERVAL);
  });
});

describe("stage progression lifecycle (integration)", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test("new word climbs 0 → 20 on first hard quiz (further climbs require new day)", async () => {
    let r;
    r = await recordQuizResult(30, "type-in", true);
    assert.equal(r.progress.points, 20);
    assert.equal(r.event, "stage-up");
    r = await recordQuizResult(30, "type-in", true);
    assert.equal(r.event, "no-op-cap-reached");
    assert.equal(r.progress.points, 20);
    r = await recordQuizResult(30, "type-in", false);
    assert.equal(r.event, "no-op-cap-reached");
    assert.equal(r.progress.points, 20, "wrong after cap is no-op, points stay at 20");
  });

  test("resetToNew clears counters", async () => {
    await recordQuizResult(31, "type-in", false);
    await recordQuizResult(31, "type-in", false);
    const r2 = await recordQuizResult(31, "type-in", false);
    assert.equal(r2.progress.points, 0);
    assert.equal(r2.event, "reset-to-new");
    assert.equal(r2.progress.successCount, 0);
    assert.equal(r2.progress.failCount, 0);
    assert.equal(r2.progress.lastReview, null);
  });

  test("wrong answers do not bring word below pointsAtIntervalStart", async () => {
    let r;
    r = await recordQuizResult(31, "type-in", true);
    assert.equal(r.progress.points, 20);
    r = await recordQuizResult(31, "type-in", false);
    assert.equal(r.progress.points, 20);
    r = await recordQuizResult(31, "type-in", false);
    assert.equal(r.progress.points, 20);
  });
});

describe("recordQuizResult — cap-reached and stage-up edge cases", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test("cap reached: wrongToday counter resets on stage-up", async () => {
    await recordQuizResult(40, "en-to-l1", false);
    await recordQuizResult(40, "en-to-l1", false);
    let r = await db.progress.get(40);
    assert.equal(r.wrongToday, 2);
    r = await recordQuizResult(40, "type-in", true);
    assert.equal(r.progress.points, 20);
    assert.equal(r.progress.wrongToday, 0, "stage-up must reset wrongToday so fresh counter applies to new interval");
    r = await recordQuizResult(40, "en-to-l1", false);
    assert.equal(r.progress.wrongToday, 0, "after cap, wrongToday does not increment (extra practice is no-op)");
  });

  test("no double stage-up in one day (cap respected even after big quiz)", async () => {
    let r = await recordQuizResult(41, "type-in", true);
    assert.equal(r.progress.points, 20);
    assert.equal(r.event, "stage-up");
    r = await recordQuizResult(41, "type-in", true);
    assert.equal(r.event, "no-op-cap-reached");
    assert.equal(r.progress.points, 20, "must not advance past 20 until tomorrow");
  });

  test("already-cap-reached word: extra quizzes are pure no-op (no failCount, no wrongToday)", async () => {
    let r = await recordQuizResult(42, "type-in", true);
    assert.equal(r.progress.points, 20);
    assert.equal(r.event, "stage-up");
    r = await recordQuizResult(42, "en-to-l1", false);
    assert.equal(r.progress.points, 20);
    assert.equal(r.progress.wrongToday, 0, "wrongToday must not increment after cap");
    assert.equal(r.progress.failCount, 0, "failCount must not increment after cap");
    assert.equal(r.event, "no-op-cap-reached");
    r = await recordQuizResult(42, "en-to-l1", true);
    assert.equal(r.event, "no-op-cap-reached");
    assert.equal(r.progress.successCount, 1, "successCount from cap-reaching answer preserved");
    assert.equal(r.progress.wrongToday, 0);
  });

  test("cap-reached word: many wrong answers do NOT trigger reset-to-new", async () => {
    let r = await recordQuizResult(50, "type-in", true);
    assert.equal(r.progress.points, 20);
    for (let i = 0; i < 5; i++) {
      r = await recordQuizResult(50, "en-to-l1", false);
    }
    const stored = await db.progress.get(50);
    assert.equal(stored.points, 20, "points must remain at 20");
    assert.notEqual(stored.points, 0, "word must NOT reset to new");
  });

  test("resetToNew zeros successCount/failCount/lastReview so word reappears in /learn", async () => {
    await db.progress.put({
      wordId: 43,
      EF: 2.5,
      interval: 6,
      repetition: 1,
      nextReview: Date.now() - DAY_MS,
      lastReview: Date.now(),
      successCount: 3,
      failCount: 2,
      points: 60,
      pointsAtIntervalStart: 60,
      accumulatedToday: 5,
      wrongToday: 2,
      lastTouchedDate: new Date().toISOString().slice(0, 10),
    });
    await recordQuizResult(43, "en-to-l1", false);
    const r = await db.progress.get(43);
    assert.equal(r.points, 0);
    assert.equal(r.successCount, 0);
    assert.equal(r.failCount, 0);
    assert.equal(r.lastReview, null);
  });

  test("isNewWord predicate matches reset-to-new state", async () => {
    const { isNewWord } = await import("../public/src/services/srs.js");
    assert.ok(isNewWord(null));
    assert.ok(isNewWord({}));
    assert.ok(!isNewWord({ points: 1 }));
    assert.ok(!isNewWord({ lastReview: 1 }));
    assert.ok(!isNewWord({ successCount: 1 }));
  });
});

describe("getNewWordPool — strict CEFR ordering", () => {
  beforeEach(async () => {
    await db.words.clear();
    await db.progress.clear();
  });

  function makeWord(id, level) {
    return {
      id,
      word: `w${id}`,
      translations: { ru: `слово${id}`, ua: `слово${id}` },
      type: "noun",
      level,
      audio: { us_mp3: "", us_ogg: "", uk_mp3: "", uk_ogg: "" },
      phonetics: { us: "", uk: "" },
      examples: [],
    };
  }

  test("after full reset, returns only A1 words (lowest active level)", async () => {
    const words = [];
    for (let i = 1; i <= 1076; i++) words.push(makeWord(i, "A1"));
    for (let i = 2000; i <= 2999; i++) words.push(makeWord(i, "A2"));
    for (let i = 3000; i <= 3902; i++) words.push(makeWord(i, "B1"));
    for (let i = 4000; i <= 5572; i++) words.push(makeWord(i, "B2"));
    for (let i = 6000; i <= 7403; i++) words.push(makeWord(i, "C1"));
    await db.words.bulkPut(words);

    const { getNewWordPool } = await import("../public/src/services/srs.js");
    const pool = await getNewWordPool(["A1", "A2", "B1", "B2", "C1"], 15);
    assert.equal(pool.length, 15);
    for (const w of pool) {
      assert.equal(w.level, "A1", `expected only A1, got ${w.level} (id=${w.id})`);
    }
  });

  test("never mixes levels when lowest active level has enough words", async () => {
    const words = [];
    for (let i = 1; i <= 30; i++) words.push(makeWord(i, "A1"));
    for (let i = 100; i <= 130; i++) words.push(makeWord(i, "C1"));
    await db.words.bulkPut(words);

    const { getNewWordPool } = await import("../public/src/services/srs.js");
    const pool = await getNewWordPool(["A1", "A2", "B1", "B2", "C1"], 20);
    assert.equal(pool.length, 20);
    for (const w of pool) {
      assert.equal(w.level, "A1");
    }
  });

  test("moves to next level when current has no stage-0 words", async () => {
    const words = [];
    for (let i = 1; i <= 5; i++) words.push(makeWord(i, "A1"));
    for (let i = 100; i <= 130; i++) words.push(makeWord(i, "C1"));
    await db.words.bulkPut(words);

    await db.progress.bulkPut(
      [1, 2, 3, 4, 5].map((id) => ({
        wordId: id,
        points: 100,
        lastTouchedDate: "2024-01-01",
        accumulatedToday: 0,
      }))
    );

    const { getNewWordPool } = await import("../public/src/services/srs.js");
    const pool = await getNewWordPool(["A1", "A2", "B1", "B2", "C1"], 10);
    assert.equal(pool.length, 10);
    for (const w of pool) {
      assert.equal(w.level, "C1", `expected C1 fallback, got ${w.level}`);
    }
  });

  test("respects activeLevels filter (skips excluded levels)", async () => {
    const words = [];
    for (let i = 1; i <= 30; i++) words.push(makeWord(i, "A1"));
    for (let i = 100; i <= 130; i++) words.push(makeWord(i, "B1"));
    await db.words.bulkPut(words);

    const { getNewWordPool } = await import("../public/src/services/srs.js");
    const pool = await getNewWordPool(["B1"], 10);
    assert.equal(pool.length, 10);
    for (const w of pool) {
      assert.equal(w.level, "B1");
    }
  });

  test("empty pool when activeLevels is empty", async () => {
    const { getNewWordPool } = await import("../public/src/services/srs.js");
    const pool = await getNewWordPool([], 15);
    assert.equal(pool.length, 0);
  });

  test("partial words at lowest level take precedence over fresh at higher levels", async () => {
    const words = [];
    for (let i = 1; i <= 20; i++) words.push(makeWord(i, "A1"));
    for (let i = 100; i <= 150; i++) words.push(makeWord(i, "C1"));
    await db.words.bulkPut(words);

    const today = new Date().toISOString().slice(0, 10);
    await db.progress.bulkPut([
      { wordId: 1, points: 10, lastTouchedDate: today, accumulatedToday: 0 },
      { wordId: 2, points: 15, lastTouchedDate: today, accumulatedToday: 0 },
      { wordId: 3, points: 5, lastTouchedDate: today, accumulatedToday: 0 },
    ]);

    const { getNewWordPool } = await import("../public/src/services/srs.js");
    const pool = await getNewWordPool(["A1", "A2", "B1", "B2", "C1"], 15);
    assert.equal(pool.length, 15);
    const ids = pool.map((w) => w.id).sort((a, b) => a - b);
    assert.deepEqual(ids.slice(0, 3), [1, 2, 3], "partial A1 words should come first");
    for (const w of pool) {
      assert.equal(w.level, "A1");
    }
  });
});

describe("getDebtByLevel", () => {
  beforeEach(async () => {
    await db.words.clear();
    await db.progress.clear();
  });

  function makeWord(id, level) {
    return {
      id,
      word: `w${id}`,
      translations: { ru: `с${id}`, ua: `с${id}` },
      type: "noun",
      level,
      audio: { us_mp3: "", us_ogg: "", uk_mp3: "", uk_ogg: "" },
      phonetics: { us: "", uk: "" },
      examples: [],
    };
  }

  test("zero debt when no progress", async () => {
    await db.words.bulkPut([makeWord(1, "A1"), makeWord(2, "B1")]);
    const { getDebtByLevel } = await import("../public/src/services/srs.js");
    const debt = await getDebtByLevel(["A1", "A2", "B1", "B2", "C1"]);
    assert.equal(debt.total, 0);
    assert.equal(debt.byLevel.A1, 0);
    assert.equal(debt.byLevel.B1, 0);
  });

  test("counts due words with points > 0 and nextReview <= now", async () => {
    await db.words.bulkPut([makeWord(1, "A1"), makeWord(2, "A1"), makeWord(3, "B1")]);
    const past = Date.now() - 1000;
    await db.progress.bulkPut([
      { wordId: 1, points: 20, nextReview: past, lastTouchedDate: "2024-01-01", accumulatedToday: 0 },
      { wordId: 2, points: 60, nextReview: past, lastTouchedDate: "2024-01-01", accumulatedToday: 0 },
      { wordId: 3, points: 80, nextReview: past, lastTouchedDate: "2024-01-01", accumulatedToday: 0 },
    ]);
    const { getDebtByLevel } = await import("../public/src/services/srs.js");
    const debt = await getDebtByLevel(["A1", "A2", "B1", "B2", "C1"]);
    assert.equal(debt.total, 3);
    assert.equal(debt.byLevel.A1, 2);
    assert.equal(debt.byLevel.B1, 1);
  });

  test("ignores words with points = 0 (never learned)", async () => {
    await db.words.bulkPut([makeWord(1, "A1")]);
    await db.progress.put({ wordId: 1, points: 0, nextReview: 0, lastTouchedDate: null, accumulatedToday: 0 });
    const { getDebtByLevel } = await import("../public/src/services/srs.js");
    const debt = await getDebtByLevel(["A1"]);
    assert.equal(debt.total, 0);
  });

  test("ignores mastered words (points >= 100)", async () => {
    await db.words.bulkPut([makeWord(1, "A1")]);
    await db.progress.put({ wordId: 1, points: 100, nextReview: 0, lastTouchedDate: "2024-01-01", accumulatedToday: 0 });
    const { getDebtByLevel } = await import("../public/src/services/srs.js");
    const debt = await getDebtByLevel(["A1"]);
    assert.equal(debt.total, 0);
  });

  test("ignores words with nextReview in the future", async () => {
    await db.words.bulkPut([makeWord(1, "A1")]);
    const future = Date.now() + 86400000;
    await db.progress.put({ wordId: 1, points: 40, nextReview: future, lastTouchedDate: "2024-01-01", accumulatedToday: 0 });
    const { getDebtByLevel } = await import("../public/src/services/srs.js");
    const debt = await getDebtByLevel(["A1"]);
    assert.equal(debt.total, 0);
  });

  test("respects activeLevels filter", async () => {
    await db.words.bulkPut([makeWord(1, "A1"), makeWord(2, "C1")]);
    const past = Date.now() - 1000;
    await db.progress.bulkPut([
      { wordId: 1, points: 20, nextReview: past, lastTouchedDate: "2024-01-01", accumulatedToday: 0 },
      { wordId: 2, points: 20, nextReview: past, lastTouchedDate: "2024-01-01", accumulatedToday: 0 },
    ]);
    const { getDebtByLevel } = await import("../public/src/services/srs.js");
    const debt = await getDebtByLevel(["A1"]);
    assert.equal(debt.total, 1);
    assert.equal(debt.byLevel.A1, 1);
    assert.equal(debt.byLevel.C1, 0);
  });
});

describe("getDailyLearnPool — fixed-for-day snapshot", () => {
  beforeEach(async () => {
    await db.words.clear();
    await db.progress.clear();
    localStorage.clear();
  });

  function makeWord(id, level) {
    return {
      id,
      word: `w${id}`,
      translations: { ru: `с${id}`, ua: `с${id}` },
      type: "noun",
      level,
      audio: { us_mp3: "", us_ogg: "", uk_mp3: "", uk_ogg: "" },
      phonetics: { us: "", uk: "" },
      examples: [],
    };
  }

  test("first call generates fresh pool from lowest active level", async () => {
    const words = [];
    for (let i = 1; i <= 30; i++) words.push(makeWord(i, "A1"));
    for (let i = 100; i <= 130; i++) words.push(makeWord(i, "C1"));
    await db.words.bulkPut(words);

    const { getDailyLearnPool } = await import("../public/src/services/srs.js");
    const pool = await getDailyLearnPool(["A1", "A2", "B1", "B2", "C1"], 15);
    assert.equal(pool.length, 15);
    for (const w of pool) assert.equal(w.level, "A1");
  });

  test("second call same day returns identical pool (does not advance)", async () => {
    const words = [];
    for (let i = 1; i <= 60; i++) words.push(makeWord(i, "A1"));
    await db.words.bulkPut(words);

    const { getDailyLearnPool } = await import("../public/src/services/srs.js");
    const first = await getDailyLearnPool(["A1"], 15);
    const firstIds = first.map((w) => w.id).sort((a, b) => a - b);

    const second = await getDailyLearnPool(["A1"], 15);
    const secondIds = second.map((w) => w.id).sort((a, b) => a - b);
    assert.deepEqual(secondIds, firstIds, "pool should be identical across calls on the same day");
  });

  test("snapshot persists graduated state — pool stays the same after cap", async () => {
    const words = [];
    for (let i = 1; i <= 20; i++) words.push(makeWord(i, "A1"));
    await db.words.bulkPut(words);

    const { getDailyLearnPool } = await import("../public/src/services/srs.js");
    const first = await getDailyLearnPool(["A1"], 10);
    const firstIds = first.map((w) => w.id);

    await db.progress.bulkPut(
      firstIds.map((id) => ({
        wordId: id,
        points: 100,
        lastTouchedDate: new Date().toISOString().slice(0, 10),
        accumulatedToday: 20,
      }))
    );

    const second = await getDailyLearnPool(["A1"], 10);
    const secondIds = second.map((w) => w.id).sort((a, b) => a - b);
    assert.deepEqual(
      secondIds,
      firstIds.slice().sort((a, b) => a - b),
      "pool must NOT advance to fresh words even after words graduate"
    );
  });

  test("returns empty pool when activeLevels yields no candidates", async () => {
    const { getDailyLearnPool } = await import("../public/src/services/srs.js");
    const pool = await getDailyLearnPool(["A1"], 15);
    assert.equal(pool.length, 0);
  });

  test("changing dailyNorm mid-day regenerates snapshot with new size", async () => {
    const words = [];
    for (let i = 1; i <= 30; i++) words.push(makeWord(i, "A1"));
    await db.words.bulkPut(words);

    const { getDailyLearnPool } = await import("../public/src/services/srs.js");
    const first = await getDailyLearnPool(["A1"], 15);
    assert.equal(first.length, 15);

    const second = await getDailyLearnPool(["A1"], 5);
    assert.equal(second.length, 5, "quota change must trigger regeneration with new size");

    const third = await getDailyLearnPool(["A1"], 5);
    assert.equal(third.length, 5);
    const secondIds = second.map((w) => w.id).sort((a, b) => a - b);
    const thirdIds = third.map((w) => w.id).sort((a, b) => a - b);
    assert.deepEqual(thirdIds, secondIds, "matching quota must reuse snapshot");
  });

  test("ignores legacy snapshot format (plain array without quota)", async () => {
    const words = [];
    for (let i = 1; i <= 20; i++) words.push(makeWord(i, "A1"));
    await db.words.bulkPut(words);

    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`lew.learnDailyPool.${today}`, JSON.stringify([1, 2, 3, 4, 5]));

    const { getDailyLearnPool } = await import("../public/src/services/srs.js");
    const pool = await getDailyLearnPool(["A1"], 15);
    assert.equal(pool.length, 15, "legacy format must be replaced with new quota-sized snapshot");
  });
});

describe("getCurrentLevel", () => {
  const LEVEL_TOTALS = { A1: 1076, A2: 992, B1: 903, B2: 1573, C1: 1404 };

  test("returns null when no active levels", async () => {
    const { getCurrentLevel } = await import("../public/src/services/srs.js");
    assert.equal(getCurrentLevel([], {}), null);
  });

  test("returns the lowest active level when none are mastered", async () => {
    const { getCurrentLevel } = await import("../public/src/services/srs.js");
    assert.equal(getCurrentLevel(["A1", "A2"], {}), "A1");
    assert.equal(getCurrentLevel(["B1", "B2"], {}), "B1");
  });

  test("skips fully mastered levels to find next one", async () => {
    const { getCurrentLevel } = await import("../public/src/services/srs.js");
    assert.equal(getCurrentLevel(["A1", "A2", "B1"], { A1: LEVEL_TOTALS.A1 }), "A2");
    assert.equal(
      getCurrentLevel(["A1", "A2", "B1"], { A1: LEVEL_TOTALS.A1, A2: LEVEL_TOTALS.A2 }),
      "B1",
    );
  });

  test("returns last active level when all are mastered", async () => {
    const { getCurrentLevel } = await import("../public/src/services/srs.js");
    const allMastered = {
      A1: LEVEL_TOTALS.A1,
      A2: LEVEL_TOTALS.A2,
    };
    assert.equal(getCurrentLevel(["A1", "A2"], allMastered), "A2");
  });
});
