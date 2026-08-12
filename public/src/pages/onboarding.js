import * as settings from "../services/settings.js";
import * as i18n from "../services/i18n.js";
import * as router from "../router.js";
import { importFromUrl, isImported } from "../services/import.js";
import { toastError, toastSuccess } from "../components/toast.js";

const STEPS = ["welcome", "lang-ui", "lang-tr", "norm", "import", "done"];

export async function mount(outlet) {
  if (await isImported()) {
    router.replace("/");
    return () => {};
  }

  document.title = `LEW — ${i18n.t("onboarding.welcome")}`;
  let mounted = true;
  const cleanup = () => { mounted = false; };

  const state = {
    step: 0,
    uiLang: settings.get("uiLang"),
    translationLang: settings.get("translationLang"),
    dailyNorm: settings.get("dailyNorm"),
    importProgress: 0,
    importError: null,
  };

  const render = () => {
    if (!mounted) return;
    outlet.innerHTML = renderStep(state);
    bindStep(outlet, state, render, advance, back);
  };

  const advance = async () => {
    if (state.step >= STEPS.length - 1) return;
    const nextStep = state.step + 1;
    if (STEPS[nextStep] === "import") {
      state.step = nextStep;
      render();
      await runImport(outlet, state, render);
    } else {
      state.step = nextStep;
      render();
    }
  };

  const back = () => {
    if (state.step > 0) {
      state.step -= 1;
      render();
    }
  };

  render();

  return cleanup;
}

function renderStepIndicators(state) {
  const items = STEPS.map((_, i) => {
    const cls = i < state.step ? "onboarding-step--done" : i === state.step ? "onboarding-step--active" : "";
    return `<span class="onboarding-step ${cls}" aria-hidden="true"></span>`;
  }).join("");
  return `<div class="onboarding-steps" aria-hidden="true">${items}</div>`;
}

function renderStep(state) {
  const step = STEPS[state.step];
  const indicators = renderStepIndicators(state);
  switch (step) {
    case "welcome":
      return `
        <div class="onboarding onboarding--welcome">
          ${indicators}
          <div class="onboarding__welcome">
            <h1 class="page__title">${i18n.t("onboarding.welcome")}</h1>
            <p class="page__subtitle">${i18n.t("onboarding.description")}</p>
            <button class="btn btn--large btn--block" data-action="next" type="button">
              ${i18n.t("onboarding.next")}
            </button>
          </div>
        </div>
      `;
    case "lang-ui": {
      const langs = ["ru", "ua", "en"];
      return `
        <div class="onboarding">
          ${indicators}
          <h1 class="page__title">${i18n.t("onboarding.stepLangUI")}</h1>
          <div class="onboarding__choices">
            ${langs
              .map(
                (l) => `
              <button class="btn onboarding__choice ${state.uiLang === l ? "btn--primary" : "btn--secondary"}" data-lang="${l}" type="button">
                ${i18n.t(`langs.${l}`)}
              </button>
            `
              )
              .join("")}
          </div>
          <div class="row row--between mt-5">
            <button class="btn btn--ghost" data-action="back" type="button">${i18n.t("onboarding.back")}</button>
            <button class="btn" data-action="next" type="button">${i18n.t("onboarding.next")}</button>
          </div>
        </div>
      `;
    }
    case "lang-tr": {
      const langs = ["ru", "ua"];
      return `
        <div class="onboarding">
          ${indicators}
          <h1 class="page__title">${i18n.t("onboarding.stepLangTr")}</h1>
          <div class="onboarding__choices">
            ${langs
              .map(
                (l) => `
              <button class="btn onboarding__choice ${state.translationLang === l ? "btn--primary" : "btn--secondary"}" data-lang="${l}" type="button">
                ${i18n.t(`langs.${l}`)}
              </button>
            `
              )
              .join("")}
          </div>
          <div class="row row--between mt-5">
            <button class="btn btn--ghost" data-action="back" type="button">${i18n.t("onboarding.back")}</button>
            <button class="btn" data-action="next" type="button">${i18n.t("onboarding.next")}</button>
          </div>
        </div>
      `;
    }
    case "norm": {
      const opts = [5, 10, 15, 20, 25];
      return `
        <div class="onboarding">
          ${indicators}
          <h1 class="page__title">${i18n.t("onboarding.stepNorm")}</h1>
          <div class="segmented" role="radiogroup" data-norm-group>
            ${opts
              .map(
                (n) => `
              <button class="segmented__btn ${state.dailyNorm === n ? "segmented__btn--active" : ""}" data-norm="${n}" type="button" role="radio" aria-checked="${state.dailyNorm === n}">
                ${n}
              </button>
            `
              )
              .join("")}
          </div>
          <div class="row row--between mt-5">
            <button class="btn btn--ghost" data-action="back" type="button">${i18n.t("onboarding.back")}</button>
            <button class="btn" data-action="next" type="button">${i18n.t("onboarding.next")}</button>
          </div>
        </div>
      `;
    }
    case "import":
      return `
        <div class="onboarding onboarding--import">
          ${indicators}
          <h1 class="page__title">${i18n.t("onboarding.stepImport")}</h1>
          <progress-bar value="${state.importProgress}" max="100"></progress-bar>
          <div class="text-center text-muted mt-3">
            ${i18n.t("onboarding.importProgress")}: ${state.importProgress}%
          </div>
          ${
            state.importError
              ? `<div class="text-error text-center mt-3">${escapeHtml(state.importError)}</div>`
              : ""
          }
        </div>
      `;
    case "done":
      return `
        <div class="onboarding">
          ${indicators}
          <div class="empty-state onboarding__finish">
            <div class="empty-state__icon">✅</div>
            <div class="empty-state__title">${i18n.t("onboarding.start")}</div>
            <button class="btn btn--large btn--block" data-action="finish" type="button">
              ${i18n.t("onboarding.start")}
            </button>
          </div>
        </div>
      `;
    default:
      return `<div>Unknown step</div>`;
  }
}

function bindStep(outlet, state, render, advance, back) {
  outlet.querySelectorAll("[data-action='next']").forEach((btn) =>
    btn.addEventListener("click", () => {
      i18n.setLang(state.uiLang);
      settings.set("uiLang", state.uiLang);
      settings.set("translationLang", state.translationLang);
      settings.set("dailyNorm", state.dailyNorm);
      advance();
    })
  );

  outlet.querySelectorAll("[data-action='back']").forEach((btn) =>
    btn.addEventListener("click", () => back())
  );

  outlet.querySelectorAll("[data-action='finish']").forEach((btn) =>
    btn.addEventListener("click", () => router.replace("/"))
  );

  outlet.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang");
      const step = STEPS[state.step];
      if (step === "lang-ui") state.uiLang = lang;
      else if (step === "lang-tr") state.translationLang = lang;
      render();
    });
  });

  outlet.querySelectorAll("[data-norm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.dailyNorm = Number(btn.getAttribute("data-norm"));
      render();
    });
  });
}

async function runImport(outlet, state, render) {
  try {
    settings.set("uiLang", state.uiLang);
    settings.set("translationLang", state.translationLang);
    settings.set("dailyNorm", state.dailyNorm);
    settings.set("activeLevels", ["A1", "A2", "B1", "B2", "C1"]);
    settings.set("accent", "us");
    settings.applyTheme();

    const { imported } = await importFromUrl("./data/words.json", (done, total) => {
      state.importProgress = Math.round((done / total) * 100);
      render();
    });
    state.importProgress = 100;
    state.step = STEPS.indexOf("done");
    toastSuccess(i18n.t("onboarding.importSuccess"));
    render();
  } catch (e) {
    console.error("[onboarding]", e);
    state.importError = i18n.t("onboarding.importError");
    toastError(i18n.t("onboarding.importError"));
    render();
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
