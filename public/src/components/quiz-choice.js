import { playAudioUrl } from "../services/audio.js";
import * as i18n from "../services/i18n.js";
import { escapeHtml } from "../utils/html.js";
import { BaseQuizElement } from "./base-quiz-element.js";
import "./icon.js";

class QuizChoice extends BaseQuizElement {
  static get observedAttributes() {
    return ["prompt", "options", "correct-index", "audio-url", "word-type"];
  }

  constructor() {
    super();
    this._options = [];
    this._correctIndex = -1;
    this._selected = -1;
  }

  connectedCallback() {
    this._setup();
    this._render();
    this._bind();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  attributeChangedCallback() {
    if (this._answered) return;
    this._setup();
    this._render();
    this._bind();
  }

  _setup() {
    const optionsAttr = this.getAttribute("options") || "[]";
    let parsedOptions;
    try {
      parsedOptions = JSON.parse(optionsAttr);
    } catch (e) {
      parsedOptions = [];
    }
    this._options = parsedOptions;
    this._correctIndex = Number(this.getAttribute("correct-index") || 0);
    this._audioUrl = this.getAttribute("audio-url") || "";
    this._wordType = this.getAttribute("word-type") || "";
  }

  _render() {
    const prompt = this.getAttribute("prompt") || "";
    const hasAudio = Boolean(this._audioUrl);
    const typeBadge = this._wordType
      ? `<div class="quiz__type-badge" aria-label="${escapeHtml(i18n.t("quiz.wordTypeLabel"))}: ${escapeHtml(this._wordType)}">${escapeHtml(this._wordType)}</div>`
      : "";

    const optionsHtml = this._options
      .map(
        (opt, i) => `
        <button class="quiz__option" type="button" data-index="${i}" role="radio" aria-checked="false">
          <span class="quiz__option-suffix" aria-hidden="true">${i + 1}</span><span class="quiz__option-text">${escapeHtml(opt)}</span>
        </button>
      `
      )
      .join("");

    const skipHint = `<span class="kbd-hint">${escapeHtml(i18n.t("quiz.skipHint"))}</span>`;
    const replayLabel = `${escapeHtml(i18n.t("quiz.replay"))} <span class="kbd-hint">${escapeHtml(i18n.t("quiz.replayHint"))}</span>`;

    this.innerHTML = `
      <div class="quiz">
        <div class="quiz__prompt">
          <div class="quiz__prompt-headword">${escapeHtml(prompt)}</div>
          ${typeBadge}
          ${
            hasAudio
              ? `<div class="quiz__audio">
                  <button class="btn btn--secondary quiz__audio-btn" type="button" data-action="replay" aria-label="${escapeHtml(i18n.t("quiz.replay"))}">
                    <lew-icon name="audio" size="20"></lew-icon>
                    <span>${replayLabel}</span>
                  </button>
                </div>`
              : ""
          }
        </div>
        <div class="quiz__options" role="radiogroup">${optionsHtml}</div>
        <div class="quiz__actions">
          <button class="btn btn--ghost" data-action="skip" type="button">${escapeHtml(i18n.t("quiz.skip"))} ${skipHint}</button>
          <span class="quiz__correct-answer" aria-live="polite"></span>
        </div>
      </div>
    `;
  }

  _bind() {
    const opts = this.querySelectorAll(".quiz__option");
    opts.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this._answered) return;
        const idx = Number(btn.getAttribute("data-index"));
        this._answer(idx);
      });
    });

    const skipBtn = this.querySelector('[data-action="skip"]');
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        if (this._answered) return;
        this._answer(-1, true);
      });
    }

    const replayBtn = this.querySelector('[data-action="replay"]');
    if (replayBtn) {
      replayBtn.addEventListener("click", () => this._playAudio());
    }

    this._installKeyHandler((e) => {
      if (this._answered) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        if (idx < this._options.length) {
          e.preventDefault();
          this._answer(idx);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this._answer(-1, true);
        return;
      }
      if ((e.key === "a" || e.key === "A" || e.key === "ф" || e.key === "Ф") && this._audioUrl) {
        e.preventDefault();
        this._playAudio();
        return;
      }
    });
  }

  _playAudio() {
    if (!this._audioUrl) return;
    playAudioUrl(this._audioUrl).catch(() => {});
  }

  _answer(idx, skipped = false) {
    if (this._answered) return;
    this._answered = true;
    this._selected = idx;
    const correct = idx === this._correctIndex;

    const opts = this.querySelectorAll(".quiz__option");
    opts.forEach((btn, i) => {
      btn.disabled = true;
      btn.setAttribute("aria-checked", i === idx ? "true" : "false");
      if (i === this._correctIndex) btn.classList.add("quiz__option--correct");
      if (i === idx && !correct && idx >= 0) btn.classList.add("quiz__option--wrong");
    });

    this._announceResult(correct, this._options[this._correctIndex] || "");
    this._fire({ correct, index: idx }, skipped);
  }
}

customElements.define("quiz-choice", QuizChoice);