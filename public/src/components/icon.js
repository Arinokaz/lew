const ICONS = {
  home: '<path d="M3 10.5L12 3l9 7.5V20a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />',
  learn: '<path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="9" />',
  repeat: '<path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v5h-5" /><path d="M3 12a9 9 0 0 0 15.5 6.3" /><path d="M3 21v-5h5" />',
  quiz: '<path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />',
  stats: '<path d="M3 21V4" /><path d="M3 21h18" /><rect x="6" y="13" width="3" height="6" rx="1" /><rect x="11" y="9" width="3" height="10" rx="1" /><rect x="16" y="5" width="3" height="14" rx="1" />',
  dictionary: '<path d="M4 5a2 2 0 0 1 2-2h11v18H6a2 2 0 0 1-2-2z" /><path d="M17 3v18" /><path d="M8 7h5" /><path d="M8 11h3" />',
  settings: '<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />',
  more: '<circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />',
  audio: '<path d="M3 10v4a1 1 0 0 0 1 1h3l5 4V5L7 9H4a1 1 0 0 0-1 1z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />',
  close: '<path d="M18 6L6 18" /><path d="M6 6l12 12" />',
  menu: '<path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" />',
  search: '<circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />',
  check: '<path d="M5 12l5 5 9-11" />',
  arrowLeft: '<path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />',
  arrowRight: '<path d="M5 12h14" /><path d="M12 5l7 7-7 7" />',
  warning: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" />',
  flame: '<path d="M12 2c0 4-4 5-4 9a4 4 0 0 0 8 0c0-1.5-1-2.5-1-4c0-1 .5-2 1-2.5c-1.5 0-3 .5-4 1.5" /><path d="M12 22a6 6 0 0 1-6-6c0-2 1-3.5 2-4.5" />',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />',
  party: '<path d="M5 8l2 14h10l2-14" /><path d="M8.5 8L7 3h10l-1.5 5" /><path d="M3 10v2a2 2 0 0 0 2 2" /><path d="M19 12v-2a2 2 0 0 1 2-2v2" /><path d="M12 3v-1" />',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M5 4h3v3a3 3 0 0 1-3-3z" /><path d="M16 4h3a3 3 0 0 1-3 3z" /><path d="M10 13h4l-1 4h-2z" /><path d="M7 21h10" />',
  sparkle: '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" /><path d="M19 14l.5 1.5L21 16l-1.5.5L19 18l-.5-1.5L17 16l1.5-.5z" />',
  target: '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" />',
};

class LewIcon extends HTMLElement {
  static get observedAttributes() {
    return ["name", "size"];
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    this._render();
  }

  _render() {
    const name = this.getAttribute("name") || "";
    const rawSize = this.getAttribute("size") || "24";
    const size = Number(rawSize) || 24;
    const path = ICONS[name] || "";
    this.innerHTML = `
      <svg
        width="${size}"
        height="${size}"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >${path}</svg>
    `;
  }
}

customElements.define("lew-icon", LewIcon);
