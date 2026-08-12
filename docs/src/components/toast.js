class ToastStack extends HTMLElement {
  constructor() {
    super();
    this._toasts = new Map();
  }

  connectedCallback() {
    if (!this.id) this.id = "toast-stack";
    window.addEventListener("lew:toast", (e) => this.show(e.detail));
  }

  show({ id, message, kind = "info", duration = 3500 }) {
    if (!id) id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast = document.createElement("div");
    toast.className = `toast toast--${kind}`;
    toast.setAttribute("role", kind === "error" ? "alert" : "status");
    toast.textContent = message;
    this.appendChild(toast);
    this._toasts.set(id, toast);

    setTimeout(() => this.dismiss(id), duration);
    return id;
  }

  dismiss(id) {
    const toast = this._toasts.get(id);
    if (!toast) return;
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
      this._toasts.delete(id);
    }, 200);
  }
}

customElements.define("toast-stack", ToastStack);

export function toast(message, opts = {}) {
  window.dispatchEvent(
    new CustomEvent("lew:toast", {
      detail: { message, ...opts },
    })
  );
}

export function toastSuccess(message, opts = {}) {
  return toast(message, { kind: "success", ...opts });
}

export function toastError(message, opts = {}) {
  return toast(message, { kind: "error", ...opts });
}