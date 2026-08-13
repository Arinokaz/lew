import db from "../services/db.js";
import * as settings from "../services/settings.js";
import * as i18n from "../services/i18n.js";
import * as router from "../router.js";
import {
  recordQuizResult,
  pointsForQuizType,
  getDailyLearnPool,
  getDebtByLevel,
} from "../services/srs.js";
import { isImported } from "../services/import.js";
import { ensureTodayStats, recordReview, addSessionBonus } from "../services/stats.js";
import { checkAndUnlockAchievements } from "../services/achievements.js";
import {
  buildQuiz,
  QUIZ_TYPES,
  xpForQuizType,
  invalidateDistractorCache,
} from "../services/quiz-factory.js";
import { playCorrect, playWrong, vibrate } from "../services/audio.js";
import { toast, toastError, toastSuccess } from "../components/toast.js";
import { shuffleInPlace } from "../services/random.js";
import { escapeHtml } from "../utils/html.js";
import { renderQuizSelector, bindQuizSelector } from "../quiz-selector.js";
import { setQuizActive } from "../quiz-state.js";
import "../components/quiz-choice.js";
import "../components/quiz-letters.js";
import "../components/quiz-input.js";
import "../components/quiz-cloze.js";
import "../components/quiz-preview.js";
import "../components/progress-bar.js";
import "../components/audio-player.js";
import "../components/icon.js";

const SESSION_BONUS = 25;

export async function mount(outlet) {
  if (!(await isImported())) {
    router.replace("/onboarding");
    return () => {};
  }

  document.title = `LEW — ${i18n.t("learn.title")}`;

  let active = true;
  const cleanup = () => {
    active = false;
    setQuizActive(false);
  };

  outlet.innerHTML = `<div class="learn-page"><div class="empty-state" role="status" aria-live="polite"><div class="spinner" aria-label="${escapeHtml(i18n.t("common.loading"))}"></div></div></div>`;

  try {
    await ensureTodayStats();
    const dailyNorm = settings.get("dailyNorm");
    const activeLevels = settings.get("activeLevels");
    const translationLang = settings.get("translationLang");

    const [pool, debt] = await Promise.all([
      getDailyLearnPool(activeLevels, dailyNorm),
      getDebtByLevel(activeLevels),
    ]);

    if (!active) return cleanup;

    if (!pool.length) {
      outlet.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><lew-icon name="party" size="48"></lew-icon></div>
          <div class="empty-state__title">${i18n.t("learn.empty")}</div>
          <a href="/" class="btn" data-link>${i18n.t("dashboard.title")}</a>
        </div>
      `;
      return cleanup;
    }

    if (debt.total > 0) {
      showDebtWarning(outlet, pool, translationLang, dailyNorm, activeLevels, debt, () => active);
      return cleanup;
    }

    showQuizSelector(outlet, pool, translationLang, dailyNorm, activeLevels, () => active);
  } catch (e) {
    console.error("[learn]", e);
    if (active) {
      outlet.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">${i18n.t("common.error")}</div>
          <a href="/" class="btn" data-link>${i18n.t("dashboard.title")}</a>
        </div>
      `;
      toastError(i18n.t("common.error"));
    }
  }

  return cleanup;
}

function showDebtWarning(outlet, pool, translationLang, dailyNorm, activeLevels, debt, isActive) {
  outlet.innerHTML = `
    <div class="learn-page">
      <h1 class="page__title">${i18n.t("learn.title")}</h1>
      <div class="debt-card debt-card--moderate" role="alert">
        <div class="debt-card__head">
          <span class="debt-card__label">${escapeHtml(i18n.t("learn.debtWarningTitle"))}</span>
        </div>
        <div class="debt-card__breakdown">${escapeHtml(i18n.t("learn.debtWarningBody", { count: debt.total }))}</div>
        <div class="row row--wrap gap-2 mt-2">
          <button class="btn btn--block" id="debt-repeat" type="button">${escapeHtml(i18n.t("learn.debtWarningReview"))}</button>
          <button class="btn btn--block btn--secondary" id="debt-learn" type="button">${escapeHtml(i18n.t("learn.debtWarningLearn"))}</button>
        </div>
      </div>
    </div>
  `;
  outlet.querySelector("#debt-repeat")?.addEventListener("click", () => {
    if (!isActive()) return;
    router.go("/repeat");
  });
  outlet.querySelector("#debt-learn")?.addEventListener("click", () => {
    if (!isActive()) return;
    showQuizSelector(outlet, pool, translationLang, dailyNorm, activeLevels, isActive);
  });
}

function showQuizSelector(outlet, pool, translationLang, dailyNorm, activeLevels, isActive) {
  outlet.innerHTML = `
    <div class="learn-page">
      ${renderQuizSelector({ items: QUIZ_TYPES, poolSize: pool.length, prefix: "learn", withPreview: true })}
    </div>
  `;
  bindQuizSelector(outlet, (quizType) => {
    setQuizActive(true);
    runSession(outlet, pool, translationLang, quizType, dailyNorm, activeLevels, isActive);
  });
}

async function runSession(outlet, pool, translationLang, quizType, dailyNorm, activeLevels, isActive) {
  let answers = [];
  let sessionStart = Date.now();
  const wordIds = pool.map((w) => w.id);
  const progressById = new Map();
  try {
    const stored = await db.progress.bulkGet(wordIds);
    for (let i = 0; i < stored.length; i++) {
      if (stored[i]) progressById.set(wordIds[i], stored[i]);
    }
  } catch (e) {
    console.error("[learn] batch progress load", e);
  }

  const items = pool.map((word) => {
    const p = progressById.get(word.id) || null;
    const pts = p?.points || 0;
    return {
      word,
      progress: p,
      graduated: pts >= 20,
      seenInSession: false,
    };
  });
  shuffleInPlace(items);

  const draw = async () => {
    if (!isActive()) return;
    const idx = items.findIndex((it) => !it.seenInSession);
    if (idx === -1) {
      const minutes = Math.max(1, Math.round((Date.now() - sessionStart) / 60000));
      await addSessionBonus(SESSION_BONUS, minutes);
      setQuizActive(false);
      drawCompletion(outlet, answers, SESSION_BONUS, () => {
        if (!isActive()) return;
        setQuizActive(true);
        shuffleInPlace(items);
        for (const it of items) it.seenInSession = false;
        answers.length = 0;
        sessionStart = Date.now();
        draw();
      });
      return;
    }
    const item = items[idx];

    let card;
    try {
      card = await buildQuiz(quizType, item.word, translationLang, activeLevels);
    } catch (e) {
      console.error("[quiz build]", e);
      item.seenInSession = true;
      draw();
      return;
    }
    drawQuiz(outlet, item, idx, items.length, card, quizType, async (result) => {
      answers.push(result);
      if (result.progress) item.progress = result.progress;
      item.seenInSession = true;
      draw();
    }, isActive);
  };

  draw();
}

function drawGraduatedNotice(progress) {
  if (!progress || (progress.accumulatedToday || 0) < 20) return "";
  return `<div class="graduated-note">${escapeHtml(i18n.t("learn.alreadyDoneNotice"))}</div>`;
}

function drawQuiz(outlet, item, idx, total, card, quizType, onResult, isActive) {
  const { word } = item;
  const progress = item.progress || {};
  const accumulated = progress.accumulatedToday || 0;
  const points = progress.points || 0;

  outlet.innerHTML = `
    <div class="learn-page">
      <div class="quiz">
        <div class="quiz__progress">${i18n.t("quiz.progress", idx + 1, total)}</div>
        <progress-bar value="${idx + 1}" max="${total}"></progress-bar>
        <div class="word-progress" aria-live="polite">
          <div class="word-progress__row">
            <span class="word-progress__pts">${points}/100</span>
            <span class="word-progress__today">${i18n.t("learn.todayProgress", accumulated, 20)}</span>
          </div>
          <div class="word-progress__bar" aria-hidden="true">
            <div class="word-progress__bar-fill" style="width:${Math.min(100, (accumulated / 20) * 100)}%"></div>
          </div>
        </div>
        ${accumulated >= 20 ? drawGraduatedNotice(progress) : ""}
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

  const cardStartMs = Date.now();
  let speed = 0;
  let answering = false;
  quizEl.setOnAnswer(async ({ correct, skipped, studied }) => {
    if (answering || !isActive()) return;
    answering = true;
    try {
      if (skipped) {
        onResult({ wordId: word.id, correct: false, skipped: true, isNew: true, quizType });
        return;
      }
      let event, updatedProgress;
      try {
        ({ event, progress: updatedProgress } = await recordQuizResult(word.id, quizType, correct));
      } catch (e) {
        console.error("[learn] recordQuizResult", e);
        toastError(i18n.t("common.error"));
        /* Treat as silent skip — don't penalise the user for IDB failure; surface toast for retry */
        if (!isActive()) return;
        onResult({ wordId: word.id, correct, skipped: true, isNew: true, quizType });
        return;
      }
      invalidateDistractorCache();
      item.progress = updatedProgress;
      const xp = xpForQuizType(quizType, correct);
      const pts = correct ? pointsForQuizType(quizType) : 0;
      const stageUp = event === "stage-up" || event === "mastered";
      const elapsedSec = Math.max(1, Math.round((Date.now() - cardStartMs) / 1000));
      if (correct && !studied) speed = Math.round((60 / elapsedSec) * 10) / 10;
      if (event === "reset-to-new") {
        toast(i18n.t("quiz.resetToNew"), { kind: "warn", duration: 4000 });
      } else if (event === "reset-to-active") {
        toast(i18n.t("quiz.resetToActive"), { kind: "warn", duration: 4000 });
      }
      try {
        await recordReview({
          correct,
          isNew: stageUp,
          minutes: 0,
          xp,
          pointsEarned: pts,
          stageUp,
          neutral: !!studied,
          audio: quizType.startsWith("audio-"),
          speed,
        });
      } catch (e) {
        console.error("[learn] recordReview", e);
      }
      if (!studied) {
        if (correct) {
          playCorrect();
          vibrate(8);
        } else {
          playWrong();
          vibrate(100);
        }
      }
      try {
        const newAchievements = await checkAndUnlockAchievements();
        for (const a of newAchievements) {
          toastSuccess(`🏆 ${a.title}`);
        }
      } catch (e) {
        console.error("[learn] checkAndUnlockAchievements", e);
      }
      onResult({ wordId: word.id, correct, isNew: true, quizType, xp, event, studied: !!studied });
    } finally {
      answering = false;
    }
  });
}

function drawCompletion(outlet, answers, bonus, onRepeat) {
  const graded = answers.filter((a) => !a.studied);
  const correct = graded.filter((a) => a.correct && !a.skipped).length;
  const total = graded.length;
  const baseXp = answers.reduce((s, a) => s + (a.xp || 0), 0);
  const xp = baseXp + bonus;
  outlet.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon"><lew-icon name="trophy" size="48"></lew-icon></div>
      <div class="empty-state__title">${i18n.t("quiz.sessionComplete")}</div>
      <p class="text-muted">${i18n.t("quiz.accuracy", correct, total)}</p>
      <p class="text-muted">${i18n.t("quiz.xpEarned", xp)}</p>
      <p class="text-subtle">+${bonus} bonus</p>
      <button class="btn btn--block" id="btn-repeat" type="button">${i18n.t("learn.repeatSession")}</button>
      <a href="/" class="btn btn--block btn--secondary" data-link>${i18n.t("dashboard.title")}</a>
    </div>
  `;
  if (onRepeat) {
    outlet.querySelector("#btn-repeat").addEventListener("click", () => onRepeat());
  }
}
