class Toggle extends HTMLElement {
  static get observedAttributes() {
    return ["checked", "label"];
  }

  constructor() {
    super();
    this._onChange = null;
  }

  connectedCallback() {
    this.addEventListener("click", this._toggle);
    this.addEventListener("keydown", this._onKey);
    this._render();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._toggle);
    this.removeEventListener("keydown", this._onKey);
  }

  attributeChangedCallback() {
    this._render();
  }

  _toggle = () => {
    const next = !this.hasAttribute("checked");
    if (next) this.setAttribute("checked", "");
    else this.removeAttribute("checked");
    if (this._onChange) this._onChange(next);
  };

  _onKey = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      this._toggle();
    }
  };

  onChange(fn) {
    this._onChange = fn;
  }

  _render() {
    const checked = this.hasAttribute("checked");
    const label = this.getAttribute("label") || "";
    this.setAttribute("role", "switch");
    this.setAttribute("tabindex", "0");
    this.setAttribute("aria-checked", String(checked));
    this.innerHTML = `
      <span class="toggle${checked ? " toggle--on" : ""}"></span>
      ${label ? `<span class="toggle__label">${label}</span>` : ""}
    `;
  }
}

customElements.define("lew-toggle", Toggle);