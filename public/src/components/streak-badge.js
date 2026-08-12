import * as i18n from "../services/i18n.js";
import "./icon.js";

class StreakBadge extends HTMLElement {
  static get observedAttributes() {
    return ["count"];
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    this._render();
  }

  _render() {
    const count = Number(this.getAttribute("count") || 0);
    this.setAttribute("role", "status");
    this.setAttribute("aria-label", `${i18n.t("dashboard.streakLabel")}: ${count}`);
    this.innerHTML = `
      <span class="streak-badge">
        <span class="streak-badge__count" aria-hidden="true">${count}</span>
        <span class="streak-badge__icon" aria-hidden="true"><lew-icon name="flame" size="22"></lew-icon></span>
      </span>
    `;
  }
}

customElements.define("streak-badge", StreakBadge);