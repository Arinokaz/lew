const listeners = new Set();
let current = "/";

if (typeof window !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

export function init(getRoutes) {
  window.addEventListener("popstate", (e) => {
    const next = location.pathname || "/";
    if (next === current) return;
    if (document.body.dataset.quizActive === "true") {
      // Re-push the current path to abort navigation, ask user via dialog
      history.pushState({}, "", current);
      import("./components/dialog.js").then(async ({ openDialog }) => {
        const i18n = (await import("./services/i18n.js"));
        const ok = await openDialog({
          message: i18n.t("quiz.leaveConfirm"),
          confirmLabel: i18n.t("quiz.leave"),
          cancelLabel: i18n.t("common.cancel"),
          danger: true,
        });
        if (ok) go(next, { force: true });
      });
      return;
    }
    current = next;
    emit(current, { restoreScroll: true });
  });

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-link]");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("#")) return;
    e.preventDefault();
    if (document.body.dataset.quizActive === "true" && href !== current) {
      import("./components/dialog.js").then(async ({ openDialog }) => {
        const i18n = (await import("./services/i18n.js"));
        const ok = await openDialog({
          message: i18n.t("quiz.leaveConfirm"),
          confirmLabel: i18n.t("quiz.leave"),
          cancelLabel: i18n.t("common.cancel"),
          danger: true,
        });
        if (ok) go(href);
      });
      return;
    }
    go(href);
  });

  current = location.pathname || "/";
  return current;
}

export function go(path, opts = {}) {
  if (path === current && !opts.force) return;
  const userInitiated = opts.userInitiated !== false;
  if (!opts.replace) {
    try {
      history.replaceState({ scrollY: window.scrollY }, "", current);
    } catch (e) {
      history.replaceState({}, "", current);
    }
    history.pushState({}, "", path);
  } else {
    history.replaceState({}, "", path);
  }
  current = path;
  emit(path, { restoreScroll: false, userInitiated });
}

export function silentGo(path) {
  return go(path, { userInitiated: false });
}

export function replace(path, opts = {}) {
  go(path, { replace: true, ...opts });
}

export function currentPath() {
  return current;
}

export function onChange(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function emit(path, opts = {}) {
  for (const fn of listeners) {
    try {
      fn(path, opts);
    } catch (e) {
      console.warn("[router] listener error", e);
    }
  }
}

export function href(path) {
  return path;
}