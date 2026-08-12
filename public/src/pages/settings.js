import * as settings from "../services/settings.js";
import * as i18n from "../services/i18n.js";
import * as router from "../router.js";
import { DAILY_NORM_OPTIONS, REPEAT_SESSION_OPTIONS, TRANSLATION_LANGS, UI_LANGS, ACCENTS, CEFR_LEVELS } from "../services/settings.js";
import { downloadJson, exportToJson, importFromJson, reimportDataset, resetAll } from "../services/backup.js";
import { clearAudioCache } from "../services/audio-cache.js";
import { openDialog } from "../components/dialog.js";
import { toastError, toastSuccess } from "../components/toast.js";
import "../components/toggle.js";
import "../components/slider.js";

export async function mount(outlet) {
  document.title = `LEW — ${i18n.t("settings.title")}`;
  outlet.innerHTML = `
    <div class="settings">
      <h1 class="page__title">${i18n.t("settings.title")}</h1>

      <section class="section card">
        <h2 class="section__title">${i18n.t("settings.learningSection")}</h2>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.languageTranslation")}</div>
          <div class="setting-row__control setting-row__control--seg" id="ctl-tr-lang"></div>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.dailyNorm")}</div>
          <div class="setting-row__control setting-row__control--seg" id="ctl-norm"></div>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.repeatSessionSize")}</div>
          <div class="setting-row__control setting-row__control--seg" id="ctl-repeat-size"></div>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.accent")}</div>
          <div class="setting-row__control setting-row__control--seg" id="ctl-accent"></div>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.activeLevels")}</div>
          <div class="setting-row__control setting-row__control--seg" id="ctl-levels"></div>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.soundEnabled")}</div>
          <lew-toggle id="ctl-sound" label=""></lew-toggle>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.vibrationEnabled")}</div>
          <lew-toggle id="ctl-vibrate" label=""></lew-toggle>
        </div>
      </section>

      <section class="section card">
        <h2 class="section__title">${i18n.t("settings.appearanceSection")}</h2>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.languageUI")}</div>
          <div class="setting-row__control setting-row__control--seg" id="ctl-ui-lang"></div>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.theme")}</div>
          <div class="setting-row__control setting-row__control--seg" id="ctl-theme"></div>
        </div>
      </section>

      <section class="section card settings-danger">
        <h2 class="section__title">${i18n.t("settings.dataSection")}</h2>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.exportData")}</div>
          <button class="btn" id="btn-export" type="button">${i18n.t("settings.exportAction")}</button>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.importData")}</div>
          <label class="btn">
            ${i18n.t("settings.importAction")}
            <input type="file" id="file-import" accept="application/json" hidden />
          </label>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.reimport")}</div>
          <button class="btn btn--secondary" id="btn-reimport" type="button">${i18n.t("settings.reimportAction")}</button>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.clearAudioCache")}</div>
          <button class="btn btn--secondary" id="btn-clear-audio" type="button">${i18n.t("settings.clearAudioAction")}</button>
        </div>

        <div class="setting-row">
          <div class="setting-row__label">${i18n.t("settings.resetProgress")}</div>
          <button class="btn btn--danger" id="btn-reset" type="button" aria-label="${i18n.t("settings.resetAction")}">${i18n.t("settings.resetAction")}</button>
        </div>
      </section>
    </div>
  `;

  bindControls(outlet);
  bindActions(outlet);

  return () => {};
}

function renderSegmented(items, currentValue, matchFn, labelFn, groupRole = "radiogroup", itemRole = "radio") {
  return `<div class="segmented" role="${groupRole}">${items
    .map((it) => {
      const active = matchFn(it, currentValue);
      const ariaAttr = groupRole === "radiogroup" ? 'aria-checked' : 'aria-pressed';
      return `<button type="button" role="${itemRole}" class="segmented__btn ${
        active ? "segmented__btn--active" : ""
      }" data-val="${escapeAttr(String(it))}" ${ariaAttr}="${active}">${escapeHtml(labelFn ? labelFn(it) : String(it))}</button>`;
    })
    .join("")}</div>`;
}

function updateSegmented(host, currentValue, matchFn) {
  host.querySelectorAll("[data-val]").forEach((btn) => {
    const v = btn.getAttribute("data-val");
    const active = matchFn(v, currentValue);
    btn.classList.toggle("segmented__btn--active", active);
    const attr = btn.getAttribute("aria-checked") !== null ? "aria-checked" : "aria-pressed";
    btn.setAttribute(attr, String(active));
  });
}

function bindControls(outlet) {
  const trLangCtl = outlet.querySelector("#ctl-tr-lang");
  trLangCtl.innerHTML = renderSegmented(
    TRANSLATION_LANGS,
    settings.get("translationLang"),
    (v, cur) => v === cur,
    (l) => i18n.t(`langs.${l}`)
  );
  trLangCtl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-val]");
    if (!btn) return;
    const v = btn.getAttribute("data-val");
    settings.set("translationLang", v);
    updateSegmented(trLangCtl, v, (val, cur) => val === cur);
  });

  const normCtl = outlet.querySelector("#ctl-norm");
  normCtl.innerHTML = renderSegmented(
    DAILY_NORM_OPTIONS,
    String(settings.get("dailyNorm")),
    (v, cur) => Number(v) === Number(cur),
    (n) => String(n)
  );
  normCtl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-val]");
    if (!btn) return;
    const v = Number(btn.getAttribute("data-val"));
    settings.set("dailyNorm", v);
    updateSegmented(normCtl, String(v), (val, cur) => Number(val) === Number(cur));
  });

  const repeatSizeCtl = outlet.querySelector("#ctl-repeat-size");
  repeatSizeCtl.innerHTML = renderSegmented(
    REPEAT_SESSION_OPTIONS,
    String(settings.get("repeatSessionSize")),
    (v, cur) => Number(v) === Number(cur),
    (n) => String(n)
  );
  repeatSizeCtl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-val]");
    if (!btn) return;
    const v = Number(btn.getAttribute("data-val"));
    settings.set("repeatSessionSize", v);
    updateSegmented(repeatSizeCtl, String(v), (val, cur) => Number(val) === Number(cur));
  });

  const accentCtl = outlet.querySelector("#ctl-accent");
  accentCtl.innerHTML = renderSegmented(
    ACCENTS,
    settings.get("accent"),
    (v, cur) => v === cur,
    (a) => a.toUpperCase()
  );
  accentCtl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-val]");
    if (!btn) return;
    const v = btn.getAttribute("data-val");
    settings.set("accent", v);
    updateSegmented(accentCtl, v, (val, cur) => val === cur);
  });

  const levelsCtl = outlet.querySelector("#ctl-levels");
  const updateLevels = () => {
    const cur = settings.get("activeLevels");
    levelsCtl.querySelectorAll("[data-val]").forEach((btn) => {
      const v = btn.getAttribute("data-val");
      const active = cur.includes(v);
      btn.classList.toggle("segmented__btn--active", active);
      btn.setAttribute("aria-checked", String(active));
    });
  };
  levelsCtl.innerHTML = `<div class="segmented" role="group" aria-label="${escapeHtml(i18n.t("settings.activeLevels"))}">${CEFR_LEVELS.map((l) =>
    `<button type="button" role="checkbox" class="segmented__btn" data-val="${l}" aria-checked="false">${l}</button>`
  ).join("")}</div>`;
  updateLevels();
  levelsCtl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-val]");
    if (!btn) return;
    const level = btn.getAttribute("data-val");
    const cur = settings.get("activeLevels");
    const next = cur.includes(level) ? cur.filter((l) => l !== level) : [...cur, level];
    if (next.length === 0) return;
    settings.set("activeLevels", next);
    updateLevels();
  });

  const soundT = outlet.querySelector("#ctl-sound");
  if (settings.get("soundEnabled")) soundT.setAttribute("checked", "");
  soundT.onChange((v) => settings.set("soundEnabled", v));

  const vibT = outlet.querySelector("#ctl-vibrate");
  if (settings.get("vibrationEnabled")) vibT.setAttribute("checked", "");
  vibT.onChange((v) => settings.set("vibrationEnabled", v));

  const uiLangCtl = outlet.querySelector("#ctl-ui-lang");
  uiLangCtl.innerHTML = renderSegmented(
    UI_LANGS,
    settings.get("uiLang"),
    (v, cur) => v === cur,
    (l) => l.toUpperCase()
  );
  uiLangCtl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-val]");
    if (!btn) return;
    const lang = btn.getAttribute("data-val");
    settings.set("uiLang", lang);
    i18n.setLang(lang);
    if (typeof window !== "undefined" && window.__appShell) window.__appShell.refresh();
    router.silentGo(router.currentPath());
  });

  const themeCtl = outlet.querySelector("#ctl-theme");
  const themeOpts = [
    { v: "light", l: i18n.t("settings.themeLight") },
    { v: "dark", l: i18n.t("settings.themeDark") },
    { v: "auto", l: i18n.t("settings.themeAuto") },
  ];
  const curTheme = settings.get("theme");
  themeCtl.innerHTML = `<div class="segmented" role="radiogroup">${themeOpts.map(
    (o) => `<button type="button" role="radio" class="segmented__btn ${
      o.v === curTheme ? "segmented__btn--active" : ""
    }" data-val="${o.v}" aria-checked="${o.v === curTheme}">${escapeHtml(o.l)}</button>`
  ).join("")}</div>`;
  themeCtl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-val]");
    if (!btn) return;
    const v = btn.getAttribute("data-val");
    settings.set("theme", v);
    settings.applyTheme();
    themeCtl.querySelectorAll("[data-val]").forEach((b) => {
      const active = b.getAttribute("data-val") === v;
      b.classList.toggle("segmented__btn--active", active);
      b.setAttribute("aria-checked", String(active));
    });
  });
}

function bindActions(outlet) {
  outlet.querySelector("#btn-export").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const data = await exportToJson();
      downloadJson(data);
      toastSuccess(i18n.t("common.exportOk"));
    } catch (e) {
      console.error(e);
      toastError(i18n.t("common.exportError"));
    } finally {
      if (btn.isConnected) btn.disabled = false;
    }
  });

  const fileInput = outlet.querySelector("#file-import");
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const counts = await importFromJson(text, { replace: true });
      toastSuccess(i18n.t("common.importOk", { words: counts.words, progress: counts.progress }));
      router.silentGo("/");
    } catch (err) {
      console.error(err);
      toastError(i18n.t("common.importError"));
    } finally {
      fileInput.value = "";
    }
  });

  outlet.querySelector("#btn-reimport").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (!(await openDialog({ message: i18n.t("common.reimportConfirm") }))) return;
    btn.disabled = true;
    try {
      await reimportDataset();
      toastSuccess(i18n.t("common.reimportOk"));
    } catch (err) {
      console.error(err);
      toastError(i18n.t("common.importError"));
    } finally {
      if (btn.isConnected) btn.disabled = false;
    }
  });

  outlet.querySelector("#btn-clear-audio").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (!(await openDialog({ message: i18n.t("common.cacheClearConfirm") }))) return;
    btn.disabled = true;
    try {
      await clearAudioCache();
      toastSuccess(i18n.t("common.cacheCleared"));
    } finally {
      if (btn.isConnected) btn.disabled = false;
    }
  });

  outlet.querySelector("#btn-reset").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    if (!(await openDialog({ message: i18n.t("settings.resetConfirm") }))) return;
    if (!(await openDialog({ message: i18n.t("settings.resetConfirm2"), danger: true }))) return;
    btn.disabled = true;
    try {
      await resetAll();
      settings.reset();
      toastSuccess(i18n.t("common.resetProgressOk"));
      router.silentGo("/onboarding");
    } catch (err) {
      console.error(err);
      toastError(i18n.t("common.error"));
      if (btn.isConnected) btn.disabled = false;
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
