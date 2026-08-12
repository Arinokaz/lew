import * as i18n from "./services/i18n.js";

const ACTIVE_FLAG = "quizActive";

export function setQuizActive(active) {
  if (typeof document === "undefined") return;
  if (active) {
    document.body.dataset[ACTIVE_FLAG] = "true";
  } else {
    delete document.body.dataset[ACTIVE_FLAG];
  }
}

export function isQuizActive() {
  if (typeof document === "undefined") return false;
  return document.body.dataset[ACTIVE_FLAG] === "true";
}

export { i18n };