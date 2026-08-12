import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mapWord, mapAll } from "../docs/src/services/import.js";

describe("mapWord — basic shape", () => {
  test("maps a well-formed raw entry", () => {
    const raw = {
      id: 7,
      value: {
        word: "test",
        translations: { ru: "тест", ua: "тест" },
        href: "https://example.com/word",
        type: "noun",
        level: "A1",
        us: { mp3: "us.mp3", ogg: "us.ogg" },
        uk: { mp3: "uk.mp3", ogg: "uk.ogg" },
        phonetics: { us: "/t/", uk: "/t/" },
        examples: [{ en: "a test", ru: "тест", ua: "тест" }],
      },
    };
    const w = mapWord(raw);
    assert.equal(w.id, 7);
    assert.equal(w.word, "test");
    assert.equal(w.translations.ru, "тест");
    assert.equal(w.level, "A1");
    assert.equal(w.type, "noun");
    assert.equal(w.audio.us_mp3, "us.mp3");
    assert.equal(w.audio.uk_ogg, "uk.ogg");
    assert.equal(w.phonetics.us, "/t/");
    assert.equal(w.examples.length, 1);
    assert.equal(w.examples[0].en, "a test");
  });

  test("strips href field (not stored)", () => {
    const raw = {
      id: 1,
      value: {
        word: "x",
        translations: { ru: "х", ua: "х" },
        href: "https://should-be-stripped",
        type: "noun",
        level: "A2",
        us: {},
        uk: {},
        phonetics: {},
        examples: [],
      },
    };
    const w = mapWord(raw);
    assert.equal(w.href, undefined);
    assert.ok(!("href" in w));
  });
});

describe("mapWord — resilience", () => {
  test("tolerates missing translations fields", () => {
    const w = mapWord({
      id: 1,
      value: {
        word: "x",
        translations: {},
        type: "noun",
        level: "A2",
        us: {},
        uk: {},
        phonetics: {},
        examples: [],
      },
    });
    assert.equal(w.translations.ru, "");
    assert.equal(w.translations.ua, "");
  });

  test("tolerates missing audio fields", () => {
    const w = mapWord({
      id: 1,
      value: {
        word: "x",
        translations: {},
        type: "noun",
        level: "A2",
        examples: [],
      },
    });
    assert.equal(w.audio.us_mp3, "");
    assert.equal(w.audio.uk_ogg, "");
  });

  test("tolerates missing examples", () => {
    const w = mapWord({
      id: 1,
      value: {
        word: "x",
        translations: {},
        type: "noun",
        level: "A2",
      },
    });
    assert.deepEqual(w.examples, []);
  });

  test("throws on invalid entry (no id)", () => {
    assert.throws(() => mapWord(null));
    assert.throws(() => mapWord({}));
    assert.throws(() => mapWord({ value: {} }));
  });

  test("throws on entry missing word", () => {
    assert.throws(() =>
      mapWord({ id: 1, value: { translations: {}, level: "A1" } })
    );
  });

  test("throws on entry missing level", () => {
    assert.throws(() =>
      mapWord({ id: 1, value: { word: "x", translations: {} } })
    );
  });
});

describe("mapAll", () => {
  test("maps array of entries", () => {
    const arr = [
      {
        id: 0,
        value: {
          word: "a",
          translations: { ru: "х", ua: "х" },
          type: "noun",
          level: "A1",
          examples: [],
        },
      },
      {
        id: 1,
        value: {
          word: "b",
          translations: { ru: "у", ua: "у" },
          type: "verb",
          level: "A2",
          examples: [],
        },
      },
    ];
    const mapped = mapAll(arr);
    assert.equal(mapped.length, 2);
    assert.equal(mapped[0].word, "a");
    assert.equal(mapped[1].level, "A2");
  });
});

describe("real dataset sample", () => {
  test("first entry from words.json maps correctly", () => {
    const sample = {
      id: 0,
      value: {
        word: "a",
        translations: {
          ru: "неопределённый артикль",
          ua: "неозначений артикль",
        },
        href: "https://www.oxfordlearnersdictionaries.com/definition/english/a_1",
        type: "indefinite article",
        level: "A1",
        us: {
          mp3: "https://www.oxfordlearnersdictionaries.com/media/english/us_pron/a/a__/a__us/a__us_2_rr.mp3",
          ogg: "https://www.oxfordlearnersdictionaries.com/media/english/us_pron_ogg/a/a__/a__us/a__us_2_rr.ogg",
        },
        uk: {
          mp3: "https://www.oxfordlearnersdictionaries.com/media/english/uk_pron/a/a__/a__gb/a__gb_2.mp3",
          ogg: "https://www.oxfordlearnersdictionaries.com/media/english/uk_pron_ogg/a/a__/a__gb/a__gb_2.ogg",
        },
        phonetics: { us: "/eɪ/", uk: "/eɪ/" },
        examples: [
          { en: "I have a cat.", ru: "У меня есть кот.", ua: "У мене є кіт." },
        ],
      },
    };
    const w = mapWord(sample);
    assert.equal(w.word, "a");
    assert.equal(w.level, "A1");
    assert.equal(w.phonetics.us, "/eɪ/");
    assert.equal(w.examples[0].en, "I have a cat.");
  });
});