import { playAudioUrl } from "../services/audio.js";
import * as i18n from "../services/i18n.js";
import { escapeHtml } from "../utils/html.js";
import { BaseQuizElement } from "./base-quiz-element.js";
import "./icon.js";

class QuizInput extends BaseQuizElement {
  static get observedAttributes() {
    return ["prompt", "target", "audio-url", "word-type"];
  }

  connectedCallback() {
    this._setup();
    this._render();
    this._bind();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

attributeChangedCallback(name) {
      if (this._answered) return;
      if (name === "audio-url" || name === "target" || name === "word-type") {
        this._setup();
      }
      this._render();
      this._bind();
    }

  _setup() {
    this._target = (this.getAttribute("target") || "").toLowerCase();
    this._audioUrl = this.getAttribute("audio-url") || "";
    this._wordType = this.getAttribute("word-type") || "";
  }

  _hasAudio() {
    return Boolean(this._audioUrl);
  }

  _render() {
    const prompt = this.getAttribute("prompt") || "";
    const hasAudio = this._hasAudio();
    const typeBadge = this._wordType
      ? `<div class="quiz__type-badge" aria-label="${escapeHtml(i18n.t("quiz.wordTypeLabel"))}: ${escapeHtml(this._wordType)}">${escapeHtml(this._wordType)}</div>`
      : "";
    const replayLabel = `${escapeHtml(i18n.t("quiz.replay"))} <span class="kbd-hint">${escapeHtml(i18n.t("quiz.replayHint"))}</span>`;
    const audioBlock = hasAudio
      ? `<div class="quiz__audio">
          <button class="btn btn--secondary quiz__audio-btn" type="button" data-action="replay" aria-label="${escapeHtml(i18n.t("quiz.replay"))}">
            <lew-icon name="audio" size="20"></lew-icon>
            <span>${replayLabel}</span>
          </button>
        </div>`
      : "";

    this.innerHTML = `
      <div class="quiz">
        <div class="quiz__prompt">
          ${audioBlock}
          <div class="quiz__prompt-sub text-muted">${escapeHtml(prompt)}</div>
          ${typeBadge}
        </div>
        <label class="quiz-input-label" for="quiz-input-field">
          <span class="visually-hidden">${escapeHtml(i18n.t("quiz.answerPlaceholder"))}</span>
          <input
            id="quiz-input-field"
            class="quiz-input__field"
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            placeholder="${escapeHtml(i18n.t("quiz.answerPlaceholder"))}"
          />
        </label>
        <div class="quiz__actions">
          <button class="btn btn--ghost" data-action="skip" type="button">${escapeHtml(i18n.t("quiz.skip"))} <span class="kbd-hint">${escapeHtml(i18n.t("quiz.skipHint"))}</span></button>
          <button class="btn" data-action="submit" type="button">${escapeHtml(i18n.t("quiz.submit"))} <span class="kbd-hint">${escapeHtml(i18n.t("quiz.submitHint"))}</span></button>
        </div>
        <div class="quiz__correct-answer" aria-live="polite"></div>
      </div>
    `;
  }

  _bind() {
    this._input = this.querySelector(".quiz-input__field");
    if (this._input) {
      this._input.focus();
      this._input.addEventListener("input", () => {
        this._input.classList.remove(
          "quiz-input__field--correct",
          "quiz-input__field--wrong"
        );
      });
      this._input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this._submit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          this._handleSkip();
        }
      });
    }
    this.querySelector('[data-action="skip"]')?.addEventListener("click", () => {
      this._handleSkip();
    });
    this.querySelector('[data-action="submit"]')?.addEventListener("click", () => {
      this._submit();
    });
    this.querySelector('[data-action="replay"]')?.addEventListener("click", () => {
      this._playAudio();
    });

    if (this._hasAudio()) {
      this._installKeyHandler((e) => {
        if (this._answered) return;
        if (e.key === "a" || e.key === "A" || e.key === "ф" || e.key === "Ф") {
          e.preventDefault();
          this._playAudio();
        }
      });
    }
  }

  _playAudio() {
    if (!this._audioUrl) return;
    playAudioUrl(this._audioUrl).catch(() => {});
  }

  _submit() {
    if (this._answered) return;
    const guess = (this._input.value || "").trim().toLowerCase();
    const correct = this._target.length > 0 && guess === this._target;
    this._answered = true;
    this._input.disabled = true;
    if (correct) {
      this._input.classList.add("quiz-input__field--correct");
    } else {
      this._input.classList.add("quiz-input__field--wrong");
    }
    this._announceResult(correct, this._target);
    this._fire({ correct }, false);
  }

  _handleSkip() {
    if (this._answered) return;
    this._answered = true;
    if (this._input) this._input.disabled = true;
    this._fire({ correct: false, skipped: true }, true);
  }
}

customElements.define("quiz-input", QuizInput);