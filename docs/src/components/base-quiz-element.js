import { escapeHtml } from "../utils/html.js";

export class BaseQuizElement extends HTMLElement {
  constructor() {
    super();
    this._answered = false;
    this._onAnswer = null;
    this._answerTimer = null;
  }

  disconnectedCallback() {
    this._cleanupKeys();
    if (this._answerTimer) {
      clearTimeout(this._answerTimer);
      this._answerTimer = null;
    }
  }

  setOnAnswer(fn) {
    this._onAnswer = fn;
  }

  _installKeyHandler(handler) {
    this._cleanupKeys();
    if (!handler) return;
    this._keyHandler = (e) => handler(e);
    document.addEventListener("keydown", this._keyHandler);
  }

  _cleanupKeys() {
    if (this._keyHandler) {
      document.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
  }

  _handleSkip() {
    if (this._answered) return;
    this._announceResult(false, this._target || "");
    this._fire({ correct: false, skipped: true }, true);
  }

  _fire(payload, skipped = false) {
    this._cleanupKeys();
    const delay = skipped || payload.studied ? 0 : payload.correct ? 500 : 1500;
    const fire = () => {
      if (this._onAnswer) this._onAnswer({ ...payload, skipped: !!skipped });
    };
    if (delay > 0) {
      this._answerTimer = setTimeout(() => {
        this._answerTimer = null;
        fire();
      }, delay);
    } else {
      fire();
    }
  }

  _disableInputs() {}

  _announceResult(correct, correctText) {
    const label = this.querySelector(".quiz__correct-answer");
    if (!label) return;
    if (correct) {
      label.innerHTML = `<span class="text-success" role="status">✓ ${escapeHtml(correctText || "")}</span>`;
    } else {
      label.innerHTML = `<span class="text-error" role="status">✗ ${escapeHtml(correctText || "")}</span>`;
    }
    label.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => {
      try { label.focus({ preventScroll: true }); } catch (e) {}
    });
  }
}