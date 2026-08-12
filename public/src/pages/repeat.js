import db from "../services/db.js";
import * as settings from "../services/settings.js";
import * as i18n from "../services/i18n.js";
import * as router from "../router.js";
import {
  recordQuizResult,
  getDueSession,
  getDebtByLevel,
  CEFR_LEVELS,
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
import { shuffle } from "../services/random.js";
import { escapeHtml } from "../utils/html.js";
import { renderQuizSelector, bindQuizSelector } from "../quiz-selector.js";
import { setQuizActive } from "../quiz-state.js";
import "../components/quiz-choice.js";
import "../components/quiz-letters.js";
import "../components/quiz-input.js";
import "../components/quiz-cloze.js";
import "../components/progress-bar.js";
import "../components/icon.js";

const SESSION_BONUS = 25;

function debtBreakdownParts(byLevel) {
  return CEFR_LEVELS.filter((l) => byLevel[l] > 0)
    .map((l) => `${l}: ${byLevel[l]}`)
    .join(" · ");
}

export async function mount(outlet) {
  if (!(await isImported())) {
    router.replace("/onboarding");
    return () => {};
  }

  document.title = `LEW — ${i18n.t("repeat.title")}`;

  let active = true;
  const cleanup = () => {
    active = false;
    setQuizActive(false);
  };

  outlet.innerHTML = `<div class="repeat-page"><div class="empty-state" role="status" aria-live="polite"><div class="spinner" aria-label="${escapeHtml(i18n.t("common.loading"))}"></div></div></div>`;

  try {
    await ensureTodayStats();
    const activeLevels = settings.get("activeLevels");
    const translationLang = settings.get("translationLang");
    const sessionSize = settings.get("repeatSessionSize");

    const [session, debt] = await Promise.all([
      getDueSession(activeLevels, sessionSize),
      getDebtByLevel(activeLevels),
    ]);

    if (!active) return cleanup;

    if (!session.length) {
      outlet.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><lew-icon name="sparkle" size="48"></lew-icon></div>
          <div class="empty-state__title">${i18n.t("repeat.empty")}</div>
          <a href="/learn" class="btn" data-link>${i18n.t("nav.learn")}</a>
        </div>
      `;
      return cleanup;
    }

    showQuizSelector(outlet, session, translationLang, activeLevels, debt, () => active);
  } catch (e) {
    console.error("[repeat]", e);
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

function showQuizSelector(outlet, session, translationLang, activeLevels, debt, isActive) {
  const parts = debtBreakdownParts(debt.byLevel);
  outlet.innerHTML = `
    <div class="repeat-page">
      ${renderQuizSelector({ items: QUIZ_TYPES, poolSize: session.length, prefix: "repeat" })}
      <p class="text-subtle mt-3">
        ${escapeHtml(i18n.t("debt.total", { count: debt.total }))}${parts ? " · " + escapeHtml(parts) : ""}
      </p>
    </div>
  `;
  bindQuizSelector(outlet, (quizType) => {
    setQuizActive(true);
    runSession(outlet, session, translationLang, quizType, activeLevels, isActive);
  });
}

function runSession(outlet, initialSession, translationLang, quizType, activeLevels, isActive) {
  const answers = [];
  const sessionStart = Date.now();
  const seenInThisSession = new Set();
  const items = shuffle(
    initialSession
      .filter((s) => !seenInThisSession.has(s.progress.wordId) && seenInThisSession.add(s.progress.wordId))
      .map((s) => ({ ...s, removed: false }))
  );

  const nextBatch = async () => {
    if (!isActive()) return;
    const remaining = await getDueSession(activeLevels, settings.get("repeatSessionSize"));
    const fresh = remaining.filter((s) => !seenInThisSession.has(s.progress.wordId));
    if (!fresh.length) {
      const minutes = Math.max(1, Math.round((Date.now() - sessionStart) / 60000));
      await addSessionBonus(SESSION_BONUS, minutes);
      setQuizActive(false);
      drawCompletion(outlet, answers, SESSION_BONUS, false);
      return;
    }
    for (const f of fresh) {
      if (seenInThisSession.has(f.progress.wordId)) continue;
      seenInThisSession.add(f.progress.wordId);
      const inserted = { ...f, removed: false };
      const pos = Math.floor(Math.random() * (items.length + 1));
      items.splice(pos, 0, inserted);
    }
  };

  let currentIdx = 0;
  const draw = async () => {
    if (!isActive()) return;
    while (currentIdx < items.length && items[currentIdx].removed) currentIdx += 1;
    if (currentIdx >= items.length) {
      await nextBatch();
      if (!isActive()) return;
      while (currentIdx < items.length && items[currentIdx].removed) currentIdx += 1;
      if (currentIdx >= items.length) return;
    }
    const item = items[currentIdx];
    if (!item) return;
    let card;
    try {
      card = await buildQuiz(quizType, item.word, translationLang, activeLevels);
    } catch (e) {
      console.error("[repeat build]", e);
      item.removed = true;
      draw();
      return;
    }
    drawQuiz(outlet, item, currentIdx, items.length, card, quizType, async (result) => {
      answers.push(result);
      draw();
    }, isActive);
  };

  draw();
}

function drawQuiz(outlet, item, idx, total, card, quizType, onResult, isActive) {
  const { word, progress } = item;
  const accumulated = progress?.accumulatedToday || 0;
  const points = progress?.points || 0;
  const safeWord = escapeHtml(word.word);

  outlet.innerHTML = `
    <div class="repeat-page">
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

  let answering = false;
  const cardStartMs = Date.now();
  let speed = 0;
  quizEl.setOnAnswer(async ({ correct, skipped }) => {
    if (answering || !isActive()) return;
    answering = true;
    try {
      if (skipped) {
        onResult({ wordId: word.id, correct: false, skipped: true, quizType });
        return;
      }
      let event, updatedProgress;
      try {
        ({ event, progress: updatedProgress } = await recordQuizResult(word.id, quizType, correct));
      } catch (e) {
        console.error("[repeat] recordQuizResult", e);
        toastError(i18n.t("common.error"));
        /* Treat as silent skip — don't penalise the user for IDB failure */
        if (!isActive()) return;
        onResult({ wordId: word.id, correct, skipped: true, quizType });
        return;
      }
      invalidateDistractorCache();
      item.progress = updatedProgress;
      if (event === "stage-up" || event === "mastered" || event === "reset-to-new") {
        item.removed = true;
      }
      const xp = xpForQuizType(quizType, correct);
      const pts = correct ? pointsForQuizType(quizType) : 0;
      const stageUp = event === "stage-up" || event === "mastered";
      const elapsedSec = Math.max(1, Math.round((Date.now() - cardStartMs) / 1000));
      if (correct) speed = Math.round((60 / elapsedSec) * 10) / 10;
      if (event === "no-op-cap-reached") {
        toast(i18n.t("quiz.capReached"), { kind: "info", duration: 4000 });
      } else if (event === "reset-to-new") {
        toast(i18n.t("quiz.resetToNew"), { kind: "warn", duration: 4000 });
      } else if (event === "reset-to-active") {
        toast(i18n.t("quiz.resetToActive"), { kind: "warn", duration: 4000 });
      }
      try {
        await recordReview({
          correct,
          isNew: false,
          minutes: 0,
          xp,
          pointsEarned: pts,
          stageUp,
          audio: quizType.startsWith("audio-"),
          speed,
        });
      } catch (e) {
        console.error("[repeat] recordReview", e);
      }
      if (correct) {
        playCorrect();
        vibrate(8);
      } else {
        playWrong();
        vibrate(100);
      }
      try {
        const newAchievements = await checkAndUnlockAchievements();
        for (const a of newAchievements) {
          toastSuccess(`🏆 ${a.title}`);
        }
      } catch (e) {
        console.error("[repeat] checkAndUnlockAchievements", e);
      }
      onResult({ wordId: word.id, correct, quizType, xp, event });
    } finally {
      answering = false;
    }
  });
}

function drawCompletion(outlet, answers, bonus, hasMore = false) {
  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const baseXp = answers.reduce((s, a) => s + (a.xp || 0), 0);
  const xp = baseXp + bonus;
  outlet.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon"><lew-icon name="trophy" size="48"></lew-icon></div>
      <div class="empty-state__title">${i18n.t("quiz.sessionComplete")}</div>
      <p class="text-muted">${i18n.t("quiz.accuracy", correct, total)}</p>
      <p class="text-muted">${i18n.t("quiz.xpEarned", xp)}</p>
      <p class="text-subtle">+${bonus} bonus</p>
      ${hasMore ? `<a href="/repeat" class="btn btn--block" data-link>${i18n.t("repeat.nextBatch")}</a>` : ""}
      <a href="/" class="btn btn--block btn--secondary" data-link>${i18n.t("dashboard.title")}</a>
    </div>
  `;
}
