import * as i18n from "../services/i18n.js";

let _host = null;
let _active = null;

function ensureHost() {
  if (_host && document.body.contains(_host)) return _host;
  _host = document.createElement("lew-dialog");
  document.body.appendChild(_host);
  return _host;
}

export function openDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  richContent,
} = {}) {
  const host = ensureHost();
  return new Promise((resolve) => {
    if (_active) {
      _active._close(false);
    }
    const node = document.createElement("div");
    node.className = "lew-dialog__overlay";
    node.setAttribute("role", "presentation");
    const confirmText = confirmLabel || i18n.t("common.confirm");
    const cancelText = cancelLabel || i18n.t("common.cancel");
    const actionsHtml = richContent
      ? `<button type="button" class="btn lew-dialog__btn--cancel" data-action="cancel">${escapeHtml(cancelText)}</button>`
      : `<button type="button" class="btn lew-dialog__btn--cancel" data-action="cancel">${escapeHtml(cancelText)}</button>
         <button type="button" class="btn ${danger ? "lew-dialog__btn--danger" : "btn--primary"}" data-action="confirm">${escapeHtml(confirmText)}</button>`;
    node.innerHTML = `
      <div class="lew-dialog ${richContent ? "lew-dialog--rich" : ""}" role="dialog" aria-modal="true" aria-labelledby="lew-dialog-title" aria-describedby="lew-dialog-msg">
        ${title ? `<div class="lew-dialog__title" id="lew-dialog-title">${escapeHtml(title)}</div>` : ""}
        <div class="lew-dialog__message" id="lew-dialog-msg">${richContent || escapeHtml(message || "")}</div>
        <div class="lew-dialog__actions">${actionsHtml}</div>
      </div>
    `;

    const previouslyFocused = document.activeElement;
    const focusable = () => node.querySelectorAll("button:not([disabled]), [tabindex]:not([tabindex='-1'])");

    function trapFocus(e) {
      if (e.key !== "Tab") return;
      const items = Array.from(focusable());
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function onKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else {
        trapFocus(e);
      }
    }

    function close(result) {
      node.removeEventListener("keydown", onKeydown);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const cleanup = () => {
        if (node.parentNode) node.parentNode.removeChild(node);
        if (previouslyFocused && typeof previouslyFocused.focus === "function") {
          previouslyFocused.focus({ preventScroll: true });
        }
        _active = null;
        resolve(result);
      };
      if (reduceMotion) cleanup();
      else setTimeout(cleanup, 140);
    }

    function onClick(e) {
      const btn = e.currentTarget;
      const action = btn.getAttribute("data-action");
      if (action === "confirm") close(true);
      else close(false);
    }

    function onBackdrop(e) {
      if (e.target === node) close(false);
    }

    node.querySelectorAll("[data-action]").forEach((b) =>
      b.addEventListener("click", onClick)
    );
    node.addEventListener("click", onBackdrop);
    node.addEventListener("keydown", onKeydown);

    host.appendChild(node);
    const focusTarget = richContent
      ? node.querySelector("[data-action='cancel']")
      : (node.querySelector("[data-action='confirm']") || node.querySelector("[data-action]"));
    if (focusTarget) focusTarget.focus();
    _active = { _close: close };
  });
}

export function openInfoDialog({ title, html }) {
  return openDialog({
    title,
    richContent: html,
    cancelLabel: i18n.t("common.close"),
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

class LewDialog extends HTMLElement {
  connectedCallback() {}
}

customElements.define("lew-dialog", LewDialog);
