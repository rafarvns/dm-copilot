import { icon } from "./icons.js";

let _uidCounter = 0;

export function showConfirm({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmVariant = "danger",
  confirmIcon = null,
} = {}) {
  return new Promise((resolve) => {
    const uid = ++_uidCounter;
    const previousFocus = document.activeElement;

    // --- Estrutura do modal via createElement para evitar XSS nos textos ---

    const rootEl = document.createElement("div");
    rootEl.className = "modal modal--confirm-dialog";
    rootEl.setAttribute("role", "dialog");
    rootEl.setAttribute("aria-modal", "true");
    rootEl.setAttribute("aria-labelledby", `confirm-dialog-title-${uid}`);

    const overlay = document.createElement("div");
    overlay.className = "modal__overlay";
    overlay.dataset.action = "cancel";

    const content = document.createElement("div");
    content.className = "modal__content modal__content--sm";

    // Cabeçalho
    const header = document.createElement("div");
    header.className = "modal__header";

    const titleEl = document.createElement("h2");
    titleEl.className = "modal__title";
    titleEl.id = `confirm-dialog-title-${uid}`;
    titleEl.textContent = title;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "modal__close";
    closeBtn.dataset.action = "cancel";
    closeBtn.setAttribute("aria-label", "Fechar");
    closeBtn.textContent = "×"; // ×

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    // Mensagem
    const messageEl = document.createElement("p");
    messageEl.className = "confirm-message";
    messageEl.textContent = message;

    // Rodapé
    const footer = document.createElement("div");
    footer.className = "modal__footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--secondary";
    cancelBtn.dataset.action = "cancel";
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = `btn btn--${confirmVariant}`;
    confirmBtn.dataset.action = "confirm";

    // Ícone vem de icon() — SVG seguro do registro Lucide, pode ir como innerHTML
    if (confirmIcon) {
      confirmBtn.innerHTML = icon(confirmIcon, { size: 16, className: "btn__icon" });
    }
    // Texto do botão adicionado como nó de texto para não sobrescrever o SVG
    confirmBtn.appendChild(document.createTextNode(confirmLabel));

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    content.appendChild(header);
    content.appendChild(messageEl);
    content.appendChild(footer);

    rootEl.appendChild(overlay);
    rootEl.appendChild(content);

    // --- Limpeza e resolução ---

    function finish(result) {
      rootEl.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown, true);
      rootEl.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(result);
    }

    function onClick(e) {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      finish(target.dataset.action === "confirm");
    }

    function onKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    }

    rootEl.addEventListener("click", onClick);
    // capture: true garante que o handler roda antes de qualquer stopPropagation interno
    document.addEventListener("keydown", onKeydown, true);

    document.body.appendChild(rootEl);

    // Foco no Cancelar — default seguro evita confirmação acidental por Enter
    cancelBtn.focus();
  });
}
