import { getAllWords, getAllProgress } from "../services/db.js";
import * as settings from "../services/settings.js";
import * as i18n from "../services/i18n.js";
import * as router from "../router.js";
import { isImported } from "../services/import.js";
import { CEFR_LEVELS } from "../services/settings.js";
import { escapeHtml } from "../utils/html.js";
import "../components/word-card.js";
import "../components/audio-player.js";
import "../components/icon.js";

const PAGE_SIZE = 24;

export async function mount(outlet) {
  if (!(await isImported())) {
    router.replace("/onboarding");
    return () => {};
  }

  document.title = `LEW — ${i18n.t("dictionary.title")}`;
  outlet.innerHTML = `
    <div class="dictionary">
      <h1 class="page__title">${escapeHtml(i18n.t("dictionary.title"))}</h1>

      <section class="section">
        <h2 class="visually-hidden">${escapeHtml(i18n.t("dictionary.searchPlaceholder"))}</h2>
        <div class="search-field-wrap">
          <lew-icon name="search" size="18"></lew-icon>
          <input
            type="search"
            id="search"
            class="search-field"
            placeholder="${escapeHtml(i18n.t("dictionary.searchPlaceholder"))}"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
          />
        </div>
      </section>

      <section class="section">
        <h2 class="visually-hidden">${escapeHtml(i18n.t("dictionary.filters"))}</h2>
        <div class="segmented" id="filters" role="group">
          <button class="segmented__btn segmented__btn--active" data-filter="all" aria-pressed="true">${escapeHtml(i18n.t("dictionary.all"))}</button>
          <button class="segmented__btn" data-filter="new" aria-pressed="false">${escapeHtml(i18n.t("dictionary.new"))}</button>
          <button class="segmented__btn" data-filter="learning" aria-pressed="false">${escapeHtml(i18n.t("dictionary.learning"))}</button>
          <button class="segmented__btn" data-filter="mastered" aria-pressed="false">${escapeHtml(i18n.t("dictionary.mastered"))}</button>
        </div>
      </section>

      <section class="section">
        <h2 class="visually-hidden">${escapeHtml(i18n.t("common.more"))}</h2>
        <div class="segmented" id="levels" role="group">
          <button class="segmented__btn segmented__btn--active" data-level="" aria-pressed="true">${escapeHtml(i18n.t("dictionary.all"))}</button>
          ${CEFR_LEVELS.map(
            (l) => `<button class="segmented__btn" data-level="${l}" aria-pressed="false">${escapeHtml(l)}</button>`
          ).join("")}
        </div>
      </section>

      <section class="section">
        <h2 class="visually-hidden">${escapeHtml(i18n.t("dictionary.title"))}</h2>
        <div id="result-count" class="text-muted text-center mb-3" aria-live="polite"></div>
        <div id="results" class="dictionary__grid"></div>
        <div id="pager" class="row row--between mt-4" hidden>
          <button class="btn btn--secondary" data-action="prev" type="button" aria-label="${escapeHtml(i18n.t("common.back"))}">
            <lew-icon name="arrowLeft" size="18"></lew-icon>
          </button>
          <span id="page-info" class="text-muted"></span>
          <button class="btn btn--secondary" data-action="next" type="button" aria-label="${escapeHtml(i18n.t("common.next"))}">
            <lew-icon name="arrowRight" size="18"></lew-icon>
          </button>
        </div>
      </section>
    </div>
  `;

  let activeFilter = "all";
  let activeLevel = "";
  let searchTerm = "";
  let currentPage = 0;
  let totalCount = 0;

  let allWords = [];
  let progressMap = new Map();

  try {
    [allWords, progressMap] = await Promise.all([loadWords(), loadProgress()]);
  } catch (e) {
    console.error("[dictionary]", e);
    outlet.querySelector("#results").innerHTML = `<div class="empty-state">${escapeHtml(i18n.t("common.loadError"))}</div>`;
    return () => {};
  }

  const search = outlet.querySelector("#search");
  search.addEventListener("input", debounce(() => {
    searchTerm = search.value.trim().toLowerCase();
    currentPage = 0;
    render();
  }, 200));

  outlet.querySelector("#filters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    activeFilter = btn.getAttribute("data-filter");
    outlet.querySelectorAll("#filters [data-filter]").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("segmented__btn--active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    currentPage = 0;
    render();
  });

  outlet.querySelector("#levels").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-level]");
    if (!btn) return;
    const lvl = btn.getAttribute("data-level");
    outlet.querySelectorAll("#levels [data-level]").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("segmented__btn--active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    activeLevel = lvl || "";
    currentPage = 0;
    render();
  });

  const pager = outlet.querySelector("#pager");
  pager.querySelector('[data-action="prev"]').addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage -= 1;
      render();
      outlet.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  pager.querySelector('[data-action="next"]').addEventListener("click", () => {
    if ((currentPage + 1) * PAGE_SIZE < totalCount) {
      currentPage += 1;
      render();
      outlet.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  function render() {
    const list = filteredWords();
    totalCount = list.length;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = list.slice(start, end);

    outlet.querySelector("#result-count").textContent = `${totalCount}`;

    const results = outlet.querySelector("#results");
    results.innerHTML = "";
    if (!list.length) {
      outlet.querySelector("#pager").hidden = true;
      results.innerHTML = `<div class="empty-state">${escapeHtml(i18n.t("dictionary.empty"))}</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const w of pageItems) {
      const card = document.createElement("word-card");
      card.setAttribute("word-data", JSON.stringify(w));
      card.setAttribute("lang", settings.get("translationLang"));
      const p = progressMap.get(w.id);
      const points = p?.points || 0;
      card.setAttribute("data-points", String(points));
      if (points >= 100) card.setAttribute("show-translation", "");
      fragment.appendChild(card);
    }
    results.appendChild(fragment);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const pagerEl = outlet.querySelector("#pager");
    if (totalPages > 1) {
      pagerEl.hidden = false;
      outlet.querySelector("#page-info").textContent = `${currentPage + 1} / ${totalPages}`;
    } else {
      pagerEl.hidden = true;
    }
  }

  function filteredWords() {
    let list = allWords;
    if (activeLevel) list = list.filter((w) => w.level === activeLevel);
    if (searchTerm) {
      list = list.filter(
        (w) =>
          w.word.toLowerCase().includes(searchTerm) ||
          (w.translations?.ru || "").toLowerCase().includes(searchTerm) ||
          (w.translations?.ua || "").toLowerCase().includes(searchTerm)
      );
    }
    if (activeFilter === "new") {
      list = list.filter((w) => {
        const p = progressMap.get(w.id);
        return !p || (p.repetition === 0 && p.successCount === 0 && p.failCount === 0);
      });
    } else if (activeFilter === "learning") {
      list = list.filter((w) => {
        const p = progressMap.get(w.id);
        return p && (p.points || 0) > 0 && (p.points || 0) < 100;
      });
    } else if (activeFilter === "mastered") {
      list = list.filter((w) => (progressMap.get(w.id)?.points || 0) >= 100);
    }
    return list;
  }

  render();

  return () => {};
}

async function loadWords() {
  return getAllWords();
}

async function loadProgress() {
  const list = await getAllProgress();
  return new Map(list.map((p) => [p.wordId, p]));
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}