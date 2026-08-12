import * as i18n from "../services/i18n.js";
import { escapeHtml } from "../utils/html.js";
import { BaseQuizElement } from "./base-quiz-element.js";

class QuizCloze extends BaseQuizElement {
  constructor() {
    super();
    this._target = "";
    this._options = [];
    this._correctIndex = -1;
  }

  static get observedAttributes() {
    return ["sentence", "translation", "options", "correct-index", "word-type"];
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    if (this._answered) return;
    this._render();
  }

  _render() {
    const sentence = this.getAttribute("sentence") || "";
    const translation = this.getAttribute("translation") || "";
    const wordType = this.getAttribute("word-type") || "";
    let options;
    try {
      options = JSON.parse(this.getAttribute("options") || "[]");
    } catch (e) {
      options = [];
    }
    const correctIndex = Number(this.getAttribute("correct-index") || 0);

    this._target = (options[correctIndex] || "").toString();
    this._options = options;
    this._correctIndex = correctIndex;

    const masked = escapeHtml(sentence).replace(/___+/g, "<u>____</u>");
    const typeBadge = wordType
      ? `<div class="quiz__type-badge" aria-label="${escapeHtml(i18n.t("quiz.wordTypeLabel"))}: ${escapeHtml(wordType)}">${escapeHtml(wordType)}</div>`
      : "";
    const optionsHtml = options.length
      ? `<div class="quiz__options" role="radiogroup">${options
          .map(
            (opt, i) => `
        <button class="quiz__option" type="button" data-index="${i}" role="radio" aria-checked="false">
          <span class="quiz__option-suffix" aria-hidden="true">${i + 1}</span><span class="quiz__option-text">${escapeHtml(opt)}</span>
        </button>
      `
          )
          .join("")}</div>`
      : `<label class="quiz-input-label" for="cloze-input"><span class="visually-hidden">${escapeHtml(i18n.t("quiz.answerPlaceholder"))}</span><input class="quiz-input__field" type="text" id="cloze-input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${escapeHtml(i18n.t("quiz.answerPlaceholder"))}" /></label>`;

    const skipBtnHtml = `<button class="btn btn--ghost" data-action="skip" type="button">${escapeHtml(i18n.t("quiz.skip"))} <span class="kbd-hint">${escapeHtml(i18n.t("quiz.skipHint"))}</span></button>`;
    const submitBtnHtml = !options.length
      ? `<button class="btn" data-action="submit" type="button">${escapeHtml(i18n.t("quiz.submit"))} <span class="kbd-hint">${escapeHtml(i18n.t("quiz.submitHint"))}</span></button>`
      : "";

    this.innerHTML = `
      <div class="quiz">
        <div class="cloze">
          <div>${masked}</div>
          <div class="cloze__translation">${escapeHtml(translation)}</div>
          ${typeBadge}
        </div>
        ${optionsHtml}
        <div class="quiz__actions">
          ${skipBtnHtml}
          ${submitBtnHtml}
        </div>
        <div class="quiz__correct-answer" aria-live="polite"></div>
      </div>
    `;

    this.querySelectorAll(".quiz__option").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this._answered) return;
        const i = Number(btn.getAttribute("data-index"));
        this._finish(i === this._correctIndex, i, false);
      });
    });
    this.querySelector('[data-action="skip"]')?.addEventListener("click", () => {
      this._finish(false, -1, true);
    });

    const input = this.querySelector("#cloze-input");
    const submitBtn = this.querySelector('[data-action="submit"]');
    if (input && submitBtn) {
      input.focus();
      submitBtn.addEventListener("click", () => {
        if (this._answered) return;
        const guess = (input.value || "").trim().toLowerCase();
        input.disabled = true;
        const target = this._target.toLowerCase();
        const correct = target.length > 0 && guess === target;
        this._finish(correct, -1, false, guess);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitBtn.click();
        } else if (e.key === "Escape") {
          e.preventDefault();
          this._finish(false, -1, true);
        }
      });
    }

    if (options.length) {
      this._installKeyHandler((e) => {
        if (this._answered) return;
        const tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        if (e.key >= "1" && e.key <= "9") {
          const idx = Number(e.key) - 1;
          if (idx < options.length) {
            e.preventDefault();
            this._finish(idx === this._correctIndex, idx, false);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          this._finish(false, -1, true);
        }
      });
    }
  }

  _finish(correct, idx, skipped = false, guess = "") {
    if (this._answered) return;
    this._answered = true;
    this._cleanupKeys();
    this.querySelectorAll(".quiz__option").forEach((btn, i) => {
      btn.disabled = true;
      btn.setAttribute("aria-checked", i === idx ? "true" : "false");
      if (i === this._correctIndex) btn.classList.add("quiz__option--correct");
      if (i === idx && !correct && idx >= 0) btn.classList.add("quiz__option--wrong");
    });
    if (!skipped) {
      this._announceResult(correct, this._target);
    }
    this._fire({ correct, skipped, guess }, skipped);
  }
}

customElements.define("quiz-cloze", QuizCloze);