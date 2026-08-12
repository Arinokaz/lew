class StatTile extends HTMLElement {
  static get observedAttributes() {
    return ["value", "label", "info", "detail"];
  }

  connectedCallback() {
    this._render();
    this._onClick = () => this._showInfo();
    this.addEventListener("click", this._onClick);
    this.addEventListener("keydown", this._onKey);
  }

  disconnectedCallback() {
    if (this._onClick) this.removeEventListener("click", this._onClick);
    if (this._onKey) this.removeEventListener("keydown", this._onKey);
  }

  attributeChangedCallback() {
    this._render();
  }

  _onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._showInfo();
    }
  };

  async _showInfo() {
    const info = this.getAttribute("info");
    if (!info) return;
    const detail = this.getAttribute("detail") || "";
    const { openInfoDialog } = await import("./dialog.js");
    const html = detail ? `<p>${info}</p><p class="text-muted">${detail}</p>` : `<p>${info}</p>`;
    openInfoDialog({
      title: this.getAttribute("label") || "",
      html,
    });
  }

  _render() {
    const value = this.getAttribute("value") || "0";
    const label = this.getAttribute("label") || "";
    const info = this.getAttribute("info");
    this.setAttribute("role", "group");
    this.setAttribute("aria-label", `${label}: ${value}`);
    if (info) {
      this.setAttribute("tabindex", "0");
      this.setAttribute("role", "button");
    }
    this.innerHTML = `
      <div class="stat-tile${info ? " stat-tile--clickable" : ""}">
        <div class="stat-tile__value" aria-hidden="true">${value}</div>
        <div class="stat-tile__label" aria-hidden="true">${label}</div>
        ${info ? '<div class="stat-tile__hint" aria-hidden="true">ⓘ</div>' : ""}
      </div>
    `;
  }
}

customElements.define("stat-tile", StatTile);