import db from "../services/db.js";
import * as settings from "../services/settings.js";
import * as i18n from "../services/i18n.js";
import * as router from "../router.js";
import { CEFR_LEVELS } from "../services/settings.js";
import { isImported } from "../services/import.js";
import { buildQuiz, QUIZ_TYPES, xpForQuizType } from "../services/quiz-factory.js";
import { recordReview } from "../services/stats.js";
import { playCorrect, playWrong, vibrate } from "../services/audio.js";
import { toastError } from "../components/toast.js";
import { escapeHtml } from "../services/quiz-factory.js";
import { shuffle } from "../services/random.js";
import "../components/quiz-choice.js";
import "../components/quiz-letters.js";
import "../components/quiz-input.js";
import "../components/quiz-cloze.js";
import "../components/progress-bar.js";
import "../components/icon.js";

function quizTypeLabel(key) {
  return i18n.t(`quizType.${key}`);
}

export async function mount(outlet) {
  document.title = `LEW — ${i18n.t("quiz.title")}`;

  if (!(await isImported())) {
    router.replace("/onboarding");
    return () => {};
  }

  let selectedLevel = "A1";
  let selectedType = null;
  let active = true;
  const cleanup = () => {
    active = false;
  };

  outlet.innerHTML = `
    <div class="quiz-page">
      <h1 class="page__title">${escapeHtml(i18n.t("quiz.title"))}</h1>

      <section class="section card">
        <h3 class="section__title">${escapeHtml(i18n.t("quiz.chooseLevel"))}</h3>
        <div class="segmented" id="level-filter" role="radiogroup">
          <button class="segmented__btn segmented__btn--active" data-level="all" role="radio" aria-checked="true">${escapeHtml(i18n.t("dictionary.all"))}</button>
          ${CEFR_LEVELS.map((l) => `<button class="segmented__btn" data-level="${l}" role="radio" aria-checked="false">${escapeHtml(l)}</button>`).join("")}
        </div>
      </section>

      <section class="section card">
        <h3 class="section__title">${escapeHtml(i18n.t("quiz.chooseType"))}</h3>
        <div class="quiz-selector" id="type-filter">
          ${QUIZ_TYPES.map(
              (k) =>
                `<button class="btn quiz-selector__btn" data-type="${k}"><span class="quiz-selector__title">${escapeHtml(quizTypeLabel(k))}</span></button>`
            )
            .join("")}
        </div>
      </section>

      <section class="section">
        <button class="btn btn--large btn--block" id="start" type="button" disabled>
          ${escapeHtml(i18n.t("quiz.start"))}
        </button>
      </section>
    </div>
  `;

  const startBtn = outlet.querySelector("#start");

  const levelCtl = outlet.querySelector("#level-filter");
  levelCtl.addEventListener("click", (e) => {
    if (!active) return;
    const btn = e.target.closest("[data-level]");
    if (!btn) return;
    selectedLevel = btn.getAttribute("data-level");
    levelCtl.querySelectorAll("[data-level]").forEach((b) => {
      const activeBtn = b === btn;
      b.classList.toggle("segmented__btn--active", activeBtn);
      b.setAttribute("aria-checked", String(activeBtn));
    });
  });

  const typeCtl = outlet.querySelector("#type-filter");
  typeCtl.addEventListener("click", (e) => {
    if (!active) return;
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    selectedType = btn.getAttribute("data-type");
    typeCtl.querySelectorAll("[data-type]").forEach((b) => {
      b.classList.toggle("quiz-selector__btn--active", b === btn);
    });
    startBtn.disabled = false;
  });

  startBtn.addEventListener("click", async () => {
    if (!active) return;
    startBtn.disabled = true;
    try {
      await runFreeQuiz(outlet, selectedLevel, selectedType, () => active);
    } finally {
      if (active) startBtn.disabled = false;
    }
  });

  return cleanup;
}

async function runFreeQuiz(outlet, level, type, isActive) {
  outlet.innerHTML = `<div class="empty-state" role="status" aria-live="polite"><div class="spinner" aria-label="${escapeHtml(i18n.t("common.loading"))}"></div></div>`;
  try {
    let pool;
    if (level === "all") {
      pool = await db.words.toArray();
    } else {
      pool = await db.words.where("level").equals(level).limit(200).toArray();
    }
    const queue = shuffle(pool).slice(0, 20).map((w) => ({ word: w }));

    if (!queue.length) {
      outlet.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">${escapeHtml(i18n.t("quiz.empty"))}</div>
          <a href="/" class="btn" data-link>${escapeHtml(i18n.t("dashboard.title"))}</a>
        </div>
      `;
      return;
    }

    const translationLang = settings.get("translationLang");
    await runSession(outlet, queue, translationLang, type, isActive);
  } catch (e) {
    console.error("[quiz]", e);
    if (!isActive()) return;
    toastError(i18n.t("common.error"));
    outlet.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">${escapeHtml(i18n.t("common.error"))}</div>
        <a href="/" class="btn" data-link>${escapeHtml(i18n.t("dashboard.title"))}</a>
      </div>
    `;
  }
}

async function runSession(outlet, queue, translationLang, forcedType, isActive) {
  const answers = [];

  for (let idx = 0; idx < queue.length; idx++) {
    if (!isActive()) return;
    const item = queue[idx];
    const quizType = forcedType || "en-to-l1";
    let card;
    try {
      card = await buildQuiz(quizType, item.word, translationLang);
    } catch (e) {
      console.error("[free quiz build]", e);
      continue;
    }
    if (!isActive()) return;
    await new Promise((resolve) => {
      drawQuiz(outlet, item, idx, queue.length, card, ({ correct, skipped }) => {
        if (!isActive()) { resolve(); return; }
        if (correct) playCorrect();
        else if (!skipped) {
          playWrong();
          vibrate(100);
        }
        const xp = xpForQuizType(quizType, correct);
        recordReview({ correct, isNew: false, minutes: 0, xp }).catch((e) =>
          console.error("[quiz] recordReview", e)
        );
        answers.push({ wordId: item.word.id, correct, skipped, quizType });
        resolve();
      });
    });
  }
  if (!isActive()) return;
  drawCompletion(outlet, answers);
}

function drawQuiz(outlet, item, idx, total, card, onResult) {
  const { word } = item;
  outlet.innerHTML = `
    <div class="quiz-page">
      <div class="quiz">
        <div class="quiz__progress">${escapeHtml(i18n.t("quiz.progress", idx + 1, total))}</div>
        <progress-bar value="${idx + 1}" max="${total}"></progress-bar>
        <div id="quiz-mount"></div>
      </div>
    </div>
  `;
  const mountEl = outlet.querySelector("#quiz-mount");
  const quizEl = document.createElement(card.tag);
  for (const [k, v] of Object.entries(card.attrs)) {
    if (v === true) quizEl.setAttribute(k, "");
    else if (v !== false && v != null) quizEl.setAttribute(k, String(v));
  }
  mountEl.appendChild(quizEl);

  quizEl.setOnAnswer(({ correct, skipped }) => {
    onResult({ correct, skipped });
  });
}

function drawCompletion(outlet, answers) {
  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  outlet.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon"><lew-icon name="target" size="48"></lew-icon></div>
      <div class="empty-state__title">${escapeHtml(i18n.t("quiz.sessionComplete"))}</div>
      <p class="text-muted">${escapeHtml(i18n.t("quiz.accuracy", correct, total))}</p>
      <a href="/quiz" class="btn" data-link>${escapeHtml(i18n.t("common.retry"))}</a>
      <a href="/" class="btn btn--ghost" data-link>${escapeHtml(i18n.t("dashboard.title"))}</a>
    </div>
  `;
}