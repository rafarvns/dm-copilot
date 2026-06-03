import { icon } from "./icons.js";

let _uidCounter = 0;

/**
 * Modal de conflito de import com 3 opções: Criar nova / Substituir existente / Cancelar.
 * @param {{ campaignName: string }} opts
 * @returns {Promise<"new" | "replace" | null>}
 */
export function showImportConflict({ campaignName }) {
  return new Promise((resolve) => {
    const uid = ++_uidCounter;
    const previousFocus = document.activeElement;

    // --- Estrutura do modal via createElement para evitar XSS nos textos ---

    const rootEl = document.createElement("div");
    rootEl.className = "modal modal--confirm-dialog";
    rootEl.setAttribute("role", "dialog");
    rootEl.setAttribute("aria-modal", "true");
    rootEl.setAttribute("aria-labelledby", `import-conflict-title-${uid}`);

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
    titleEl.id = `import-conflict-title-${uid}`;
    titleEl.textContent = "Campanha já existe";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "modal__close";
    closeBtn.dataset.action = "cancel";
    closeBtn.setAttribute("aria-label", "Fechar");
    closeBtn.textContent = "×";

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    // Mensagem
    const messageEl = document.createElement("p");
    messageEl.className = "confirm-message";
    messageEl.textContent = `Já existe uma campanha chamada "${campaignName}" no app. O que você quer fazer?`;

    // Rodapé
    const footer = document.createElement("div");
    footer.className = "modal__footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--secondary";
    cancelBtn.dataset.action = "cancel";
    cancelBtn.textContent = "Cancelar";

    const replaceBtn = document.createElement("button");
    replaceBtn.type = "button";
    replaceBtn.className = "btn btn--danger";
    replaceBtn.dataset.action = "replace";
    replaceBtn.innerHTML = icon("refresh-cw", { size: 16, className: "btn__icon" });
    replaceBtn.appendChild(document.createTextNode("Substituir existente"));

    const newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.className = "btn btn--primary";
    newBtn.dataset.action = "new";
    newBtn.innerHTML = icon("copy-plus", { size: 16, className: "btn__icon" });
    newBtn.appendChild(document.createTextNode("Criar nova"));

    footer.appendChild(cancelBtn);
    footer.appendChild(replaceBtn);
    footer.appendChild(newBtn);

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
      const action = target.dataset.action;
      if (action === "new") finish("new");
      else if (action === "replace") finish("replace");
      else finish(null);
    }

    function onKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
    }

    rootEl.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown, true);

    document.body.appendChild(rootEl);

    // Foco no Cancelar — default seguro evita ação acidental por Enter
    cancelBtn.focus();
  });
}
