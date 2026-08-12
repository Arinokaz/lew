import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  QUIZ_FACTORIES,
  QUIZ_TYPES,
  quizEnToL1,
  quizL1ToEn,
  quizAudioToEn,
  quizAudioTypeIn,
  quizTypeIn,
  quizCloze,
  quizClozeChoice,
  quizTileL1En,
  buildQuiz,
  invalidateDistractorCache,
} from "../docs/src/services/quiz-factory.js";
import { pointsForQuizType } from "../docs/src/services/srs.js";
import db from "../docs/src/services/db.js";

function makeWord(overrides = {}) {
  return {
    id: 100,
    word: "river",
    translations: { ru: "река", ua: "річка" },
    type: "noun",
    level: "A2",
    audio: { us_mp3: "https://example/river.mp3" },
    examples: [{ en: "Cross the river.", ru: "Пересеки реку.", ua: "Перейди річку." }],
    ...overrides,
  };
}

before(async () => {
  if (!db.isOpen()) await db.open();
  await db.words.clear();
  await db.progress.clear();
  await db.words.bulkPut([
    makeWord({ id: 1, word: "river", type: "noun" }),
    makeWord({ id: 2, word: "mountain", type: "noun" }),
    makeWord({ id: 3, word: "forest", type: "noun" }),
    makeWord({ id: 4, word: "ocean", type: "noun" }),
    makeWord({ id: 5, word: "valley", type: "noun" }),
    makeWord({ id: 6, word: "desert", type: "noun" }),
    makeWord({ id: 7, word: "meadow", type: "noun" }),
    makeWord({ id: 8, word: "stream", type: "noun" }),
    makeWord({ id: 9, word: "lake", type: "noun" }),
    makeWord({ id: 10, word: "creek", type: "noun" }),
    makeWord({ id: 100, word: "river2", type: "noun" }),
    makeWord({ id: 101, word: "mountain2", type: "noun" }),
    makeWord({ id: 102, word: "forest2", type: "noun" }),
    makeWord({ id: 103, word: "ocean2", type: "noun" }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  await db.progress.bulkPut([
    { wordId: 2, points: 60, lastTouchedDate: today, accumulatedToday: 0 },
    { wordId: 3, points: 60, lastTouchedDate: today, accumulatedToday: 0 },
    { wordId: 4, points: 80, lastTouchedDate: today, accumulatedToday: 0 },
    { wordId: 5, points: 60, lastTouchedDate: null, accumulatedToday: 0 },
    { wordId: 6, points: 80, lastTouchedDate: null, accumulatedToday: 0 },
    { wordId: 7, points: 80, lastTouchedDate: null, accumulatedToday: 0 },
  ]);
  invalidateDistractorCache();
});

describe("pointsForQuizType (points-based rules)", () => {
  test("easy = 5", () => {
    assert.equal(pointsForQuizType("en-to-l1"), 5);
    assert.equal(pointsForQuizType("l1-to-en"), 5);
    assert.equal(pointsForQuizType("audio-to-en"), 5);
  });
  test("medium = 10", () => {
    assert.equal(pointsForQuizType("tile-l1-en"), 10);
    assert.equal(pointsForQuizType("tile-audio-en"), 10);
  });
  test("hard = 20", () => {
    assert.equal(pointsForQuizType("type-in"), 20);
    assert.equal(pointsForQuizType("cloze"), 20);
    assert.equal(pointsForQuizType("audio-type-in"), 20);
  });
  test("cloze-choice = 5 (easy)", () => {
    assert.equal(pointsForQuizType("cloze-choice"), 5);
  });
});

describe("QUIZ_TYPES registry completeness", () => {
  test("9 types registered", () => {
    assert.equal(QUIZ_TYPES.length, 9);
  });
  test("includes audio-type-in (new)", () => {
    assert.ok(QUIZ_TYPES.includes("audio-type-in"));
  });
  test("every factory is callable", () => {
    for (const t of QUIZ_TYPES) {
      assert.equal(typeof QUIZ_FACTORIES[t], "function", `Missing: ${t}`);
    }
  });
});

describe("quiz factory specs return correct tags and attrs", () => {
  test("quizEnToL1 returns quiz-choice with 4 options", async () => {
    const word = makeWord({ id: 100, word: "river2" });
    const spec = await quizEnToL1(word, "ru");
    assert.equal(spec.tag, "quiz-choice");
    const options = JSON.parse(spec.attrs.options);
    assert.equal(options.length, 4);
    assert.ok(options.includes("река"));
    assert.equal(spec.attrs.prompt, "river2");
  });

  test("quizL1ToEn returns quiz-choice with translation prompt", async () => {
    const word = makeWord({ id: 100, word: "river2" });
    const spec = await quizL1ToEn(word, "ru");
    assert.equal(spec.tag, "quiz-choice");
    assert.equal(spec.attrs.prompt, "река");
    const options = JSON.parse(spec.attrs.options);
    assert.ok(options.includes("river2"));
  });

  test("quizAudioToEn returns quiz-choice with audio", async () => {
    const word = makeWord({ id: 100, word: "river2" });
    const spec = await quizAudioToEn(word, "ru");
    assert.equal(spec.tag, "quiz-choice");
    assert.equal(spec.attrs.prompt, "🔊");
    assert.equal(spec.attrs["audio-url"], "https://example/river.mp3");
  });

  test("quizTypeIn returns quiz-input with prompt + target", async () => {
    const word = makeWord({ id: 100, word: "river2" });
    const spec = await quizTypeIn(word, "ru");
    assert.equal(spec.tag, "quiz-input");
    assert.equal(spec.attrs.prompt, "река");
    assert.equal(spec.attrs.target, "river2");
  });

  test("quizAudioTypeIn returns quiz-input with audio-url", async () => {
    const word = makeWord({ id: 100, word: "river2" });
    const spec = await quizAudioTypeIn(word, "ru");
    assert.equal(spec.tag, "quiz-input");
    assert.equal(spec.attrs.prompt, "🔊");
    assert.equal(spec.attrs.target, "river2");
    assert.equal(spec.attrs["audio-url"], "https://example/river.mp3");
  });

  test("quizCloze masks the word in example sentence", async () => {
    const word = makeWord({ id: 1, word: "river" });
    const spec = await quizCloze(word, "ru");
    assert.equal(spec.tag, "quiz-cloze");
    assert.ok(spec.attrs.sentence.includes("___"));
  });

  test("quizClozeChoice returns quiz-cloze with options", async () => {
    const word = makeWord({ id: 1, word: "river" });
    const spec = await quizClozeChoice(word, "ru");
    assert.equal(spec.tag, "quiz-cloze");
    const options = JSON.parse(spec.attrs.options);
    assert.equal(options.length, 4);
    assert.ok(options.includes("river"));
  });

  test("quizTileL1En (l1 mode) returns quiz-letters", async () => {
    const word = makeWord({ id: 100, word: "river2" });
    const spec = await quizTileL1En(word, "ru", "l1");
    assert.equal(spec.tag, "quiz-letters");
    assert.equal(spec.attrs.prompt, "река");
    assert.equal(spec.attrs.target, "river2");
  });

  test("quizTileL1En (audio mode) returns quiz-letters with audio-url", async () => {
    const word = makeWord({ id: 100, word: "river2" });
    const spec = await quizTileL1En(word, "ru", "audio");
    assert.equal(spec.tag, "quiz-letters");
    assert.ok(spec.attrs.prompt.startsWith("🔊"));
    assert.equal(spec.attrs["audio-url"], "https://example/river.mp3");
  });
});

describe("distractor selection — excludes today's pool", () => {
  test("does not include words touched today", async () => {
    const word = makeWord({ id: 1, word: "river" });
    for (let i = 0; i < 50; i++) {
      const spec = await quizL1ToEn(word, "ru");
      const options = JSON.parse(spec.attrs.options);
      assert.ok(!options.includes("mountain"), "mountain touched today, must be excluded");
      assert.ok(!options.includes("forest"), "forest touched today, must be excluded");
      assert.ok(!options.includes("ocean"), "ocean touched today, must be excluded");
      invalidateDistractorCache();
    }
  });

  test("prefers words at stage >= 2 (points >= 40)", async () => {
    const word = makeWord({ id: 1, word: "river" });
    const seenPreferred = new Set();
    for (let i = 0; i < 100; i++) {
      const spec = await quizL1ToEn(word, "ru");
      const options = JSON.parse(spec.attrs.options);
      for (const o of options) {
        if (["valley", "desert", "meadow"].includes(o)) seenPreferred.add(o);
      }
      invalidateDistractorCache();
    }
    assert.ok(seenPreferred.size >= 1, "should use at least one preferred distractor across runs");
  });
});

describe("audio-type-in (new quiz)", () => {
  test("buildQuiz resolves audio-type-in", async () => {
    const word = makeWord({ id: 100, word: "river2" });
    const spec = await buildQuiz("audio-type-in", word, "ru");
    assert.equal(spec.tag, "quiz-input");
    assert.equal(spec.attrs.target, "river2");
    assert.ok(spec.attrs["audio-url"]);
  });
});
