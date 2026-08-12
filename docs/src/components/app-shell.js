import * as router from "../router.js";
import * as settings from "../services/settings.js";
import * as i18n from "../services/i18n.js";
import { escapeHtml } from "../utils/html.js";
import "./icon.js";

const PRIMARY_NAV = [
  { path: "/", icon: "home", key: "home" },
  { path: "/learn", icon: "learn", key: "learn" },
  { path: "/repeat", icon: "repeat", key: "repeat" },
  { path: "/quiz", icon: "quiz", key: "quiz" },
];

const MORE_NAV = [
  { path: "/stats", icon: "stats", key: "stats" },
  { path: "/dictionary", icon: "dictionary", key: "dictionary" },
  { path: "/settings", icon: "settings", key: "settings" },
];

const ALL_NAV = [...PRIMARY_NAV, ...MORE_NAV];

class AppShell extends HTMLElement {
  constructor() {
    super();
    this._mounted = false;
    this._unmountPage = null;
    this._moreOpen = false;
    this._moreDocClickHandler = null;
    this._navToken = 0;
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;
    this._renderShell();
    this._setupListeners();
  }

  _renderShell() {
    const lang = settings.get("uiLang");
    i18n.setLang(lang);
    const current = router.currentPath();
    const bottomNavHTML = PRIMARY_NAV.map((item) => this._navItemHTML(item, current)).join("");
    const moreNavHTML = MORE_NAV.map((item) => this._navItemHTML(item, current)).join("");

    this.innerHTML = `
      <a href="#main" class="skip-link">${i18n.t("a11y.skipLink")}</a>
      <header class="app-header">
        <div class="app-header__title" data-i18n="appName">${i18n.t("appName")}</div>
        <div class="app-header__actions">
          <button class="app-header__more-btn" type="button"
            id="more-toggle"
            aria-expanded="false"
            aria-controls="more-menu"
            aria-label="${i18n.t("common.more")}">
            <lew-icon name="more" size="24"></lew-icon>
          </button>
          <div class="app-header__menu" id="more-menu" role="menu" hidden>
            ${moreNavHTML}
          </div>
        </div>
      </header>
      <nav class="app-nav app-nav--sidebar" aria-label="${i18n.t("a11y.mainNav")}">
        ${ALL_NAV.map((item) => this._navItemHTML(item, current)).join("")}
      </nav>
      <main class="page" id="main" tabindex="-1"></main>
      <nav class="app-nav app-nav--mobile" aria-label="${i18n.t("a11y.mainNav")}">${bottomNavHTML}</nav>
      <toast-stack aria-live="polite"></toast-stack>
    `;
    this._bindMoreMenu();
    this._highlightActiveNav();
  }

  _updateLabels() {
    i18n.setLang(settings.get("uiLang"));
    const title = this.querySelector(".app-header__title");
    if (title) title.textContent = i18n.t("appName");
    const skipLink = this.querySelector(".skip-link");
    if (skipLink) skipLink.textContent = i18n.t("a11y.skipLink");
    const moreBtn = this.querySelector("#more-toggle");
    if (moreBtn) moreBtn.setAttribute("aria-label", i18n.t("common.more"));
    const sidebarNav = this.querySelector(".app-nav--sidebar");
    if (sidebarNav) sidebarNav.setAttribute("aria-label", i18n.t("a11y.mainNav"));
    const mobileNav = this.querySelector(".app-nav--mobile");
    if (mobileNav) mobileNav.setAttribute("aria-label", i18n.t("a11y.mainNav"));
    const items = this.querySelectorAll(".app-nav__item");
    items.forEach((item) => {
      const label = item.querySelector(".app-nav__label");
      const key = item.getAttribute("data-i18n-key");
      if (label && key) label.textContent = i18n.t(`nav.${key}`);
    });
  }

  _navItemHTML(item, current) {
    const isActive =
      item.path === "/" ? current === "/" : current.startsWith(item.path);
    return `<a href="${item.path}" data-link class="app-nav__item" data-path="${item.path}" data-i18n-key="${item.key}" role="menuitem"${
      isActive ? ' aria-current="page"' : ""
    }>
      <span class="app-nav__icon" aria-hidden="true"><lew-icon name="${item.icon}" size="24"></lew-icon></span>
      <span class="app-nav__label">${i18n.t(`nav.${item.key}`)}</span>
    </a>`;
  }

  _bindMoreMenu() {
    const btn = this.querySelector("#more-toggle");
    const menu = this.querySelector("#more-menu");
    if (!btn || !menu) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._moreOpen = !this._moreOpen;
      menu.hidden = !this._moreOpen;
      btn.setAttribute("aria-expanded", String(this._moreOpen));
    });
    if (this._moreDocClickHandler) {
      document.removeEventListener("click", this._moreDocClickHandler);
    }
    this._moreDocClickHandler = (e) => {
      if (!this._moreOpen) return;
      if (this.querySelector(".app-header__menu")?.contains(e.target)) return;
      if (this.querySelector("#more-toggle")?.contains(e.target)) return;
      this._closeMoreMenu();
    };
    document.addEventListener("click", this._moreDocClickHandler);
    if (this._moreKeyHandler) {
      document.removeEventListener("keydown", this._moreKeyHandler);
    }
    this._moreKeyHandler = (e) => {
      if (e.key === "Escape" && this._moreOpen) {
        e.preventDefault();
        this._closeMoreMenu();
        btn.focus();
      }
    };
    document.addEventListener("keydown", this._moreKeyHandler);
  }

  _setupListeners() {
    router.onChange(async (path, opts = {}) => {
      this._closeMoreMenu();
      await this._navigateTo(path);
      if (opts.restoreScroll && history.state?.scrollY != null) {
        window.scrollTo({ top: history.state.scrollY, behavior: "auto" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      if (opts.userInitiated !== false) this._focusMain();
    });
  }

  _closeMoreMenu() {
    if (!this._moreOpen) return;
    this._moreOpen = false;
    const menu = this.querySelector("#more-menu");
    const btn = this.querySelector("#more-toggle");
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  _highlightActiveNav() {
    const items = this.querySelectorAll(".app-nav__item");
    const current = router.currentPath();
    items.forEach((item) => {
      const path = item.getAttribute("data-path");
      const isActive =
        path === "/" ? current === "/" : current.startsWith(path);
      item.classList.toggle("app-nav__item--active", isActive);
      if (isActive) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  }

  _focusMain() {
    const main = this.querySelector("#main");
    if (main) {
      main.focus({ preventScroll: false });
    }
  }

  refresh() {
    this._updateLabels();
    this._highlightActiveNav();
  }

  async _navigateTo(path) {
    const token = ++this._navToken;

    if (this._unmountPage) {
      try {
        this._unmountPage();
      } catch (e) {
        console.warn("[app-shell] unmount error", e);
      }
      this._unmountPage = null;
    }
    if (token !== this._navToken) return;

    const outlet = this.querySelector("#main");
    if (!outlet) return;

    outlet.setAttribute("aria-busy", "true");
    outlet.innerHTML = "";
    outlet.appendChild(document.createElement("div"));
    outlet.querySelector("div").className = "empty-state";
    outlet.querySelector("div").innerHTML = `<div class="spinner" aria-label="${i18n.t("common.loading")}"></div>`;

    const page = await resolvePage(path);
    if (token !== this._navToken) return;

    const finishMount = async () => {
      outlet.removeAttribute("aria-busy");
      this._highlightActiveNav();
      if (typeof page.mount === "function") {
        try {
          this._unmountPage = await page.mount(outlet);
        } catch (e) {
          console.error("[app-shell] mount error", e);
          outlet.innerHTML = `<div class="empty-state"><div class="empty-state__title">${escapeHtml(i18n.t("common.error"))}</div></div>`;
          this._unmountPage = null;
        }
        if (token !== this._navToken) {
          if (this._unmountPage) {
            try { this._unmountPage(); } catch (e) {}
            this._unmountPage = null;
          }
        }
      }
    };

    if (typeof document.startViewTransition === "function") {
      const transition = document.startViewTransition(() => {
        outlet.innerHTML = "";
      });
      try {
        await transition.ready;
      } catch (e) {
        // view transition not supported, fall through
      }
      await finishMount();
      try {
        await transition.finished.catch(() => {});
      } catch (e) {}
    } else {
      outlet.innerHTML = "";
      await finishMount();
    }
  }
}

async function resolvePage(path) {
  if (path === "/" || path === "") {
    const mod = await import("../pages/dashboard.js");
    return { tag: "page-dashboard", mount: mod.mount };
  }
  if (path.startsWith("/onboarding")) {
    const mod = await import("../pages/onboarding.js");
    return { tag: "page-onboarding", mount: mod.mount };
  }
  if (path.startsWith("/learn")) {
    const mod = await import("../pages/learn.js");
    return { tag: "page-learn", mount: mod.mount };
  }
  if (path.startsWith("/repeat")) {
    const mod = await import("../pages/repeat.js");
    return { tag: "page-repeat", mount: mod.mount };
  }
  if (path.startsWith("/quiz")) {
    const mod = await import("../pages/quiz.js");
    return { tag: "page-quiz", mount: mod.mount };
  }
  if (path.startsWith("/dictionary")) {
    const mod = await import("../pages/dictionary.js");
    return { tag: "page-dictionary", mount: mod.mount };
  }
  if (path.startsWith("/stats")) {
    const mod = await import("../pages/stats.js");
    return { tag: "page-stats", mount: mod.mount };
  }
  if (path.startsWith("/settings")) {
    const mod = await import("../pages/settings.js");
    return { tag: "page-settings", mount: mod.mount };
  }
  router.silentGo("/");
  const mod = await import("../pages/dashboard.js");
  return { tag: "page-dashboard", mount: mod.mount };
}

customElements.define("app-shell", AppShell);

export async function bootstrap(outlet) {
  const shell = document.createElement("app-shell");
  outlet.appendChild(shell);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const path = router.currentPath();
  shell._highlightActiveNav();
  await shell._navigateTo(path);
  if (typeof window !== "undefined") window.__appShell = shell;
  return shell;
}
