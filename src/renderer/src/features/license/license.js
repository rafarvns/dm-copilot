import template from "./license.html?raw";
import { mountIcons } from "../../core/icons.js";
import { showToast } from "../../core/toast.js";
import { showConfirm } from "../../core/confirm-dialog.js";
import { EventBus } from "../../core/event-bus.js";

export const BUY_URL = "https://dmcopilot.com.br/licenca";

const ENTITY_LABELS = {
  campaigns: "Campanhas",
  characters: "Personagens",
  encounters: "Encontros",
  scenes: "Cenas",
};

function maskMachineId(id) {
  if (!id || id.length < 8) return id ?? "—";
  return `${id.slice(0, 4)}***${id.slice(-4)}`;
}

function buildQuotaBars(info) {
  return Object.entries(ENTITY_LABELS)
    .map(([key, label]) => {
      const entry = info?.[key];
      if (!entry) return "";
      const { used, limit } = entry;
      const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      return `
        <div class="license-bar">
          <div class="license-bar__header">
            <span class="license-bar__label">${label}</span>
            <span class="license-bar__count">${used}/${limit}</span>
          </div>
          <div class="license-bar__track">
            <div class="license-bar__fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function buildUsageSummary(info) {
  return Object.entries(ENTITY_LABELS)
    .map(([key, label]) => {
      const entry = info?.[key];
      if (!entry) return "";
      return `<div class="license-usage__item"><span>${label}:</span> <strong>${entry.used}</strong></div>`;
    })
    .join("");
}

export default class LicenseFeature {
  constructor() {
    this._el = null;
    this._statusData = null;
  }

  async mount(el) {
    this._el = el;
    el.innerHTML = template;
    mountIcons(el);

    const res = await window.dmCopilot.license.getStatus();
    this._statusData = res;
    this._render(res);
    this._bindEvents(res);
  }

  destroy() {
    this._el = null;
    this._statusData = null;
  }

  _render({ status, machineId, info }) {
    const badge = this._el.querySelector("#license-status-badge");
    const body = this._el.querySelector("#license-status-body");
    const activateCard = this._el.querySelector("#license-activate-card");
    const buyCard = this._el.querySelector("#license-buy-card");
    const deactivateCard = this._el.querySelector("#license-deactivate-card");
    const machineIdEl = this._el.querySelector("#license-machine-id");

    activateCard.hidden = status !== "trial";
    buyCard.hidden = status !== "trial";
    deactivateCard.hidden = status !== "licensed";

    if (status === "dev") {
      badge.textContent = "Modo desenvolvimento";
      badge.className = "license-status__badge license-status__badge--dev";
      body.innerHTML = `<p>Todos os limites estão liberados para desenvolvimento.</p>`;
    } else if (status === "trial") {
      badge.textContent = "Trial";
      badge.className = "license-status__badge license-status__badge--trial";
      body.innerHTML = buildQuotaBars(info);
      if (machineIdEl) machineIdEl.textContent = machineId ?? "—";
    } else if (status === "licensed") {
      badge.textContent = "Licenciado";
      badge.className = "license-status__badge license-status__badge--licensed";
      body.innerHTML = `
        <div class="license-usage">
          <p class="license-usage__machine">Máquina: <code>${maskMachineId(machineId)}</code></p>
          ${buildUsageSummary(info)}
        </div>
      `;
    }

    mountIcons(this._el);
  }

  _bindEvents({ machineId }) {
    const copyBtn = this._el.querySelector("#btn-license-copy-machine-id");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(machineId ?? "");
        showToast("ID copiado");
      });
    }

    const activateBtn = this._el.querySelector("#btn-license-activate");
    const keyInput = this._el.querySelector("#input-license-key");
    const errorEl = this._el.querySelector("#license-error");

    if (activateBtn && keyInput && errorEl) {
      activateBtn.addEventListener("click", async () => {
        const key = keyInput.value.trim();
        errorEl.hidden = true;
        errorEl.textContent = "";

        if (!key) {
          errorEl.textContent = "Cole sua chave.";
          errorEl.hidden = false;
          return;
        }

        activateBtn.disabled = true;
        const result = await window.dmCopilot.license.activate(key);
        activateBtn.disabled = false;

        if (result.ok) {
          showToast("Licença ativada com sucesso!");
          EventBus.emit("license:changed");
          const res = await window.dmCopilot.license.getStatus();
          this._statusData = res;
          this._render(res);
          this._bindEvents(res);
        } else {
          const messages = {
            INVALID_FORMAT: "Formato de chave inválido.",
            ALREADY_ACTIVATED: "Esta chave já está ativada.",
          };
          errorEl.textContent = messages[result.error] ?? "Falha ao ativar a licença.";
          errorEl.hidden = false;
        }
      });
    }

    const buyBtn = this._el.querySelector("#btn-license-buy");
    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        window.dmCopilot.openExternal(BUY_URL);
      });
    }

    const deactivateBtn = this._el.querySelector("#btn-license-deactivate");
    if (deactivateBtn) {
      deactivateBtn.addEventListener("click", async () => {
        const confirmed = await showConfirm({
          title: "Desativar licença",
          message: "O app voltará pro modo trial. Continuar?",
          confirmLabel: "Desativar",
          confirmVariant: "danger",
        });
        if (!confirmed) return;

        await window.dmCopilot.license.deactivate();
        showToast("Licença desativada.");
        EventBus.emit("license:changed");
        const res = await window.dmCopilot.license.getStatus();
        this._statusData = res;
        this._render(res);
        this._bindEvents(res);
      });
    }
  }
}
