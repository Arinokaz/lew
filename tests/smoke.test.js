import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

describe("smoke test — components and pages", () => {
  let dom;

  before(async () => {
    dom = new JSDOM(
      `<!doctype html><html><body><div id="app"></div></body></html>`,
      {
        url: "http://localhost:8765/",
        pretendToBeVisual: true,
      }
    );
    Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.customElements = dom.window.customElements;
    globalThis.CustomEvent = dom.window.CustomEvent;
    globalThis.localStorage = dom.window.localStorage;
    globalThis.location = dom.window.location;
    globalThis.history = dom.window.history;
    Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
    globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
    globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame;
  });

  test("all components register custom elements", async () => {
    await import("../docs/src/components/toast.js");
    await import("../docs/src/components/word-card.js");
    await import("../docs/src/components/audio-player.js");
    await import("../docs/src/components/quiz-choice.js");
    await import("../docs/src/components/quiz-letters.js");
    await import("../docs/src/components/quiz-input.js");
    await import("../docs/src/components/quiz-cloze.js");
    await import("../docs/src/components/progress-bar.js");
    await import("../docs/src/components/streak-badge.js");
    await import("../docs/src/components/stat-tile.js");
    await import("../docs/src/components/toggle.js");
    await import("../docs/src/components/slider.js");
    await import("../docs/src/components/level-meter.js");

    const expected = [
      "toast-stack",
      "word-card",
      "audio-player",
      "quiz-choice",
      "quiz-letters",
      "quiz-input",
      "quiz-cloze",
      "progress-bar",
      "streak-badge",
      "stat-tile",
      "lew-toggle",
      "lew-slider",
      "level-meter",
    ];
    for (const tag of expected) {
      assert.ok(customElements.get(tag), `Custom element ${tag} not registered`);
    }
  });

  test("toggle component toggles on click", async () => {
    const t = document.createElement("lew-toggle");
    document.body.appendChild(t);
    assert.ok(!t.hasAttribute("checked"));
    t.click();
    assert.ok(t.hasAttribute("checked"));
    t.click();
    assert.ok(!t.hasAttribute("checked"));
  });

  test("progress-bar renders value/max", async () => {
    const p = document.createElement("progress-bar");
    p.setAttribute("value", "30");
    p.setAttribute("max", "100");
    document.body.appendChild(p);
    assert.ok(p.innerHTML.includes("progress-bar__fill"));
  });

  test("streak-badge shows count", async () => {
    const s = document.createElement("streak-badge");
    s.setAttribute("count", "5");
    document.body.appendChild(s);
    assert.ok(s.innerHTML.includes("5"));
  });

  test("quiz-choice renders prompt and options", async () => {
    const q = document.createElement("quiz-choice");
    q.setAttribute("prompt", "test");
    q.setAttribute("options", '["a","b","c","d"]');
    q.setAttribute("correct-index", "1");
    document.body.appendChild(q);
    const opts = q.querySelectorAll(".quiz__option");
    assert.equal(opts.length, 4);
  });

  test("router module loads", async () => {
    const r = await import("../docs/src/router.js");
    assert.equal(typeof r.go, "function");
    assert.equal(typeof r.currentPath, "function");
  });

  test("settings module initializes with defaults", async () => {
    const s = await import("../docs/src/services/settings.js");
    assert.equal(s.get("theme"), "auto");
    assert.equal(s.get("dailyNorm"), 15);
    assert.equal(s.get("repeatSessionSize"), 15);
    assert.deepEqual(s.get("activeLevels"), ["A1", "A2", "B1", "B2", "C1"]);
  });

  test("i18n module provides translations for all 3 langs", async () => {
    const i = await import("../docs/src/services/i18n.js");
    i.setLang("ru");
    assert.equal(i.t("nav.home"), "Главная");
    i.setLang("ua");
    assert.equal(i.t("nav.home"), "Головна");
    i.setLang("en");
    assert.equal(i.t("nav.home"), "Home");
  });

  test("nav keys exist for all 7 routes across 3 langs", async () => {
    const i = await import("../docs/src/services/i18n.js");
    const keys = ["home", "learn", "repeat", "quiz", "stats", "dictionary", "settings"];
    for (const lang of ["ru", "ua", "en"]) {
      i.setLang(lang);
      for (const k of keys) {
        const v = i.t(`nav.${k}`);
        assert.notEqual(v, `nav.${k}`, `Missing nav.${k} for lang=${lang}`);
      }
    }
  });

  test("setQuizActive toggles body dataset (only in browser)", async () => {
    const qs = await import("../docs/src/quiz-state.js");
    qs.setQuizActive(true);
    assert.equal(document.body.dataset.quizActive, "true");
    qs.setQuizActive(false);
    assert.equal(document.body.dataset.quizActive, undefined);
  });

  test("quiz-choice fires onAnswer callback after click", async () => {
    await import("../docs/src/components/quiz-choice.js");
    const q = document.createElement("quiz-choice");
    q.setAttribute("prompt", "test");
    q.setAttribute("options", '["a","b","c","d"]');
    q.setAttribute("correct-index", "0");
    document.body.appendChild(q);

    let called = 0;
    let lastCorrect = null;
    q.setOnAnswer(({ correct }) => {
      called += 1;
      lastCorrect = correct;
    });

    const optBtn = q.querySelectorAll(".quiz__option")[0];
    optBtn.click();
    assert.equal(called, 0, "answer should not fire synchronously");
    await new Promise((r) => setTimeout(r, 700));
    assert.equal(called, 1, "answer should fire after delay");
    assert.equal(lastCorrect, true);
  });

  test("xpEarned formats as +N XP, not [object Object]", async () => {
    const i = await import("../docs/src/services/i18n.js");
    i.setLang("ru");
    assert.equal(i.t("quiz.xpEarned", 25), "+25 XP");
    assert.equal(i.t("quiz.xpEarned", 0), "+0 XP");
  });

  test("quiz-choice does NOT autoplay audio on render", async () => {
    await import("../docs/src/components/quiz-choice.js");
    const q = document.createElement("quiz-choice");
    q.setAttribute("prompt", "test");
    q.setAttribute("options", '["a","b","c","d"]');
    q.setAttribute("correct-index", "0");
    q.setAttribute("audio-url", "https://example.com/audio.mp3");
    document.body.appendChild(q);
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(q._audioTimer, undefined, "audio timer must not be scheduled");
  });

  test("quiz-letters does NOT replay audio when picking a letter", async () => {
    await import("../docs/src/components/quiz-letters.js");
    const q = document.createElement("quiz-letters");
    q.setAttribute("prompt", "test");
    q.setAttribute("target", "cat");
    q.setAttribute("extra", "1");
    q.setAttribute("audio-url", "https://example.com/audio.mp3");
    document.body.appendChild(q);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(q._audioTimer, undefined, "audio timer must not be scheduled on render");
    const tile = q.querySelector(".tile-builder__tile");
    tile.click();
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(q._audioTimer, undefined, "audio timer must not be scheduled on letter pick");
  });
});