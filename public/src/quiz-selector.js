import * as i18n from "./services/i18n.js";
import { escapeHtml } from "./utils/html.js";
import { pointsForQuizType } from "./services/srs.js";

const DIFFICULTY_FROM_POINTS = (pts) => (pts <= 5 ? 1 : pts <= 10 ? 2 : 3);

export function renderQuizSelector({ items, poolSize, onSelect, prefix = "" }) {
  return `
    <h1 class="page__title">${escapeHtml(i18n.t(`${prefix}.title`))}</h1>
    <p class="text-muted">${escapeHtml(i18n.t(`${prefix}.chooseQuiz`, { count: poolSize }))}</p>
    <div class="quiz-selector" role="group" aria-label="${escapeHtml(i18n.t("quiz.chooseType"))}">
      ${items
        .map((type) => {
          const pts = pointsForQuizType(type);
          const dots = DIFFICULTY_FROM_POINTS(pts);
          const label = i18n.t(`quizType.${type}`);
          return `
            <button class="btn quiz-selector__btn" data-type="${type}" type="button"
              aria-label="${escapeHtml(label)}, ${escapeHtml(i18n.t("quiz.difficultyLevel", { dots }))}">
              <span class="quiz-selector__head">
                <span class="quiz-selector__title">${escapeHtml(label)}</span>
                <span class="quiz-selector__pts">+${pts}</span>
              </span>
              <span class="quiz-selector__difficulty" aria-hidden="true">
                ${Array(dots).fill('<span class="quiz-selector__dot"></span>').join("")}
                ${Array(3 - dots).fill('<span class="quiz-selector__dot quiz-selector__dot--off"></span>').join("")}
              </span>
            </button>
          `;
        })
        .join("")}
    </div>
    <p class="text-subtle text-center mt-3">${escapeHtml(i18n.t("quiz.difficultyHint"))}</p>
  `;
}

export function bindQuizSelector(host, onSelect) {
  host.querySelectorAll(".quiz-selector__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-type");
      host.querySelectorAll(".quiz-selector__btn").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("quiz-selector__btn--active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      onSelect(type);
    });
  });
}