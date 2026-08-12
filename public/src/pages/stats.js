import * as i18n from "../services/i18n.js";
import * as router from "../router.js";
import { isImported } from "../services/import.js";
import { computeStats, getAllAchievements } from "../services/achievements.js";
import { getStreak } from "../services/streak.js";
import { getLast7DaysStats } from "../services/stats.js";
import { todayKey } from "../services/date.js";
import { escapeHtml } from "../utils/html.js";
import { openInfoDialog } from "../components/dialog.js";
import "../components/stat-tile.js";
import "../components/level-meter.js";

export async function mount(outlet) {
  if (!(await isImported())) {
    router.replace("/onboarding");
    return () => {};
  }

  document.title = `LEW — ${i18n.t("stats.title")}`;

  outlet.innerHTML = `<div class="stats-page"><div class="empty-state" role="status" aria-live="polite"><div class="spinner" aria-label="${escapeHtml(i18n.t("common.loading"))}"></div></div></div>`;

  try {
    const stats = await computeStats();
    const weekStats = await getLast7DaysStats();
    const streak = await getStreak();
    const achievements = await getAllAchievements();

    outlet.innerHTML = `
      <div class="stats-page">
        <h1 class="page__title">${escapeHtml(i18n.t("stats.title"))}</h1>

        <section class="section">
          <div class="dashboard__stats">
            <stat-tile
              value="${stats.totalMastered}"
              label="${escapeHtml(i18n.t("stats.totalMastered"))}"
              info="${escapeHtml(i18n.t("stats.totalMasteredInfo"))}"
            ></stat-tile>
            <stat-tile
              value="${stats.totalReviews}"
              label="${escapeHtml(i18n.t("stats.totalReviews"))}"
              info="${escapeHtml(i18n.t("stats.totalReviewsInfo"))}"
            ></stat-tile>
            <stat-tile
              value="${stats.totalXP}"
              label="${escapeHtml(i18n.t("stats.totalXP"))}"
              info="${escapeHtml(i18n.t("stats.totalXPInfo"))}"
            ></stat-tile>
            <stat-tile
              value="${Math.round(stats.totalMinutes)}"
              label="${escapeHtml(i18n.t("stats.timeSpent"))}"
              info="${escapeHtml(i18n.t("stats.timeSpentInfo"))}"
            ></stat-tile>
          </div>
        </section>

        <section class="section card">
          <h2 class="section__title">${escapeHtml(i18n.t("stats.accuracyTitle"))}</h2>
          <div class="week-chart-legend" id="week-chart-legend"></div>
          <div id="week-chart"></div>
        </section>

        <section class="section">
          <div class="dashboard__levels">
            ${Object.entries(stats.byLevel)
              .map(
                ([lvl, count]) =>
                  `<level-meter level="${lvl}" mastered="${count}" active="${Math.max(0, (stats.activeByLevel?.[lvl] ?? 0))}" total="${stats.levelTotals[lvl]}"></level-meter>`
              )
              .join("")}
          </div>
        </section>

        <section class="section card">
          <h2 class="section__title">${escapeHtml(i18n.t("stats.achievementsTitle"))} (${achievements.filter((a) => a.unlocked).length}/${achievements.length})</h2>
          <div class="achievements-grid">${renderAchievements(achievements)}</div>
        </section>
      </div>
    `;

    renderWeekChartLegend(outlet.querySelector("#week-chart-legend"), weekStats);
    renderWeekChart(outlet.querySelector("#week-chart"), weekStats);
    bindAchievements(outlet, achievements);
  } catch (e) {
    console.error("[stats]", e);
    outlet.innerHTML = `<div class="empty-state">${escapeHtml(i18n.t("common.error"))}</div>`;
  }

  return () => {};
}

function renderAchievements(list) {
  return list
    .map(
      (a, i) => `
      <button class="ach ${a.unlocked ? "ach--unlocked" : "ach--locked"}" data-ach="${i}" type="button" aria-label="${escapeHtml(a.title)}">
        <div class="ach__icon" aria-hidden="true">${a.unlocked ? a.icon : "🔒"}</div>
        <div class="ach__title">${escapeHtml(a.title)}</div>
        ${a.unlocked && a.unlockedAt ? `<div class="ach__date text-subtle">${escapeHtml(new Date(a.unlockedAt).toLocaleDateString(i18n.getLang()))}</div>` : ""}
      </button>
    `
    )
    .join("");
}

function bindAchievements(host, list) {
  host.querySelectorAll("[data-ach]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-ach"));
      const a = list[idx];
      if (!a) return;
      const status = a.unlocked
        ? `<p class="ach-detail__status ach-detail__status--ok">✓ ${escapeHtml(i18n.t("stats.achievementUnlocked"))}</p>`
        : `<p class="ach-detail__status ach-detail__status--locked">${escapeHtml(i18n.t("stats.achievementLocked"))}</p>`;
      const date = a.unlockedAt
        ? `<p class="ach-detail__date text-muted">${escapeHtml(new Date(a.unlockedAt).toLocaleDateString(i18n.getLang()))}</p>`
        : "";
      const html = `
        <div class="ach-detail">
          <div class="ach-detail__icon" aria-hidden="true">${a.unlocked ? a.icon : "🔒"}</div>
          <p class="ach-detail__desc">${escapeHtml(a.description || a.title)}</p>
          ${status}
          ${date}
        </div>
      `;
      openInfoDialog({ title: a.title, html });
    });
  });
}

function renderWeekChart(host, week) {
  const dayLabelsByLang = {
    ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    ua: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
    en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  };
  const labels = dayLabelsByLang[i18n.getLang()] || dayLabelsByLang.ru;
  const max = Math.max(1, ...week.map((d) => (d?.correct || 0) + (d?.wrong || 0)));
  host.innerHTML = `
    <div class="week-chart">
      ${week
        .map((d) => {
          const correct = d?.correct || 0;
          const wrong = d?.wrong || 0;
          const total = correct + wrong;
          const correctH = total === 0 ? 4 : Math.max(6, (correct / max) * 100);
          const wrongH = total === 0 ? 0 : Math.max(6, (wrong / max) * 100);
          const dayIndex = d?.date ? new Date(d.date + "T00:00:00").getDay() : null;
          const label = dayIndex == null ? "" : labels[(dayIndex + 6) % 7];
          if (total === 0) {
            return `
              <div class="day-col">
                <div class="day-bars">
                  <div class="day-bar day-bar--empty"></div>
                </div>
                <div class="day-label">${escapeHtml(label)}</div>
                <div class="day-total">0</div>
              </div>
            `;
          }
          return `
            <div class="day-col">
              <div class="day-bars">
                <div class="day-bar day-bar--correct" style="height:${correctH}%" title="${correct} ✓"></div>
                <div class="day-bar day-bar--wrong" style="height:${wrongH}%" title="${wrong} ✗"></div>
              </div>
              <div class="day-label">${escapeHtml(label)}</div>
              <div class="day-total" title="${correct} ✓ + ${wrong} ✗">${total}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderWeekChartLegend(host, week) {
  const totals = week.reduce(
    (acc, d) => {
      acc.correct += d?.correct || 0;
      acc.wrong += d?.wrong || 0;
      return acc;
    },
    { correct: 0, wrong: 0 }
  );
  const total = totals.correct + totals.wrong;
  host.innerHTML = `
    <span class="week-chart-legend__item">
      <span class="week-chart-legend__swatch week-chart-legend__swatch--correct" aria-hidden="true"></span>
      ${escapeHtml(i18n.t("stats.legendCorrect"))}
    </span>
    <span class="week-chart-legend__item">
      <span class="week-chart-legend__swatch week-chart-legend__swatch--wrong" aria-hidden="true"></span>
      ${escapeHtml(i18n.t("stats.legendWrong"))}
    </span>
    <span class="week-chart-legend__total">${total} ${escapeHtml(i18n.t("stats.legendTotal"))}</span>
  `;
}