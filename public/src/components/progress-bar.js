class ProgressBar extends HTMLElement {
  static get observedAttributes() {
    return ["value", "max", "label"];
  }

  constructor() {
    super();
    this._value = 0;
    this._max = 100;
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    this._render();
  }

  _render() {
    this._value = Number(this.getAttribute("value") || 0);
    this._max = Number(this.getAttribute("max") || 100);
    const label = this.getAttribute("label") || "";
    const pct = this._max === 0 ? 0 : Math.min(100, (this._value / this._max) * 100);
    this.innerHTML = `
      <div class="progress-bar">
        ${label ? `<div class="progress-bar__label"><span>${label}</span><span>${this._value}/${this._max}</span></div>` : ""}
        <div class="progress-bar__track">
          <div class="progress-bar__fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }
}

customElements.define("progress-bar", ProgressBar);