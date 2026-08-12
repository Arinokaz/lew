const listeners = new Set();

const BASE = new URL("./", document.baseURI).pathname;

let current = toRel(location.pathname || "/");

if (typeof window !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function toFull(rel) {
  if (!rel || rel === "/") return BASE || "/";
  const stripped = rel.replace(/^\//, "");
  return (BASE || "") + stripped;
}

function toRel(full) {
  const f = full || "/";
  if (BASE && f === BASE) return "/";
  if (BASE && f.startsWith(BASE)) return "/" + f.slice(BASE.length);
  return f;
}

export function init(getRoutes) {
  window.addEventListener("popstate", (e) => {
    const next = toRel(location.pathname || "/");
    if (next === current) return;
    if (document.body.dataset.quizActive === "true") {
      history.pushState({}, "", toFull(current));
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

  current = toRel(location.pathname || "/");
  return current;
}

export function go(path, opts = {}) {
  const rel = path || "/";
  if (rel === current && !opts.force) return;
  const userInitiated = opts.userInitiated !== false;
  const full = toFull(rel);
  if (!opts.replace) {
    try {
      history.replaceState({ scrollY: window.scrollY }, "", toFull(current));
    } catch (e) {
      history.replaceState({}, "", toFull(current));
    }
    history.pushState({}, "", full);
  } else {
    history.replaceState({}, "", full);
  }
  current = rel;
  emit(current, { restoreScroll: false, userInitiated });
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
