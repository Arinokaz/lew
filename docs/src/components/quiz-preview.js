import * as i18n from "../services/i18n.js";
import { escapeHtml, escapeAttr } from "../utils/html.js";
import { BaseQuizElement } from "./base-quiz-element.js";
import "./audio-player.js";
import "./icon.js";

class QuizPreview extends BaseQuizElement {
  static get observedAttributes() {
    return ["word-data", "lang"];
  }

  connectedCallback() {
    this._setup();
    this._render();
    this._bind();
  }

  attributeChangedCallback() {
    if (this._answered) return;
    this._setup();
    this._render();
    this._bind();
  }

  _setup() {
    const raw = this.getAttribute("word-data") || "";
    try {
      this._word = JSON.parse(raw);
    } catch (e) {
      this._word = null;
    }
    this._lang = this.getAttribute("lang") || "ru";
  }

  _render() {
    if (!this._word) {
      this.innerHTML = `<div class="quiz__correct-answer" role="status">${escapeHtml(i18n.t("wordCard.invalidData"))}</div>`;
      return;
    }
    const word = this._word;
    const lang = this._lang;
    const translation = word.translations?.[lang] || word.translations?.ru || "";
    const example = word.examples?.[0];
    const exampleTranslation = example?.[lang] || example?.ru || "";

    this.innerHTML = `
      <div class="quiz">
        <div class="quiz-preview">
          <div class="quiz-preview__head">
            <div class="quiz-preview__headword">${escapeHtml(word.word)}</div>
            <div class="quiz-preview__meta">
              ${word.type ? `<span class="quiz-preview__type">${escapeHtml(word.type)}</span>` : ""}
              ${word.level ? `<span class="quiz-preview__level">${escapeHtml(word.level)}</span>` : ""}
              <span class="quiz-preview__phonetic">${escapeHtml(word.phonetics?.us || "")}</span>
            </div>
          </div>
          <div class="quiz-preview__audio">
            <audio-player
              data-us="${escapeAttr(word.audio?.us_mp3 || "")}"
              data-uk="${escapeAttr(word.audio?.uk_mp3 || "")}"
            ></audio-player>
          </div>
          <div class="quiz-preview__translation">${escapeHtml(translation)}</div>
          ${
            example
              ? `<div class="quiz-preview__example">
                  <div class="quiz-preview__example-en">${escapeHtml(example.en || "")}</div>
                  <div class="quiz-preview__example-tr">${escapeHtml(exampleTranslation)}</div>
                </div>`
              : ""
          }
          <div class="quiz-preview__actions">
            <button class="btn" data-action="next" type="button">${escapeHtml(i18n.t("quiz.gotIt"))}</button>
          </div>
        </div>
      </div>
    `;
  }

  _bind() {
    const nextBtn = this.querySelector('[data-action="next"]');
    if (nextBtn) {
      nextBtn.addEventListener("click", () => this._advance());
    }
    this._installKeyHandler((e) => {
      if (this._answered) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this._advance();
        return;
      }
      if (e.key === "a" || e.key === "A" || e.key === "ф" || e.key === "Ф") {
        e.preventDefault();
        this._replay();
        return;
      }
    });
  }

  _replay() {
    const player = this.querySelector("audio-player");
    if (player && typeof player.play === "function") player.play();
  }

  _advance() {
    if (this._answered) return;
    this._answered = true;
    this._disableInputs();
    this._fire({ correct: true, studied: true });
  }

  _disableInputs() {
    const nextBtn = this.querySelector('[data-action="next"]');
    if (nextBtn) nextBtn.disabled = true;
  }
}

customElements.define("quiz-preview", QuizPreview);
