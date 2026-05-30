import { mountIcons } from "./icons.js";
import { navigateTo } from "./router.js";
import { EventBus } from "./event-bus.js";
import { BUY_URL } from "../features/license/license.js";

const MODAL_ID = "quota-modal";

const ENTITY_MESSAGES = {
  campaign: (limit) =>
    `Você atingiu o limite de ${limit} campanha do trial. Ative uma licença pra criar quantas precisar.`,
  character: (limit) =>
    `Você atingiu o limite de ${limit} personagens do trial. Ative uma licença pra criar quantos precisar.`,
  encounter: (limit) =>
    `Você atingiu o limite de ${limit} encontro do trial. Ative uma licença pra criar quantos precisar.`,
  encounter_participants: () =>
    `O trial permite até 8 participantes por encontro.`,
  scene: (limit) =>
    `Você atingiu o limite de ${limit} cena do trial. Ative uma licença pra criar quantas precisar.`,
};

const TEMPLATE = `
<div class="quota-modal-overlay" id="quota-modal-overlay" hidden></div>
<div class="quota-modal" id="quota-modal" role="dialog" aria-modal="true" hidden>
  <header class="quota-modal__header">
    <span class="quota-modal__icon"><i data-icon="lock"></i></span>
    <h2 class="quota-modal__title">Limite do trial atingido</h2>
  </header>
  <p class="quota-modal__message" id="quota-modal-message"></p>
  <footer class="quota-modal__actions">
    <button type="button" class="btn btn--ghost" id="quota-modal-close">Fechar</button>
    <button type="button" class="btn btn--primary" id="quota-modal-goto-license">Já tenho chave</button>
    <button type="button" class="btn btn--secondary" id="quota-modal-buy">Comprar</button>
  </footer>
</div>
`.trim();

function buildMessage(payload) {
  const { entity, limit } = payload;
  const builder = ENTITY_MESSAGES[entity];
  if (builder) return builder(limit);
  return `Você atingiu o limite do trial. Ative uma licença pra continuar.`;
}

export function mountQuotaModal() {
  if (document.getElementById(MODAL_ID)) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = TEMPLATE;
  while (wrapper.firstChild) {
    document.body.appendChild(wrapper.firstChild);
  }

  const overlay = document.getElementById("quota-modal-overlay");
  const modal = document.getElementById(MODAL_ID);
  const messageEl = document.getElementById("quota-modal-message");

  mountIcons(modal);

  function hide() {
    overlay.hidden = true;
    modal.hidden = true;
  }

  function show(payload) {
    messageEl.textContent = buildMessage(payload);
    overlay.hidden = false;
    modal.hidden = false;
  }

  overlay.addEventListener("click", hide);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) hide();
  });

  document.getElementById("quota-modal-close").addEventListener("click", hide);

  document.getElementById("quota-modal-goto-license").addEventListener("click", () => {
    hide();
    navigateTo("license");
  });

  document.getElementById("quota-modal-buy").addEventListener("click", () => {
    window.dmCopilot.openExternal(BUY_URL);
  });

  EventBus.on("quota:exceeded", show);
}
