import { playAudioUrl } from "../services/audio.js";
import * as i18n from "../services/i18n.js";
import { escapeHtml } from "../utils/html.js";
import { BaseQuizElement } from "./base-quiz-element.js";
import "./icon.js";

class QuizLetters extends BaseQuizElement {
  constructor() {
    super();
    this._target = "";
    this._pool = [];
    this._placed = [];
  }

  static get observedAttributes() {
    return ["prompt", "target", "extra", "audio-url", "word-type"];
  }

  connectedCallback() {
    this._setup();
    this._render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  attributeChangedCallback(name) {
    if (this._answered) return;
    if (name === "audio-url" || name === "target" || name === "extra" || name === "word-type") {
      this._setup();
    }
    this._render();
  }

  _setup() {
    this._target = (this.getAttribute("target") || "").toLowerCase();
    this._audioUrl = this.getAttribute("audio-url") || "";
    this._wordType = this.getAttribute("word-type") || "";
    const extra = Number(this.getAttribute("extra") || 3);
    const targetLetters = this._target.split("");
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const distractors = [];
    let attempts = 0;
    while (distractors.length < extra && attempts < 50) {
      const ch = alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!targetLetters.includes(ch) && !distractors.includes(ch)) {
        distractors.push(ch);
      }
      attempts += 1;
    }
    const pool = [...targetLetters, ...distractors];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this._pool = pool.map((ch, i) => ({ id: i, ch, used: false }));
    this._placed = [];
  }

  _hasAudio() {
    return Boolean(this._audioUrl);
  }

  _render() {
    const prompt = this.getAttribute("prompt") || "";
    const slotsHtml = this._placed
      .map(
        (p, i) =>
          `<span class="tile-builder__slot tile-builder__slot--filled" data-placed="${i}" role="button" tabindex="0" aria-label="${escapeHtml(p.ch)}">${escapeHtml(p.ch)}</span>`
      )
      .join("");
    const remainingSlots = Math.max(0, this._target.length - this._placed.length);
    const emptySlots = Array(remainingSlots)
      .fill(0)
      .map(() => `<span class="tile-builder__slot" aria-hidden="true"></span>`)
      .join("");
    const tilesHtml = this._pool
      .map(
        (t) =>
          `<button class="tile-builder__tile" type="button" data-tile="${t.id}" ${t.used ? "disabled" : ""} aria-label="${escapeHtml(t.ch)}">${escapeHtml(t.ch)}</button>`
      )
      .join("");

    const audioBlock = this._hasAudio()
      ? `<div class="quiz__audio">
          <button class="btn btn--secondary quiz__audio-btn" type="button" data-action="replay" aria-label="${escapeHtml(i18n.t("quiz.replay"))}">
            <lew-icon name="audio" size="20"></lew-icon>
            <span>${escapeHtml(i18n.t("quiz.replay"))} <span class="kbd-hint">${escapeHtml(i18n.t("quiz.replayHint"))}</span></span>
          </button>
        </div>`
      : "";
    const typeBadge = this._wordType
      ? `<div class="quiz__type-badge" aria-label="${escapeHtml(i18n.t("quiz.wordTypeLabel"))}: ${escapeHtml(this._wordType)}">${escapeHtml(this._wordType)}</div>`
      : "";

    this.innerHTML = `
      <div class="tile-builder">
        <div class="quiz__prompt">
          ${audioBlock}
          <div class="quiz__prompt-sub text-muted">${escapeHtml(prompt)}</div>
          ${typeBadge}
        </div>
        <div class="tile-builder__slots">${slotsHtml}${emptySlots}</div>
        <div class="tile-builder__tiles">${tilesHtml}</div>
        <div class="quiz__actions">
          <button class="btn btn--ghost" data-action="reset" type="button">${escapeHtml(i18n.t("quiz.reset"))}</button>
          <button class="btn btn--ghost" data-action="skip" type="button">${escapeHtml(i18n.t("quiz.skip"))} <span class="kbd-hint">${escapeHtml(i18n.t("quiz.skipHint"))}</span></button>
          <button class="btn" data-action="submit" type="button" ${this._placed.length === 0 ? "disabled" : ""}>${escapeHtml(i18n.t("quiz.submit"))}</button>
        </div>
        <div class="quiz__correct-answer" aria-live="polite"></div>
      </div>
    `;
    this._bind();
  }

  _bind() {
    this.querySelectorAll(".tile-builder__tile").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this._answered) return;
        const id = Number(btn.getAttribute("data-tile"));
        const tile = this._pool.find((t) => t.id === id);
        if (!tile || tile.used) return;
        tile.used = true;
        this._placed.push(tile);
        this._render();
      });
    });
    this.querySelectorAll(".tile-builder__slot--filled").forEach((slot) => {
      const removeAt = () => {
        if (this._answered) return;
        const i = Number(slot.getAttribute("data-placed"));
        const tile = this._placed[i];
        if (!tile) return;
        tile.used = false;
        this._placed.splice(i, 1);
        this._render();
      };
      slot.addEventListener("click", removeAt);
      slot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          removeAt();
        }
      });
    });
    this.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
      if (this._answered) return;
      this._pool.forEach((t) => (t.used = false));
      this._placed = [];
      this._render();
    });
    this.querySelector('[data-action="skip"]')?.addEventListener("click", () => {
      this._handleSkip();
    });
    this.querySelector('[data-action="submit"]')?.addEventListener("click", () => {
      if (this._answered || this._placed.length === 0) return;
      const guess = this._placed.map((p) => p.ch).join("");
      const correct = guess === this._target;
      this._finish(correct);
    });
    this.querySelector('[data-action="replay"]')?.addEventListener("click", () => {
      this._playAudio();
    });

    const keyHandler = (e) => {
      if (this._answered) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this._handleSkip();
      } else if (/^[a-zA-Zа-яА-ЯёЁіїІґҐ]$/.test(e.key) && this._pool.length) {
        const ch = e.key.toLowerCase();
        const tile = this._pool.find((t) => !t.used && t.ch === ch);
        if (tile) {
          e.preventDefault();
          tile.used = true;
          this._placed.push(tile);
          this._render();
        }
      } else if (e.key === "Backspace" && this._placed.length > 0) {
        e.preventDefault();
        const tile = this._placed.pop();
        if (tile) tile.used = false;
        this._render();
      } else if (e.key === "Enter" && this._placed.length > 0) {
        e.preventDefault();
        const guess = this._placed.map((p) => p.ch).join("");
        this._finish(guess === this._target);
      } else if (this._hasAudio() && (e.key === "a" || e.key === "A" || e.key === "ф" || e.key === "Ф")) {
        e.preventDefault();
        this._playAudio();
      }
    };
    this._installKeyHandler(keyHandler);
  }

  _playAudio() {
    if (!this._audioUrl) return;
    playAudioUrl(this._audioUrl).catch(() => {});
  }

  _finish(correct, skipped = false) {
    if (this._answered) return;
    this._answered = true;
    this._cleanupKeys();
    this.querySelectorAll(".tile-builder__tile").forEach((b) => {
      b.disabled = true;
    });
    this.querySelectorAll(".tile-builder__slot--filled").forEach((b) => {
      b.removeAttribute("role");
      b.removeAttribute("tabindex");
    });
    this._announceResult(correct, this._target);
    this._fire({ correct }, skipped);
  }

  _handleSkip() {
    if (this._answered) return;
    this._answered = true;
    this._cleanupKeys();
    this._fire({ correct: false }, true);
  }
}

customElements.define("quiz-letters", QuizLetters);