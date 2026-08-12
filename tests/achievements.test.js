import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("ACHIEVEMENTS list integrity", () => {
  test("all achievement IDs are unique", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("every achievement has id, title, icon, check function", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    for (const a of ACHIEVEMENTS) {
      assert.ok(typeof a.id === "string" && a.id.length > 0);
      assert.ok(typeof a.title === "string" && a.title.length > 0);
      assert.ok(typeof a.icon === "string" && a.icon.length > 0);
      assert.equal(typeof a.check, "function");
    }
  });

  test("streak achievements have increasing thresholds", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const checks = ACHIEVEMENTS.filter((a) => a.id.startsWith("streak_"))
      .map((a) => a.id);
    assert.deepEqual(checks, ["streak_3", "streak_7", "streak_30", "streak_100"]);
  });

  test("words achievements have increasing thresholds", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const checks = ACHIEVEMENTS.filter((a) => a.id.startsWith("words_"))
      .map((a) => a.id);
    assert.deepEqual(checks, ["words_10", "words_50", "words_100", "words_500", "words_1000"]);
  });

  test("level achievements cover A1-C1", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const checks = ACHIEVEMENTS.filter((a) => a.id.startsWith("level_"))
      .map((a) => a.id);
    assert.deepEqual(checks, ["level_a1_done", "level_a2_done", "level_b1_done", "level_b2_done", "level_c1_done"]);
  });

  test("first_word achievement triggers at totalActivated >= 1", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const a = ACHIEVEMENTS.find((x) => x.id === "first_word");
    assert.equal(a.check({ totalActivated: 0, totalLearned: 10 }), false);
    assert.equal(a.check({ totalActivated: 1 }), true);
    assert.equal(a.check({ totalActivated: 100 }), true);
  });

  test("streak achievement uses streak threshold", async () => {
    const { ACHIEVEMENTS } = await import("../docs/src/services/achievements.js");
    const a = ACHIEVEMENTS.find((x) => x.id === "streak_7");
    assert.equal(a.check({ streak: 6 }), false);
    assert.equal(a.check({ streak: 7 }), true);
    assert.equal(a.check({ streak: 100 }), true);
  });
});

describe("quiz-factory exports", () => {
  test("exports 8 quiz factory functions", async () => {
    const mod = await import("../docs/src/services/quiz-factory.js");
    const expected = [
      "en-to-l1",
      "l1-to-en",
      "audio-to-en",
      "tile-l1-en",
      "tile-audio-en",
      "type-in",
      "cloze",
      "cloze-choice",
    ];
    for (const t of expected) {
      assert.equal(typeof mod.QUIZ_FACTORIES[t], "function");
    }
  });

  test("buildQuiz throws on unknown type", async () => {
    const { buildQuiz } = await import("../docs/src/services/quiz-factory.js");
    await assert.rejects(() => buildQuiz("nope", {}, "ru"));
  });
});