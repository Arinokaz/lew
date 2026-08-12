import * as router from "./router.js";
import * as settings from "./services/settings.js";
import * as i18n from "./services/i18n.js";
import { refreshStreakOnVisit } from "./services/streak.js";
import "./components/toast.js";
import { toast } from "./components/toast.js";

let refreshing = false;

async function bootstrap() {
  settings.applyTheme();
  i18n.setLang(settings.get("uiLang"));
  document.documentElement.lang = settings.get("uiLang");
  router.init();

  const outlet = document.getElementById("app");
  if (!outlet) return;

  const splash = document.getElementById("splash");
  if (splash) {
    splash.classList.add("splash--hidden");
    setTimeout(() => splash.remove(), 300);
  }

  const firstInteraction = () => {
    const ctx = window.AudioContext || window.webkitAudioContext;
    if (ctx && !window.__audioCtx) {
      try {
        window.__audioCtx = new ctx();
        window.__audioCtx.resume().catch(() => {});
      } catch (e) {}
    }
    document.removeEventListener("pointerdown", firstInteraction, true);
    document.removeEventListener("keydown", firstInteraction, true);
  };
  document.addEventListener("pointerdown", firstInteraction, true);
  document.addEventListener("keydown", firstInteraction, true);

  const { bootstrap: bootShell } = await import("./components/app-shell.js");
  await bootShell(outlet);

  try {
    await refreshStreakOnVisit();
  } catch (e) {
    console.warn("[streak] refresh failed", e);
  }

  registerSW();
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) => {
        if (!reg) return;
        if (reg.waiting) {
          promptUpdate();
        }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate();
            }
          });
        });
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          location.reload();
        });
      })
      .catch((e) => console.warn("[SW] registration failed", e));
  });
}

function promptUpdate() {
  if (!navigator.serviceWorker?.controller) return;
  const reload = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  };
  toast(i18n.t("app.swUpdate"), { duration: 999999, kind: "info", id: "sw-update" });
  setTimeout(() => {
    const toastEl = document.querySelector(".toast#toast-sw-update") || document.getElementById("sw-update");
    if (toastEl) {
      toastEl.classList.add("toast--action");
      toastEl.addEventListener("click", reload, { once: true });
    }
  }, 50);
}

bootstrap().catch((e) => {
  console.error("[app] bootstrap failed", e);
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">${i18n.t("app.startupError")}</div>
        <pre style="white-space:pre-wrap;text-align:left;max-width:600px;margin:auto">${(e?.stack || e?.message || String(e)).replace(/</g, "&lt;")}</pre>
      </div>
    `;
  }
});