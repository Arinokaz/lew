import * as storage from "./storage.js";

export const DEFAULTS = Object.freeze({
  theme: "auto",
  uiLang: "ru",
  translationLang: "ru",
  dailyNorm: 15,
  repeatSessionSize: 15,
  accent: "us",
  activeLevels: ["A1", "A2", "B1", "B2", "C1"],
  soundEnabled: true,
  vibrationEnabled: true,
});

const KEY_MAP = {
  theme: "theme",
  uiLang: "uiLang",
  translationLang: "translationLang",
  dailyNorm: "dailyNorm",
  repeatSessionSize: "repeatSessionSize",
  accent: "accent",
  activeLevels: "activeLevels",
  soundEnabled: "soundEnabled",
  vibrationEnabled: "vibrationEnabled",
};

let cache = null;

function load() {
  if (cache) return cache;
  cache = { ...DEFAULTS };
  for (const [key, lsKey] of Object.entries(KEY_MAP)) {
    const stored = storage.get(lsKey);
    if (stored === null || stored === undefined) continue;
    cache[key] = stored;
  }
  return cache;
}

function save(key, value) {
  cache[key] = value;
  storage.set(KEY_MAP[key], value);
}

export function get(key) {
  return load()[key];
}

export function set(key, value) {
  load();
  save(key, value);
  if (key === "uiLang" && typeof document !== "undefined") {
    document.documentElement.lang = value;
  }
  notifyChange(key, value);
}

export function getAll() {
  return { ...load() };
}

export function reset() {
  cache = { ...DEFAULTS };
  for (const lsKey of Object.values(KEY_MAP)) {
    storage.remove(lsKey);
  }
  for (const [key, value] of Object.entries(DEFAULTS)) {
    notifyChange(key, value);
  }
}

const listeners = new Set();
export function onChange(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function notifyChange(key, value) {
  for (const fn of listeners) {
    try {
      fn(key, value);
    } catch (e) {
      console.warn("[settings] listener error", e);
    }
  }
}

export function applyTheme() {
  const theme = get("theme");
  const root = document.documentElement;
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
  } else if (theme === "light") {
    root.setAttribute("data-theme", "light");
    root.style.colorScheme = "light";
  } else {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "light dark";
  }
}

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"];
export const DAILY_NORM_OPTIONS = [5, 10, 15, 20, 25];
export const REPEAT_SESSION_OPTIONS = [10, 15, 20, 50, 100];
export const TRANSLATION_LANGS = ["ru", "ua"];
export const UI_LANGS = ["ru", "ua", "en"];
export const ACCENTS = ["us", "uk"];