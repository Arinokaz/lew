import * as i18n from "../services/i18n.js";
import { escapeHtml, escapeAttr } from "../utils/html.js";

class WordCard extends HTMLElement {
  static get observedAttributes() {
    return ["word-data", "show-translation", "expanded", "data-points"];
  }

  connectedCallback() {
    this._render();
    this.addEventListener("click", this._onToggle);
    this.addEventListener("keydown", this._onKey);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._onToggle);
    this.removeEventListener("keydown", this._onKey);
  }

  _onToggle = (e) => {
    if (e.target.closest("button, input, select, textarea, audio-player, a")) return;
    this._toggleExpanded();
  };

  _onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      if (e.target === this) {
        e.preventDefault();
        this._toggleExpanded();
      }
    }
  };

  _toggleExpanded() {
    const next = !this.hasAttribute("expanded");
    if (next) this.setAttribute("expanded", "");
    else this.removeAttribute("expanded");
    this.setAttribute("aria-expanded", String(next));
  }

  attributeChangedCallback(name) {
    if (name === "word-data" || name === "show-translation" || name === "data-points") {
      this._render();
    } else if (name === "expanded") {
      this._render();
    }
  }

  _render() {
    const wordDataAttr = this.getAttribute("word-data");
    if (!wordDataAttr) {
      this.innerHTML = "";
      return;
    }
    let word;
    try {
      word = JSON.parse(wordDataAttr);
    } catch (e) {
      this.innerHTML = `<div class="empty-state">${i18n.t("wordCard.invalidData")}</div>`;
      return;
    }
    const showTranslation = this.hasAttribute("show-translation");
    const isExpanded = this.hasAttribute("expanded");
    const lang = this.getAttribute("lang") || "ru";
    const translation = word.translations?.[lang] || "";
    const example = word.examples?.[0];
    const exampleTranslation = example?.[lang] || "";
    const points = Number(this.getAttribute("data-points") || 0);

    this.setAttribute("role", "article");
    this.setAttribute("tabindex", "0");
    this.setAttribute("aria-expanded", String(isExpanded));

    this.innerHTML = `
      <div class="word-card">
        <div class="word-card__top">
          <div class="word-card__head-block">
            <div class="word-card__headword">${escapeHtml(word.word)}</div>
            <div class="word-card__meta">
              ${word.type ? `<span class="word-card__type">${escapeHtml(word.type)}</span>` : ""}
              ${word.level ? `<span class="word-card__level">${escapeHtml(word.level)}</span>` : ""}
              <span class="word-card__phonetic">${escapeHtml(word.phonetics?.us || "")}</span>
            </div>
          </div>
          <div class="word-card__actions">
            <audio-player
              data-us="${escapeAttr(word.audio?.us_mp3 || "")}"
              data-uk="${escapeAttr(word.audio?.uk_mp3 || "")}"
            ></audio-player>
            <button class="word-card__expand" type="button" aria-label="${i18n.t("wordCard.toggleDetails")}" aria-expanded="${String(isExpanded)}">
              <lew-icon name="arrowRight" size="20"></lew-icon>
            </button>
          </div>
        </div>
        <div class="word-card__details" ${isExpanded ? "" : "hidden"}>
          ${showTranslation ? `<div class="word-card__translation">${escapeHtml(translation)}</div>` : ""}
          <div class="word-card__progress">
            <div class="word-card__progress-bar" aria-hidden="true">
              <div class="word-card__progress-fill" style="width:${Math.min(100, points)}%"></div>
            </div>
            <span class="word-card__progress-label">${points}/100</span>
          </div>
          ${
            example
              ? `<div class="word-card__examples">
                  <div class="word-card__example">${escapeHtml(example.en || "")}</div>
                  <div class="word-card__example text-muted">${escapeHtml(exampleTranslation)}</div>
                </div>`
              : ""
          }
        </div>
      </div>
    `;

    const expandBtn = this.querySelector(".word-card__expand");
    if (expandBtn) {
      expandBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleExpanded();
      });
    }
  }
}

customElements.define("word-card", WordCard);