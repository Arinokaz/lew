import * as i18n from "../services/i18n.js";

class LevelMeter extends HTMLElement {
  static get observedAttributes() {
    return ["level", "mastered", "active", "total"];
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    this._render();
  }

  _render() {
    const level = this.getAttribute("level") || "";
    const mastered = Number(this.getAttribute("mastered") || 0);
    const active = Number(this.getAttribute("active") || 0);
    const total = Number(this.getAttribute("total") || 0);
    const progressValue = mastered + active;
    const pct = total === 0 ? 0 : Math.round((progressValue / total) * 100);
    this.innerHTML = `
      <div class="level-meter">
        <div class="level-meter__head">
          <span class="level-meter__level">${escapeHtml(level)}</span>
          <span class="level-meter__pct">${pct}%</span>
        </div>
        <progress-bar value="${progressValue}" max="${total}"></progress-bar>
        <div class="level-meter__count">${mastered} ✓ · ${active} ${escapeHtml(i18n.t("levelMeter.inProgress"))} · ${total}</div>
      </div>
    `;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

customElements.define("level-meter", LevelMeter);
