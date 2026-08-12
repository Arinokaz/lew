class Slider extends HTMLElement {
  static get observedAttributes() {
    return ["value", "min", "max", "step", "label"];
  }

  constructor() {
    super();
    this._onChange = null;
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    this._render();
  }

  _render() {
    const value = Number(this.getAttribute("value") || 0);
    const min = Number(this.getAttribute("min") || 0);
    const max = Number(this.getAttribute("max") || 100);
    const step = Number(this.getAttribute("step") || 1);
    const label = this.getAttribute("label") || "";
    this.innerHTML = `
      <div class="slider__label">
        <span>${label}</span>
        <span class="slider__value">${value}</span>
      </div>
      <input
        class="slider"
        type="range"
        value="${value}"
        min="${min}"
        max="${max}"
        step="${step}"
      />
    `;
    const input = this.querySelector("input");
    if (input) {
      input.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        this.setAttribute("value", String(v));
        const valueEl = this.querySelector(".slider__value");
        if (valueEl) valueEl.textContent = String(v);
        if (this._onChange) this._onChange(v);
      });
    }
  }

  onChange(fn) {
    this._onChange = fn;
  }
}

customElements.define("lew-slider", Slider);