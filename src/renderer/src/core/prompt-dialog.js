import { icon } from "./icons.js";

let _uidCounter = 0;

/**
 * Modal de entrada com 1+ campos de texto.
 * Retorna Promise<Object | null> — objeto com valores por nome, ou null se cancelado.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.message]
 * @param {Array<{name:string, label:string, placeholder?:string, required?:boolean, defaultValue?:string}>} opts.fields
 * @param {string} [opts.confirmLabel="Confirmar"]
 * @param {string} [opts.cancelLabel="Cancelar"]
 * @param {string} [opts.confirmVariant="primary"]
 * @param {string} [opts.confirmIcon=null]
 */
export function showPrompt({
  title,
  message = "",
  fields = [],
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmVariant = "primary",
  confirmIcon = null,
} = {}) {
  return new Promise((resolve) => {
    const uid = ++_uidCounter;
    const previousFocus = document.activeElement;

    const rootEl = document.createElement("div");
    rootEl.className = "modal modal--prompt-dialog";
    rootEl.setAttribute("role", "dialog");
    rootEl.setAttribute("aria-modal", "true");
    rootEl.setAttribute("aria-labelledby", `prompt-dialog-title-${uid}`);

    const overlay = document.createElement("div");
    overlay.className = "modal__overlay";
    overlay.dataset.action = "cancel";

    const content = document.createElement("div");
    content.className = "modal__content modal__content--sm";

    const header = document.createElement("div");
    header.className = "modal__header";

    const titleEl = document.createElement("h2");
    titleEl.className = "modal__title";
    titleEl.id = `prompt-dialog-title-${uid}`;
    titleEl.textContent = title;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "modal__close";
    closeBtn.dataset.action = "cancel";
    closeBtn.setAttribute("aria-label", "Fechar");
    closeBtn.textContent = "×";

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "modal__body";

    if (message) {
      const messageEl = document.createElement("p");
      messageEl.className = "confirm-message";
      messageEl.textContent = message;
      body.appendChild(messageEl);
    }

    const form = document.createElement("form");
    form.className = "prompt-dialog__form";
    form.noValidate = true;

    const inputs = [];
    fields.forEach((field) => {
      const group = document.createElement("div");
      group.className = "form-group";

      const label = document.createElement("label");
      label.className = "form-label";
      label.setAttribute("for", `prompt-${uid}-${field.name}`);
      label.textContent = field.label || field.name;
      if (field.required) {
        const star = document.createElement("span");
        star.style.color = "var(--color-accent-rose)";
        star.textContent = " *";
        label.appendChild(star);
      }

      const input = document.createElement("input");
      input.type = "text";
      input.className = "form-input";
      input.id = `prompt-${uid}-${field.name}`;
      input.name = field.name;
      input.placeholder = field.placeholder || "";
      input.value = field.defaultValue || "";
      input.autocomplete = "off";
      if (field.required) input.required = true;

      group.appendChild(label);
      group.appendChild(input);
      form.appendChild(group);
      inputs.push({ field, input });
    });

    body.appendChild(form);

    const footer = document.createElement("div");
    footer.className = "modal__footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--secondary";
    cancelBtn.dataset.action = "cancel";
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "submit";
    confirmBtn.className = `btn btn--${confirmVariant}`;
    confirmBtn.dataset.action = "confirm";

    if (confirmIcon) {
      confirmBtn.innerHTML = icon(confirmIcon, { size: 16, className: "btn__icon" });
    }
    confirmBtn.appendChild(document.createTextNode(confirmLabel));

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    form.appendChild(footer);

    content.appendChild(header);
    content.appendChild(body);

    rootEl.appendChild(overlay);
    rootEl.appendChild(content);

    function collectValues() {
      const result = {};
      for (const { field, input } of inputs) {
        const value = input.value.trim();
        if (field.required && !value) {
          input.focus();
          return null;
        }
        result[field.name] = value;
      }
      return result;
    }

    function finish(result) {
      rootEl.removeEventListener("click", onClick);
      form.removeEventListener("submit", onSubmit);
      document.removeEventListener("keydown", onKeydown, true);
      rootEl.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(result);
    }

    function onClick(e) {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      if (target.dataset.action === "cancel") {
        finish(null);
      }
    }

    function onSubmit(e) {
      e.preventDefault();
      const values = collectValues();
      if (values) finish(values);
    }

    function onKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
    }

    rootEl.addEventListener("click", onClick);
    form.addEventListener("submit", onSubmit);
    document.addEventListener("keydown", onKeydown, true);

    document.body.appendChild(rootEl);

    // Foco no primeiro input
    inputs[0]?.input.focus();
    inputs[0]?.input.select();
  });
}
