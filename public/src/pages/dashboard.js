import db, { getAllProgress, getAllWords } from "../services/db.js";
import * as settings from "../services/settings.js";
import * as i18n from "../services/i18n.js";
import * as router from "../router.js";
import { isImported } from "../services/import.js";
import { ensureTodayStats } from "../services/stats.js";
import { getStreak, getRecentAchievements } from "../services/streak.js";
import { formatDate } from "../services/date.js";
import { getDebtByLevel, CEFR_LEVELS, getCurrentLevel } from "../services/srs.js";
import { toastError } from "../components/toast.js";
import "../components/streak-badge.js";
import "../components/progress-bar.js";
import "../components/stat-tile.js";
import "../components/level-meter.js";
import "../components/icon.js";

const LEVEL_TOTALS = { A1: 1076, A2: 992, B1: 903, B2: 1573, C1: 1404 };
const DEBT_LIGHT = 10;
const DEBT_MODERATE = 30;
const DEBT_HEAVY = 80;

function debtSeverity(total) {
  if (total <= 0) return "none";
  if (total < DEBT_LIGHT) return "light";
  if (total < DEBT_MODERATE) return "moderate";
  if (total < DEBT_HEAVY) return "heavy";
  return "heavy";
}

function debtBreakdownParts(byLevel) {
  return CEFR_LEVELS
    .filter((l) => byLevel[l] > 0)
    .map((l) => `${l}: ${byLevel[l]}`)
    .join(" · ");
}

export async function mount(outlet) {
  const imported = await isImported();
  if (!imported) {
    router.replace("/onboarding");
    return () => {};
  }

  document.title = `LEW — ${i18n.t("dashboard.title")}`;
  let active = true;
  const cleanup = () => { active = false; };

  const activeLevels = settings.get("activeLevels");

  outlet.innerHTML = `
    <div class="dashboard" aria-busy="true">
      <h1 class="page__title">${i18n.t("dashboard.title")}</h1>
      <div class="dashboard__hero">
        <div class="streak-badge skeleton-box" aria-label="${i18n.t("common.loading")}"></div>
      </div>
      <section class="section">
        <div class="skeleton-box skeleton-box--tall"></div>
      </section>
      <section class="section">
        <h2 class="section__title">${i18n.t("dashboard.progressTitle")}</h2>
        <div class="dashboard__levels">
          ${["A1", "A2", "B1", "B2", "C1"]
            .map(
              () =>
                `<div class="level-meter-skeleton skeleton-box" aria-hidden="true"></div>`
            )
            .join("")}
        </div>
      </section>
      <section class="section">
        <div class="dashboard__stats">
          ${Array(4)
            .fill(0)
            .map(
              () =>
                `<div class="stat-tile skeleton-box" aria-hidden="true"></div>`
            )
            .join("")}
        </div>
      </section>
    </div>
  `;

  try {
    await ensureTodayStats();
    const [streakRes, statsRes, recentRes, debtRes] = await Promise.allSettled([
      getStreak(),
      computeDashboardStats(),
      getRecentAchievements(3),
      getDebtByLevel(activeLevels),
    ]);
    const streak = streakRes.status === "fulfilled" ? streakRes.value : 0;
    const stats =
      statsRes.status === "fulfilled"
        ? statsRes.value
        : {
            byLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 },
            activeByLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 },
            totalMastered: 0,
            dueToday: 0,
            learnedToday: 0,
            reviewedToday: 0,
          };
    const recent =
      recentRes.status === "fulfilled" ? recentRes.value : [];
    const debt =
      debtRes.status === "fulfilled"
        ? debtRes.value
        : { total: 0, byLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 } };
    const severity = debtSeverity(debt.total);
    const breakdown = debtBreakdownParts(debt.byLevel);
    if (streakRes.status === "rejected") {
      console.warn("[dashboard] streak failed", streakRes.reason);
    }

    if (!active) return cleanup;

    const currentLevel = getCurrentLevel(activeLevels, stats.byLevel);
    outlet.innerHTML = `
      <div class="dashboard">
        <h1 class="page__title">${i18n.t("dashboard.title")}</h1>
        <div class="dashboard__hero">
          <div class="dashboard__hero-head">
            <streak-badge count="${escapeAttr(String(streak))}"></streak-badge>
            <span class="dashboard__hero-greeting">${escapeHtml(greetingFor(streak))}</span>
          </div>
          ${currentLevel ? `
            <div class="dashboard__hero-level">
              <span class="dashboard__hero-level-label">${escapeHtml(i18n.t("dashboard.currentLevel"))}</span>
              <span class="dashboard__hero-level-value">${escapeHtml(currentLevel)}</span>
            </div>
          ` : ""}
          <button class="btn btn--large btn--block" id="cta-learn" type="button">
            ${escapeHtml(i18n.t("dashboard.startSession"))}
          </button>
        </div>

        <section class="section debt-card debt-card--${severity}" aria-live="polite">
          <div class="debt-card__head">
            <span class="debt-card__label">${escapeHtml(i18n.t(`debt.${severity}`))}</span>
            <span class="debt-card__count">${escapeHtml(i18n.t("debt.total", { count: debt.total }))}</span>
          </div>
          ${
            breakdown
              ? `<div class="debt-card__breakdown text-subtle">${escapeHtml(breakdown)}</div>`
              : ""
          }
          ${
            debt.total > 0
              ? `<button class="btn btn--block debt-card__cta" id="cta-repeat" type="button">
                  ${escapeHtml(i18n.t("nav.repeat"))}
                </button>`
              : ""
          }
        </section>

        <section class="section">
          <button class="dashboard__levels-toggle" id="levels-toggle" type="button" aria-expanded="false" aria-controls="levels-panel">
            <h2 class="section__title">${escapeHtml(i18n.t("dashboard.progressTitle"))}</h2>
            <span class="dashboard__levels-summary text-subtle">${escapeHtml(dashboardLevelsSummary(stats))}</span>
            <lew-icon name="arrowRight" size="18"></lew-icon>
          </button>
          <div class="dashboard__levels" id="levels-panel" hidden>
            ${CEFR_LEVELS.map(
              (lvl) =>
                `<level-meter level="${escapeAttr(lvl)}" mastered="${stats.byLevel[lvl]}" active="${stats.activeByLevel[lvl]}" total="${LEVEL_TOTALS[lvl]}"></level-meter>`
            ).join("")}
          </div>
        </section>

        <section class="section">
          <div class="dashboard__stats">
            <stat-tile value="${stats.totalMastered}" label="${escapeAttr(i18n.t("dashboard.totalMastered"))}"></stat-tile>
            <stat-tile value="${debt.total}" label="${escapeAttr(i18n.t("dashboard.dueToday"))}"></stat-tile>
            <stat-tile value="${stats.learnedToday}" label="${escapeAttr(i18n.t("dashboard.newToday"))}"></stat-tile>
            <stat-tile value="${streak}" label="${escapeAttr(i18n.t("dashboard.streakLabel"))}"></stat-tile>
          </div>
        </section>
        ${
          recent && recent.length
            ? `<section class="section">
                <h2 class="section__title">${escapeHtml(i18n.t("dashboard.achievementsTitle"))}</h2>
                <div class="dashboard__achievements">
                  ${recent
                    .map(
                      (a) => `
                      <div class="ach-card" title="${escapeAttr(a.title)}">
                        <div class="ach-card__icon" aria-hidden="true">${a.icon}</div>
                        <div class="ach-card__title">${escapeHtml(a.title)}</div>
                      </div>
                    `
                    )
                    .join("")}
                </div>
              </section>`
            : ""
        }
      </div>
    `;

    const ctaRepeat = outlet.querySelector("#cta-repeat");
    if (ctaRepeat) {
      ctaRepeat.addEventListener("click", () => router.go("/repeat"));
    }
    const ctaLearn = outlet.querySelector("#cta-learn");
    if (ctaLearn) {
      ctaLearn.addEventListener("click", () => router.go("/learn"));
    }
    const levelsToggle = outlet.querySelector("#levels-toggle");
    const levelsPanel = outlet.querySelector("#levels-panel");
    if (levelsToggle && levelsPanel) {
      levelsToggle.addEventListener("click", () => {
        const expanded = levelsToggle.getAttribute("aria-expanded") === "true";
        const next = !expanded;
        levelsToggle.setAttribute("aria-expanded", String(next));
        levelsPanel.hidden = !next;
        levelsToggle.classList.toggle("dashboard__levels-toggle--open", next);
      });
    }
  } catch (e) {
    console.error("[dashboard]", e);
    if (!active) return cleanup;
    toastError(i18n.t("common.error"));
  }

  return cleanup;
}

async function computeDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayStats, allProgress, allWords] = await Promise.all([
    db.stats.get(formatDate(today)),
    getAllProgress(),
    getAllWords(),
  ]);

  const wordById = new Map(allWords.map((w) => [w.id, w]));
  const byLevel = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  const activeByLevel = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  let masteredCount = 0;
  for (const p of allProgress) {
    const w = wordById.get(p.wordId);
    if (!w) continue;
    const pts = p.points || 0;
    if (byLevel[w.level] !== undefined) {
      if (pts >= 100) {
        byLevel[w.level] += 1;
        masteredCount += 1;
      } else if (pts > 0) {
        activeByLevel[w.level] += 1;
      }
    }
  }

  return {
    byLevel,
    activeByLevel,
    totalMastered: masteredCount,
    learnedToday: todayStats?.learned || 0,
    reviewedToday: todayStats?.reviewed || 0,
  };
}

function dashboardLevelsSummary(stats) {
  const totalMastered = stats.totalMastered || 0;
  const totalActive = Object.values(stats.activeByLevel || {}).reduce((s, n) => s + n, 0);
  return `${totalMastered} ${i18n.t("dashboard.totalMastered")} · ${totalActive} ${i18n.t("dashboard.activeLabel")}`;
}

function greetingFor(streak) {
  if (!streak) return "";
  const lang = i18n.getLang();
  const map = {
    ru: { 1: "Отличное начало 🔥", 3: "Хороший темп", 7: "Целая неделя!", 30: "Легенда 💪" },
    ua: { 1: "Чудовий старт 🔥", 3: "Хороший темп", 7: "Цілий тиждень!", 30: "Легенда 💪" },
    en: { 1: "Great start 🔥", 3: "Nice pace", 7: "A full week!", 30: "Legend 💪" },
  };
  const dict = map[lang] || map.ru;
  const keys = Object.keys(dict).map(Number).sort((a, b) => a - b);
  let label = "";
  for (const k of keys) {
    if (streak >= k) label = dict[k];
  }
  return label;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}
