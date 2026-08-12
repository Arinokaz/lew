import * as settings from "../services/settings.js";
import * as i18n from "../services/i18n.js";
import { onAudioState } from "../services/audio.js";
import "./icon.js";

class AudioPlayer extends HTMLElement {
  static get observedAttributes() {
    return ["data-us", "data-uk"];
  }

  connectedCallback() {
    this._render();
    this._unsubState = onAudioState((e) => this._setState(e.state));
  }

  disconnectedCallback() {
    if (this._unsubState) {
      this._unsubState();
      this._unsubState = null;
    }
  }

  attributeChangedCallback() {
    this._refresh();
  }

  _setState(state) {
    if (!this._mainBtn) return;
    this._mainBtn.setAttribute("aria-busy", state === "playing" ? "true" : "false");
    if (state === "error") {
      this._mainBtn.classList.add("audio-player__btn--error");
    } else {
      this._mainBtn.classList.remove("audio-player__btn--error");
    }
  }

  _render() {
    const accent = settings.get("accent");
    const usUrl = this.getAttribute("data-us") || "";
    const ukUrl = this.getAttribute("data-uk") || "";
    const lang = i18n.getLang();
    const altLabel =
      lang === "en"
        ? ` (${accent === "us" ? "UK" : "US"})`
        : lang === "ua"
          ? ` (${accent === "us" ? "Бр" : "Ам"})`
          : ` (${accent === "us" ? "Бр" : "Ам"})`;
    this.innerHTML = `
      <button class="audio-player__btn audio-player__btn--accent-${accent}" type="button" aria-label="${i18n.t("audio.play")}">
        <lew-icon name="audio" size="20"></lew-icon>
      </button>
      ${
        usUrl && ukUrl
          ? `<button class="audio-player__btn audio-player__btn--accent-${accent === "us" ? "uk" : "us"}" type="button" aria-label="${i18n.t("audio.play")}${altLabel}">
              <span class="audio-player__alt">${accent === "us" ? (lang === "en" ? "UK" : "Бр") : (lang === "en" ? "US" : "Ам")}</span>
            </button>`
          : ""
      }
    `;
    const btns = this.querySelectorAll(".audio-player__btn");
    this._mainBtn = btns[0];
    if (this._mainBtn) {
      this._mainBtn.addEventListener("click", () => this.play(accent));
    }
    if (btns[1]) {
      btns[1].addEventListener("click", () => this.play(accent === "us" ? "uk" : "us"));
    }
    this._refresh();
  }

  _refresh() {
    const accent = settings.get("accent");
    const usUrl = this.getAttribute("data-us") || "";
    const ukUrl = this.getAttribute("data-uk") || "";
    this._currentUrl = accent === "us" ? usUrl : ukUrl;
    this._altUrl = accent === "us" ? ukUrl : usUrl;
  }

  play(accent) {
    const url = accent === "uk" ? this._altUrl : this._currentUrl;
    if (!url) return;
    import("../services/audio.js").then(({ playAudioUrl }) => playAudioUrl(url)).catch(() => {});
  }
}

customElements.define("audio-player", AudioPlayer);