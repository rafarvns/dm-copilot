/**
 * DM Copilot - Encounter Combat View
 * Manages active combat, turns, and real-time syncing
 */

import { showToast } from "../core/toast.js";
import { showConfirm } from "../core/confirm-dialog.js";
import { icon } from "../core/icons.js";
import { escapeHtml } from "../core/format.js";
import {
  resolveEffectiveVisibility,
  applyVisibilityToParticipant,
} from "../core/combat-visibility.js";
import { modifier, formatModifier } from "../core/dnd-stats.js";

function parseIntOr(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export default class EncounterCombatView {
  constructor(encountersView) {
    this.encountersView = encountersView;
    this.isActive = false;
    this._hotkeyPanelMinimized = false;
    this.initiativeLocked = false;
    this.currentEncounter = null;
    this.participants = [];
    this.currentTurnIndex = 0;
    this.currentRound = 1;
    this.rollHistory = [];

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.DOM = {
      controls: document.getElementById("combat-controls"),
      arena: document.getElementById("combat-arena"),
      banners: document.getElementById("combat-banners"),
      btnStart: document.getElementById("btn-start-combat"),
      btnEnd: document.getElementById("btn-end-combat"),
      btnNext: document.getElementById("btn-next-turn"),
      btnPrev: document.getElementById("btn-prev-turn"),
      btnOpenPlayerLink: document.getElementById("btn-open-player-link"),
      roundDisplay: document.getElementById("combat-round-display"),
      roundNumber: document.getElementById("current-round-number"),

      // Initiative buttons (now in combat-controls, no separate bar)
      btnRollAllNpcInit: document.getElementById("btn-roll-all-npc-initiative"),
      btnRollAllAllyInit: document.getElementById("btn-roll-all-ally-initiative"),

      // Death Save Modal
      deathSaveModal: document.getElementById("modal-death-save"),
      deathSavePrompt: document.getElementById("death-save-prompt"),
      deathSaveInput: document.getElementById("input-death-save-value"),
      btnConfirmDeathSave: document.getElementById("btn-confirm-death-save"),
      btnRollDeathSave: document.getElementById("btn-roll-death-save"),
      btnCloseDeathSave: document.getElementById("btn-close-death-save-modal"),
      deathSaveModalOverlay: document.getElementById("death-save-modal-overlay"),

      // Sections
      sections: {
        allies: document.getElementById("section-allies"),
        neutrals: document.getElementById("section-neutrals"),
        enemies: document.getElementById("section-enemies"),
      },

      // Quick Edit Modal
      quickEditModal: document.getElementById("modal-quick-edit"),
      quickEditOverlay: document.getElementById("quick-edit-modal-overlay"),
      quickEditClose: document.getElementById("btn-close-quick-edit"),
      quickEditCancel: document.getElementById("btn-cancel-quick-edit"),
      quickEditSave: document.getElementById("btn-save-quick-edit"),
      quickEditPickImage: document.getElementById("btn-quick-edit-pick-image"),
      quickEditResetActed: document.getElementById("btn-quick-edit-reset-acted"),
      quickEditResetSaves: document.getElementById("btn-quick-edit-reset-saves"),
      quickEditImagePreview: document.getElementById("quick-edit-image-preview"),
      quickEditName: document.getElementById("quick-edit-name"),
      quickEditCurrentHp: document.getElementById("quick-edit-current-hp"),
      quickEditHp: document.getElementById("quick-edit-hp"),
      quickEditCa: document.getElementById("quick-edit-ca"),
      quickEditInitiative: document.getElementById("quick-edit-initiative"),

      // Participant Details Modal
      participantDetailsModal: document.getElementById("modal-participant-details"),
      participantDetailsOverlay: document.getElementById("participant-details-modal-overlay"),
      btnCloseDetails: document.getElementById("btn-close-details"),
      btnCancelDetails: document.getElementById("btn-cancel-details"),
      btnSaveDetails: document.getElementById("btn-save-details"),
    };
  }

  bindEvents() {
    this.DOM.btnStart?.addEventListener("click", () => this.startCombat());
    this.DOM.btnEnd?.addEventListener("click", () => this.endCombat());
    this.DOM.btnNext?.addEventListener("click", () => this.nextTurn());
    this.DOM.btnPrev?.addEventListener("click", () => this.prevTurn());
    this.DOM.btnRollAllNpcInit?.addEventListener("click", () => this.rollAllNpcInitiative());
    this.DOM.btnRollAllAllyInit?.addEventListener("click", () => this.rollAllAllyInitiative());

    // Listen for player connections
    if (window.dmCopilot.combat) {
      window.dmCopilot.combat.onPlayerConnected((socketId) => {
        if (this.isActive) {
          this.broadcastState();
        }
      });
    }

    // Open player link in external browser
    this.DOM.btnOpenPlayerLink?.addEventListener("click", () => {
      const url = this.DOM.btnOpenPlayerLink.dataset.url;
      if (url && window.dmCopilot?.openExternal) {
        window.dmCopilot.openExternal(url);
      }
    });

    // Resolve server URL on boot so the link button is ready before combat starts
    if (window.dmCopilot?.combat) {
      window.dmCopilot.combat
        .getInfo()
        .then(({ ip, port }) => {
          this._setPlayerLinkUrl(`http://${ip}:${port}`);
        })
        .catch(() => {});
    }

    // Modal Edição Rápida — listeners
    this.DOM.banners.addEventListener("dblclick", (e) => {
      const banner = e.target.closest(".combat-banner");
      if (!banner) return;
      if (e.target.closest("input, button, .death-save-marker")) return;
      this.openQuickEditModal(banner.dataset.id);
    });
    this.DOM.quickEditOverlay?.addEventListener("click", () => this.closeQuickEditModal());
    this.DOM.quickEditClose?.addEventListener("click", () => this.closeQuickEditModal());
    this.DOM.quickEditCancel?.addEventListener("click", () => this.closeQuickEditModal());
    this.DOM.quickEditSave?.addEventListener("click", () => this.saveQuickEdit());
    this.DOM.quickEditPickImage?.addEventListener("click", () => this.pickImageForQuickEdit());
    this.DOM.quickEditResetActed?.addEventListener("click", () => this.handleQuickEditResetActed());
    this.DOM.quickEditResetSaves?.addEventListener("click", () => this.handleQuickEditResetSaves());

    // Modal Detalhes do Participante — listeners
    this.DOM.participantDetailsOverlay?.addEventListener("click", () =>
      this.closeParticipantDetails()
    );
    this.DOM.btnCloseDetails?.addEventListener("click", () => this.closeParticipantDetails());
    this.DOM.btnCancelDetails?.addEventListener("click", () => this.closeParticipantDetails());
    this.DOM.btnSaveDetails?.addEventListener("click", () => this.saveParticipantDetails());
    document.getElementById("btn-details-add-action")?.addEventListener("click", () => {
      this._addNewAction();
    });

    // Esc fecha qualquer modal aberto
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!this.DOM.participantDetailsModal?.classList.contains("hidden")) {
        this.closeParticipantDetails();
      } else if (!this.DOM.quickEditModal?.classList.contains("hidden")) {
        this.closeQuickEditModal();
      }
    });

    // Modifier ao vivo para os ability score inputs do modal de detalhes
    ["str", "dex", "con", "int", "wis", "cha"].forEach((ab) => {
      const input = document.getElementById(`details-${ab}`);
      input?.addEventListener("input", () => {
        const mod = document.getElementById(`details-${ab}-mod`);
        if (mod) mod.textContent = formatModifier(input.value);
      });
    });

    // Painel flutuante de atalhos — listener idempotente
    const hotkeyPanel = document.getElementById("combat-hotkey-panel");
    if (hotkeyPanel && !hotkeyPanel._listenerAttached) {
      hotkeyPanel._listenerAttached = true;
      hotkeyPanel.addEventListener("click", (e) => this._onHotkeyPanelClick(e));
    }

    const minBtn = document.getElementById("btn-combat-hotkey-minimize");
    if (minBtn && !minBtn._listenerAttached) {
      minBtn._listenerAttached = true;
      minBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._hotkeyPanelMinimized = !this._hotkeyPanelMinimized;
        this._renderCombatHotkeyPanel();
      });
    }

    // Click no painel inteiro quando minimizado → expande
    const panel = document.getElementById("combat-hotkey-panel");
    if (panel && !panel._minimizeClickListenerAttached) {
      panel._minimizeClickListenerAttached = true;
      panel.addEventListener("click", (e) => {
        if (!this._hotkeyPanelMinimized) return;
        // Se clicou no botão minimize, deixa o handler dele tratar
        if (e.target.closest("#btn-combat-hotkey-minimize")) return;
        this._hotkeyPanelMinimized = false;
        this._renderCombatHotkeyPanel();
      });
    }
  }

  _setPlayerLinkUrl(url) {
    if (!url) return;
    this._playerLinkUrl = url;
    if (this.DOM.btnOpenPlayerLink) {
      this.DOM.btnOpenPlayerLink.dataset.url = url;
      this.DOM.btnOpenPlayerLink.removeAttribute("hidden");
    }
  }

  async startCombat() {
    this.currentEncounter = this.encountersView.currentEncounter;
    if (!this.currentEncounter) return;

    try {
      this.currentCampaign = await window.dmCopilot.db.campaigns.getById(
        this.currentEncounter.campaign_id
      );
    } catch (err) {
      console.warn("Falha ao carregar campanha para visibility config:", err);
      this.currentCampaign = null;
    }

    this.participants = this.gatherParticipants();
    if (this.participants.length === 0) {
      showToast("Adicione participantes antes de iniciar o combate.", "error");
      return;
    }

    // Combate começa SEM iniciativas. Mantemos a ordem original
    // (aliados → neutros → inimigos, conforme o gather) até que
    // todas as iniciativas sejam definidas pelo mestre.
    await window.presentationController.requestPresentation({
      type: "combat",
      label: this.currentEncounter.name || "Combate",
      start: () => this._activateCombat(),
      stop: () => this._stopCombatInternal(),
    });
  }

  async _activateCombat() {
    try {
      const c = this.currentEncounter;
      await window.dmCopilot.db.encounters.update(c.id, {
        campaign_id: c.campaign_id,
        name: c.name,
        description: c.description,
        difficulty: c.difficulty,
        monsters: this.participants,
        status: "active",
        current_round: 1,
        current_turn_index: 0,
      });
    } catch (err) {
      console.error("Failed to update encounter status:", err);
    }

    try {
      const { ip, port } = await window.dmCopilot.combat.getInfo();
      this._setPlayerLinkUrl(`http://${ip}:${port}`);
    } catch (err) {
      console.error("Failed to get combat server info:", err);
    }

    this.isActive = true;
    this.initiativeLocked = false;
    this.currentRound = 1;
    this.currentTurnIndex = 0;
    // Limpa rollHistory de combates anteriores neste combatView singleton.
    this.rollHistory = [];
    this.logRoundChange(1);

    this.DOM.btnStart.classList.add("hidden");
    this.DOM.btnEnd.classList.remove("hidden");
    this.DOM.roundDisplay.classList.remove("hidden");
    this.DOM.arena.classList.remove("hidden");
    Object.values(this.DOM.sections).forEach((s) => s.classList.add("hidden"));

    this.renderBanners();
    this.updateInitiativePhaseUI();
    this.broadcastState();

    // Só inicia o ciclo de turnos quando todas as iniciativas estiverem
    // definidas. Caso contrário, esperamos o mestre rolar/inserir as
    // iniciativas antes de o "Próximo Turno" significar algo.
    if (this.allInitiativesSet()) {
      this.lockInitiativeOrder();
      await this.handleTurnStart();
    }
  }

  allInitiativesSet() {
    if (!this.participants || this.participants.length === 0) return false;
    return this.participants.every((p) => p.initiative !== null && p.initiative !== undefined);
  }

  gatherParticipants() {
    const participants = [];
    const lists = document.querySelectorAll(".encounter-section__list");
    const sourceList = this.encountersView?.participants || [];

    lists.forEach((list) => {
      const affinity = list.dataset.affinity;
      const cards = list.querySelectorAll(".participant-card");

      cards.forEach((card) => {
        const imgEl = card.querySelector(".participant-card__img");
        const cardId = card.dataset.id;
        const original = sourceList.find((p) => p.tempId === cardId || p.id === cardId);

        // Read live values directly from the DOM inputs — this is the source
        // of truth the user sees on screen, and avoids cases where the backing
        // object got out of sync.
        const acInputEl = card.querySelector('input[data-field="ac"]');
        const hpInputEl = card.querySelector('input[data-field="current_hp"]');
        const hpMaxEl = card.querySelector(".stat-control__max");

        const domAc = acInputEl ? parseInt(acInputEl.value, 10) : NaN;
        const domCurHp = hpInputEl ? parseInt(hpInputEl.value, 10) : NaN;
        const domMaxHp = hpMaxEl ? parseInt(hpMaxEl.textContent, 10) : NaN;

        const ca = !isNaN(domAc) ? domAc : Number(original?.ac) || 10;
        const maxHp = !isNaN(domMaxHp) ? domMaxHp : Number(original?.hp) || 0;
        const currentHp = !isNaN(domCurHp)
          ? domCurHp
          : original?.current_hp !== undefined
            ? Number(original.current_hp)
            : maxHp;

        participants.push({
          ...(original || {}),
          id: cardId,
          name: card.querySelector(".participant-card__name").textContent.trim(),
          image: imgEl ? imgEl.src : original?.image ?? null,
          affinity: affinity,
          initiative: null,
          has_acted: 0,
          hp: maxHp,
          current_hp: currentHp,
          ca: ca,
          deathSaves: this.makeEmptyDeathSaves(),
        });
      });
    });

    return participants;
  }

  makeEmptyDeathSaves() {
    return {
      active: false,
      successes: 0,
      failures: 0,
      stabilized: false,
      dead: false,
    };
  }

  requestDeathSaveValue(name) {
    return new Promise((resolve) => {
      this.DOM.deathSavePrompt.textContent = `Resultado da rolagem (d20) para ${name}:`;
      this.DOM.deathSaveInput.value = "10";
      this.DOM.deathSaveModal.classList.remove("hidden");

      const onConfirm = () => {
        const raw = parseInt(this.DOM.deathSaveInput.value, 10);
        const val = Number.isFinite(raw) ? Math.max(1, Math.min(20, raw)) : 10;
        cleanup();
        resolve(val);
      };

      const onCancel = () => {
        cleanup();
        resolve(null); // null = cancelado, sem efeito
      };

      const onRoll = () => {
        const roll = Math.floor(Math.random() * 20) + 1;
        this.DOM.deathSaveInput.value = roll;
        onConfirm();
      };

      const cleanup = () => {
        this.DOM.btnConfirmDeathSave.removeEventListener("click", onConfirm);
        this.DOM.btnRollDeathSave.removeEventListener("click", onRoll);
        this.DOM.btnCloseDeathSave.removeEventListener("click", onCancel);
        this.DOM.deathSaveModalOverlay?.removeEventListener("click", onCancel);
        this.DOM.deathSaveModal.classList.add("hidden");
      };

      this.DOM.btnConfirmDeathSave.addEventListener("click", onConfirm);
      this.DOM.btnRollDeathSave.addEventListener("click", onRoll);
      this.DOM.btnCloseDeathSave.addEventListener("click", onCancel);
      this.DOM.deathSaveModalOverlay?.addEventListener("click", onCancel);

      this.DOM.deathSaveInput.focus();
      this.DOM.deathSaveInput.select();
    });
  }

  applyDeathSaveResult(participant, value) {
    if (!participant || !participant.deathSaves) return;
    const ds = participant.deathSaves;

    if (value === 20) {
      // Recuperação miraculosa: HP=1 e sai do estado
      participant.current_hp = 1;
      participant.deathSaves = this.makeEmptyDeathSaves();
      showToast(
        `${icon("sparkles")} ${participant.name} teve uma recuperação miraculosa! (1 HP)`,
        "success"
      );
      return;
    }

    if (value === 1) {
      ds.failures = Math.min(3, ds.failures + 2);
    } else if (value >= 10) {
      ds.successes = Math.min(3, ds.successes + 1);
    } else {
      ds.failures = Math.min(3, ds.failures + 1);
    }

    if (ds.successes >= 3) {
      ds.stabilized = true;
      ds.active = false;
      showToast(`${icon("shield")} ${participant.name} foi estabilizado`, "success");
    } else if (ds.failures >= 3) {
      ds.dead = true;
      ds.active = false;
      showToast(`${icon("skull")} ${participant.name} morreu`, "error");
    }
  }

  async handleNewParticipant(participant) {
    if (!this.isActive) return;

    // Transform to combat participant format. Quem entra DURANTE o combate
    // começa sem iniciativa — o mestre rola/insere depois pelo banner.
    const maxHp = Number(participant.hp) || 0;
    const currentHp = participant.current_hp !== undefined ? Number(participant.current_hp) : maxHp;
    const ca = Number(participant.ac) || 0;
    const combatParticipant = {
      ...participant,
      id: participant.tempId || participant.id,
      name: participant.name,
      image: participant.image,
      affinity: participant.affinity,
      initiative: null,
      has_acted: 0,
      hp: maxHp,
      current_hp: currentHp,
      ca: ca,
      deathSaves: this.makeEmptyDeathSaves(),
    };

    const currentActiveId = this.participants[this.currentTurnIndex]?.id;
    this.participants.push(combatParticipant);

    // Re-abrimos a fase de iniciativa: o novo participante precisa ter
    // iniciativa definida antes de continuar o ciclo de turnos.
    this.initiativeLocked = false;

    if (currentActiveId) {
      this.currentTurnIndex = this.participants.findIndex((p) => p.id === currentActiveId);
      if (this.currentTurnIndex < 0) this.currentTurnIndex = 0;
    }

    this.renderBanners();
    this.updateInitiativePhaseUI();
    this.broadcastState();
    this.updateDB();

    showToast(`${combatParticipant.name} entrou na luta! Defina a iniciativa.`);
  }

  renderBanners() {
    const phase = this.initiativeLocked;
    this.DOM.banners.innerHTML = this.participants
      .map((p, index) => {
        const isActive = phase && index === this.currentTurnIndex;
        const hasActed = phase && p.has_acted && !isActive;
        const ds = p.deathSaves;
        const isDead = ds?.dead;
        const showSaves = ds && (ds.active || ds.stabilized || ds.dead);

        const savesMarkersHtml = showSaves
          ? `${[0, 1, 2]
              .map(
                (i) => `
            <span class="death-save-marker death-save-marker--success ${i < ds.successes ? "filled" : ""}"
                  data-id="${p.id}" data-kind="success" data-index="${i}" title="Sucesso ${i + 1}"></span>
          `
              )
              .join("")}<span class="death-save-divider"></span>${[0, 1, 2]
              .map(
                (i) => `
            <span class="death-save-marker death-save-marker--failure ${i < ds.failures ? "filled" : ""}"
                  data-id="${p.id}" data-kind="failure" data-index="${i}" title="Falha ${i + 1}"></span>
          `
              )
              .join("")}`
          : "";

        const savesHtml = showSaves
          ? `
        <div class="death-saves" data-id="${p.id}">
          <div class="death-saves__label">Salvamentos</div>
          <div class="death-saves__row">
            ${savesMarkersHtml}
          </div>
        </div>
      `
          : "";

        const initValue = p.initiative ?? "";
        const initiativeHtml = !this.initiativeLocked
          ? `
          <div class="combat-banner__initiative-edit" data-id="${p.id}">
            <input type="number" class="initiative-input combat-banner__field" placeholder="—"
                   data-id="${p.id}" data-field="initiative" min="0" max="40" step="1" value="${initValue}" />
            <button class="btn btn--icon-only btn--sm initiative-roll-btn"
                    data-id="${p.id}" title="Rolar d20">
              ${icon("dices")}
            </button>
          </div>
        `
          : `<div class="combat-banner__initiative" data-id="${p.id}">${p.initiative}</div>`;

        const hasHp = p.hp != null && p.current_hp != null;
        const hasCa = p.ca != null;
        const hpLow = hasHp && p.hp > 0 && p.current_hp / p.hp <= 0.25;
        const hpHtml = hasHp
          ? `<span class="combat-banner__hp ${hpLow ? "combat-banner__hp--low" : ""}">
  <span class="combat-banner__hp-icon">${icon("heart")}</span>
  <input class="combat-banner__hp-num combat-banner__field" data-id="${p.id}" data-field="current_hp" type="number" min="0" value="${p.current_hp}" />
  <span>/</span>
  <input class="combat-banner__hp-num combat-banner__field" data-id="${p.id}" data-field="hp" type="number" min="0" value="${p.hp}" />
</span>`
          : "";
        const caHtml = hasCa
          ? `<span class="combat-banner__ca">
  <span class="combat-banner__ca-icon">${icon("shield")}</span>
  <input class="combat-banner__ca-num combat-banner__field" data-id="${p.id}" data-field="ca" type="number" min="0" max="40" value="${p.ca}" />
</span>`
          : "";
        const statsHtml =
          hasHp || hasCa ? `<div class="combat-banner__stats">${hpHtml}${caHtml}</div>` : "";

        return `
        <div class="combat-banner ${isActive ? "combat-banner--active" : ""} ${hasActed ? "combat-banner--acted" : ""} ${isDead ? "combat-banner--dead" : ""}" data-id="${p.id}">
          <button class="combat-banner__details" data-id="${p.id}" type="button" title="Detalhes" aria-label="Ver detalhes">${icon("info", { size: 14 })}</button>
          <button class="combat-banner__remove" data-id="${p.id}" title="Remover da luta">${icon("x", { size: 14 })}</button>
          <div class="combat-banner__affinity combat-banner__affinity--${p.affinity}"></div>
          ${
            p.image
              ? `
            <div class="combat-banner__image-container">
              <img src="${p.image}" class="combat-banner__img" />
            </div>
          `
              : ""
          }
          <input class="combat-banner__name combat-banner__field" data-id="${p.id}" data-field="name" value="${escapeHtml(p.name)}" maxlength="40" title="${escapeHtml(p.name)}" />
          ${statsHtml}
          ${savesHtml}
          <div class="combat-banner__actions">
            <input type="text" class="damage-input" placeholder="Dano" data-id="${p.id}" />
          </div>
          ${initiativeHtml}
        </div>
      `;
      })
      .join("");

    // Bind damage inputs
    this.DOM.banners.querySelectorAll(".damage-input").forEach((input) => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const rawValue = input.value.trim();
          if (!rawValue) return;

          let type = "damage";
          let amount = 0;

          if (rawValue.startsWith("+")) {
            type = "heal";
            amount = parseInt(rawValue.substring(1));
          } else if (rawValue.startsWith("-")) {
            type = "damage";
            amount = parseInt(rawValue.substring(1));
          } else {
            type = "damage";
            amount = parseInt(rawValue);
          }

          if (!isNaN(amount)) {
            this.triggerDamageEffect(input.dataset.id, amount, type);
            input.value = "";
          }
        }
      });
    });

    // Bind details buttons
    this.DOM.banners.querySelectorAll(".combat-banner__details").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openParticipantDetails(btn.dataset.id);
      });
    });

    // Bind remove buttons
    this.DOM.banners.querySelectorAll(".combat-banner__remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeParticipantFromCombat(btn.dataset.id);
      });
    });

    // Bind death save markers (manual edit by clicking)
    this.DOM.banners.querySelectorAll(".death-save-marker").forEach((marker) => {
      marker.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleDeathSaveMarker(
          marker.dataset.id,
          marker.dataset.kind,
          parseInt(marker.dataset.index, 10)
        );
      });
    });

    // Bind inline edit fields (delegated commit on Enter/blur)
    this.DOM.banners.querySelectorAll(".combat-banner__field").forEach((input) => {
      const commit = () => {
        if (input.dataset.field === "initiative") {
          // mantém o caminho legado da iniciativa
          if (input.value === "") return;
          const raw = parseInt(input.value, 10);
          if (Number.isNaN(raw)) return;
          const p = this.participants.find((x) => x.id === input.dataset.id);
          if (p && p.initiative === raw) return;
          this.setManualInitiative(input.dataset.id, raw);
          return;
        }
        this.commitInlineEdit(input.dataset.id, input.dataset.field, input.value);
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          // restaura valor original (não commita) e tira foco
          const p = this.participants.find((x) => x.id === input.dataset.id);
          if (p) {
            const f = input.dataset.field;
            input.value = f === "name" ? (p.name ?? "") : (p[f] ?? "");
          }
          input.blur();
        }
      });
      input.addEventListener("blur", commit);
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("dblclick", (e) => e.stopPropagation());
    });

    // Bind individual roll buttons (rolls a single d20 with 3D animation)
    this.DOM.banners.querySelectorAll(".initiative-roll-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.rollSingleInitiative(btn.dataset.id);
      });
    });

    this._renderCombatHotkeyPanel();
  }

  toggleDeathSaveMarker(id, kind, index) {
    const participant = this.participants.find((p) => p.id === id);
    if (!participant || !participant.deathSaves) return;
    const ds = participant.deathSaves;
    const field = kind === "success" ? "successes" : "failures";
    const target = index + 1; // clicar no marcador i preenche até i (i+1 marcadores no total)

    // Toggle: se já está cheio até index, esvazia até index; senão preenche até index+1
    ds[field] = ds[field] === target ? index : target;

    // Recalcular flags terminais
    ds.stabilized = ds.successes >= 3;
    ds.dead = ds.failures >= 3;
    if (ds.stabilized || ds.dead) {
      ds.active = false;
    } else if (ds.successes > 0 || ds.failures > 0) {
      ds.active = true;
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();
  }

  async removeParticipantFromCombat(id) {
    const index = this.participants.findIndex((p) => p.id === id);
    if (index === -1) return;

    const ok = await showConfirm({
      title: "Remover Participante",
      message: `Remover ${this.participants[index].name} desta luta?`,
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      confirmVariant: "primary",
      confirmIcon: "x",
    });
    if (!ok) return;

    // Adjust currentTurnIndex if necessary
    if (index < this.currentTurnIndex) {
      // Removing someone before current turn, shift index back
      this.currentTurnIndex--;
    } else if (index === this.currentTurnIndex) {
      // Removing current turn person
      if (this.currentTurnIndex >= this.participants.length - 1) {
        // They were the last ones, go to start
        this.currentTurnIndex = 0;
      }
      // If we are at the end, maybe we need to handle round change?
      // For now, let's just keep the index and the next person in list will be active.
    }

    this.participants.splice(index, 1);

    if (this.participants.length === 0) {
      this._stopCombatInternal();
      return;
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();
  }

  triggerDamageEffect(id, amount, type) {
    console.log(`Disparando efeito de ${type} (${amount}) para: ${id}`);

    const participant = this.participants.find((p) => p.id === id);
    if (participant) {
      const maxHp = Number(participant.hp) || 0;
      const currentHp = Number(participant.current_hp) || 0;

      if (type === "damage") {
        participant.current_hp = Math.max(0, currentHp - amount);
      } else if (type === "heal") {
        const cap = maxHp > 0 ? maxHp : currentHp + amount;
        participant.current_hp = Math.min(cap, currentHp + amount);
      }

      // Cura tira do estado de death save automaticamente
      if (type === "heal" && participant.current_hp > 0 && participant.deathSaves?.active) {
        participant.deathSaves = this.makeEmptyDeathSaves();
        showToast(`${participant.name} recuperou e saiu do teste de morte`, "success");
      }
    }

    // Broadcast action for animation
    window.dmCopilot.combat.broadcast("combat-action", {
      type: type,
      targetId: id,
      amount: amount,
    });

    // Check if ally fell to 0 HP — prompt for death save.
    // Fire-and-forget para não bloquear pipeline reativo de combate.
    if (
      participant &&
      type === "damage" &&
      participant.current_hp === 0 &&
      participant.affinity === "ally" &&
      !participant.deathSaves?.active &&
      !participant.deathSaves?.dead &&
      !participant.deathSaves?.stabilized
    ) {
      this._promptDeathSave(participant).catch((err) => {
        console.error("Falha ao iniciar teste de morte:", err);
      });
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();
  }

  async _promptDeathSave(participant) {
    const ok = await showConfirm({
      title: "Teste de Morte",
      message: `${participant.name} caiu a 0 HP. Iniciar teste de resistência contra morte?`,
      confirmLabel: "Iniciar Teste",
      cancelLabel: "Cancelar",
      confirmVariant: "primary",
      confirmIcon: "skull",
    });
    if (!ok) return;
    participant.deathSaves = { ...this.makeEmptyDeathSaves(), active: true };
    showToast(`Teste de resistência iniciado para ${participant.name}`, "info");
    this.renderBanners();
    this.broadcastState();
    this.updateDB();
  }

  updateInitiativePhaseUI() {
    if (!this.isActive) {
      this.DOM.btnNext?.classList.remove("hidden");
      this.DOM.btnPrev?.classList.remove("hidden");
      return;
    }

    if (this.initiativeLocked) {
      // Initiatives locked — show turn controls, disable initiative buttons
      this.DOM.btnNext?.classList.remove("hidden");
      this.DOM.btnPrev?.classList.remove("hidden");
      if (this.DOM.btnRollAllNpcInit) this.DOM.btnRollAllNpcInit.disabled = true;
      if (this.DOM.btnRollAllAllyInit) this.DOM.btnRollAllAllyInit.disabled = true;
      return;
    }

    // Initiative phase: hide turn controls, enable/disable initiative buttons
    const pendingNpcs = this.participants.filter(
      (p) =>
        (p.affinity === "enemy" || p.affinity === "neutral") &&
        (p.initiative === null || p.initiative === undefined)
    ).length;
    const pendingAllies = this.participants.filter(
      (p) => p.affinity === "ally" && (p.initiative === null || p.initiative === undefined)
    ).length;

    if (this.DOM.btnRollAllNpcInit) {
      this.DOM.btnRollAllNpcInit.disabled = pendingNpcs === 0;
    }
    if (this.DOM.btnRollAllAllyInit) {
      this.DOM.btnRollAllAllyInit.disabled = pendingAllies === 0;
    }
    this.DOM.btnNext?.classList.add("hidden");
    this.DOM.btnPrev?.classList.add("hidden");
  }

  lockInitiativeOrder() {
    if (this.initiativeLocked) return;
    // Sort descending by initiative; ties keep insertion order
    this.participants.sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));
    this.initiativeLocked = true;
    this.currentTurnIndex = 0;
    this.renderBanners();
    this.updateInitiativePhaseUI();
    this.broadcastState();
    this.updateDB();
  }

  resortByInitiative() {
    if (!this.initiativeLocked) return;
    // Rastreia pelo id para manter currentTurnIndex correto após a reordenação
    const activeId = this.participants[this.currentTurnIndex]?.id;
    this.participants.sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));
    if (activeId != null) {
      const idx = this.participants.findIndex((p) => p.id === activeId);
      if (idx >= 0) this.currentTurnIndex = idx;
    }
  }

  async maybeLockAfterRoll() {
    if (this.initiativeLocked) return;
    if (this.allInitiativesSet()) {
      this.lockInitiativeOrder();
      await this.handleTurnStart();
      showToast("Iniciativas definidas — combate começou!", "success");
    }
  }

  setManualInitiative(id, value) {
    const p = this.participants.find((x) => x.id === id);
    if (!p) return;
    p.initiative = Math.max(0, Math.min(40, value | 0));
    this.renderBanners();
    this.updateInitiativePhaseUI();
    this.broadcastState();
    this.maybeLockAfterRoll();
  }

  commitInlineEdit(id, field, raw) {
    const p = this.participants.find((x) => x.id === id);
    if (!p) return;

    let value;
    if (field === "name") {
      value = (raw ?? "").toString().trim().slice(0, 40);
      if (!value) return; // não aceita nome vazio
    } else if (field === "current_hp" || field === "hp" || field === "ca") {
      if (raw === "" || raw == null) return;
      const n = parseInt(raw, 10);
      if (Number.isNaN(n) || n < 0) return;
      value = n;
      if (field === "current_hp" && p.hp != null) value = Math.min(value, p.hp);
      if (field === "hp") {
        // se reduzir o máximo abaixo do current, ajusta current também
        if (p.current_hp != null && p.current_hp > value) p.current_hp = value;
      }
      if (field === "ca") value = Math.min(40, value);
    } else {
      return;
    }

    if (p[field] === value) return;
    p[field] = value;

    this.broadcastState();
    this.updateDB();
    // re-render diferido pra não quebrar o blur em andamento
    setTimeout(() => this.renderBanners(), 0);
  }

  async rollSingleInitiative(id) {
    const p = this.participants.find((x) => x.id === id);
    if (!p) return;
    if (!window.diceView?.rollProgrammatic) {
      // Fallback caso o DiceView não esteja disponível
      p.initiative = 1 + Math.floor(Math.random() * 20) + (Number(p.ini) || 0);
      this.renderBanners();
      this.updateInitiativePhaseUI();
      this.broadcastState();
      await this.maybeLockAfterRoll();
      return;
    }
    // total já vem pré-rolado, sincronamente. A animação 3D fica enfileirada
    // em background — o mestre pode clicar no próximo dado imediatamente.
    // total = dado bruto (sem bônus); somamos p.ini manualmente.
    const bonus = Number(p.ini) || 0;
    const { total } = window.diceView.rollProgrammatic({
      notation: "1d20",
      characterName: p.name,
      affinity: p.affinity,
      bonus,
      label: "Iniciativa",
    });
    p.initiative = total + bonus;
    this.renderBanners();
    this.updateInitiativePhaseUI();
    this.broadcastState();
    await this.maybeLockAfterRoll();
  }

  async rollAllNpcInitiative() {
    if (!this.isActive || this.initiativeLocked) return;

    const enemies = this.participants.filter(
      (p) => p.affinity === "enemy" && (p.initiative === null || p.initiative === undefined)
    );
    const neutrals = this.participants.filter(
      (p) => p.affinity === "neutral" && (p.initiative === null || p.initiative === undefined)
    );

    if (enemies.length === 0 && neutrals.length === 0) return;

    // Fallback se DiceView não estiver disponível: cai no caminho um-a-um.
    if (!window.diceView?.rollBatch) {
      for (const p of [...enemies, ...neutrals]) {
        await this.rollSingleInitiative(p.id);
      }
      return;
    }

    // Inimigos rolam juntos (vermelho), depois neutros juntos (laranja).
    // Cada batch é UMA animação 3D só, com todos os dados caindo simultaneamente.
    await this.rollAffinityBatch(enemies, "enemy");
    await this.rollAffinityBatch(neutrals, "neutral");

    this.renderBanners();
    this.updateInitiativePhaseUI();
    this.broadcastState();
    await this.maybeLockAfterRoll();
  }

  async rollAllAllyInitiative() {
    if (!this.isActive || this.initiativeLocked) return;
    const allies = this.participants.filter(
      (p) => p.affinity === "ally" && (p.initiative === null || p.initiative === undefined)
    );
    if (allies.length === 0) return;

    if (!window.diceView?.rollBatch) {
      for (const p of allies) {
        await this.rollSingleInitiative(p.id);
      }
      return;
    }

    await this.rollAffinityBatch(allies, "ally");

    this.renderBanners();
    this.updateInitiativePhaseUI();
    this.broadcastState();
    await this.maybeLockAfterRoll();
  }

  async rollAffinityBatch(group, affinity) {
    if (!group || group.length === 0) return;
    const specs = group.map((p) => ({
      notation: "1d20",
      characterName: p.name,
      affinity,
      bonus: Number(p.ini) || 0,
      label: "Iniciativa",
    }));
    const totals = await window.diceView.rollBatch(specs);
    // totals = dado bruto (sem bônus); somamos p.ini manualmente.
    group.forEach((p, i) => {
      p.initiative = totals[i] + (Number(p.ini) || 0);
    });
  }

  async nextTurn() {
    if (!this.isActive || !this.initiativeLocked) return;

    // Mark current as acted
    this.participants[this.currentTurnIndex].has_acted = 1;

    this.currentTurnIndex++;
    if (this.currentTurnIndex >= this.participants.length) {
      this.currentTurnIndex = 0;
      this.currentRound++;
      this.DOM.roundNumber.textContent = this.currentRound;
      this.logRoundChange(this.currentRound);

      // Reset acted status for new round
      this.participants.forEach((p) => (p.has_acted = 0));
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();

    await this.handleTurnStart();
  }

  prevTurn() {
    if (!this.isActive || !this.initiativeLocked) return;

    this.currentTurnIndex--;
    if (this.currentTurnIndex < 0) {
      if (this.currentRound > 1) {
        this.currentRound--;
        this.DOM.roundNumber.textContent = this.currentRound;
        this.currentTurnIndex = this.participants.length - 1;
      } else {
        this.currentTurnIndex = 0;
      }
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();
  }

  async handleTurnStart() {
    const active = this.participants[this.currentTurnIndex];
    if (!active) return;

    // Skip dead participants — only if there's at least one non-dead remaining
    if (active.deathSaves?.dead) {
      const anyAlive = this.participants.some((p) => !p.deathSaves?.dead);
      if (anyAlive) {
        await this.nextTurn();
      }
      return;
    }

    // Auto-prompt death save roll for fallen ally on their turn
    if (active.deathSaves?.active && !active.deathSaves.stabilized) {
      const value = await this.requestDeathSaveValue(active.name);
      if (value !== null) {
        this.applyDeathSaveResult(active, value);
        this.logDeathSave(active, value);
        this.renderBanners();
        this.broadcastState();
        this.updateDB();
      }
    }
  }

  logDeathSave(participant, value) {
    let detail = "";
    if (value === 20) detail = "recuperação miraculosa (HP=1)";
    else if (value === 1) detail = "💀 falha crítica (2 falhas)";
    else if (value >= 10) detail = "sucesso";
    else detail = "falha";

    this.rollHistory.unshift({
      type: "death-save",
      characterName: participant.name,
      notation: "1d20",
      total: value,
      details: `Death Save — ${detail}`,
      affinity: participant.affinity || "ally",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    });
    if (this.rollHistory.length > 50) this.rollHistory.length = 50;
  }

  async updateDB() {
    if (!this.currentEncounter) return;
    await window.dmCopilot.db.encounters.update(this.currentEncounter.id, {
      current_round: this.currentRound,
      current_turn_index: this.currentTurnIndex,
      monsters: this.participants,
      roll_history: this.rollHistory.slice(0, 50),
    });
  }

  broadcastState() {
    if (!this.isActive) return;

    // Resolve effective visibility config (encounter override or campaign default)
    const visibility = resolveEffectiveVisibility(this.currentEncounter, this.currentCampaign);

    // Transform local-image:// protocol to http for players AND apply visibility filter
    const processedParticipants = this.participants.map((p) => {
      let imageUrl = p.image;
      if (imageUrl && imageUrl.startsWith("local-image://")) {
        imageUrl = `/images/${imageUrl.replace("local-image://", "")}`;
      }
      const filtered = applyVisibilityToParticipant(p, visibility[p.affinity]);
      return { ...filtered, image: imageUrl };
    });

    // Resolve encounter background to a URL the player view (Express) can serve
    const bgValue =
      this.currentEncounter?.background_image ||
      this.encountersView?.currentEncounter?.background_image;
    const backgroundImage = this.resolveBackgroundForPlayer(bgValue);
    console.log("[broadcastState] bgValue:", bgValue, "→ player URL:", backgroundImage);

    // Resolve encounter music file for the player view
    const musicValue =
      this.currentEncounter?.music_file || this.encountersView?.currentEncounter?.music_file;
    const musicFile = musicValue ? `/music/${musicValue}` : null;

    window.dmCopilot.combat.broadcast("combat-update", {
      status: "active",
      currentRound: this.currentRound,
      // Antes de travar a ordem de iniciativa, ninguém está "no turno".
      // Mandamos -1 para que o player view não destaque ninguém.
      currentTurnIndex: this.initiativeLocked ? this.currentTurnIndex : -1,
      participants: processedParticipants,
      rollHistory: this.rollHistory,
      backgroundImage,
      musicFile,
    });
  }

  resolveBackgroundForPlayer(value) {
    if (!value) return null;
    if (value.startsWith("preset:")) {
      return `/encounter-presets/${value.slice("preset:".length)}`;
    }
    if (value.startsWith("local-image://")) {
      return `/images/${value.replace("local-image://", "")}`;
    }
    return value;
  }

  /**
   * Reset visual do combate (sem mexer em estado de memória nem DB).
   * Usado pelo _stopCombatInternal e também pelo openEncounterManager
   * antes de decidir se vai retomar combate ou mostrar pré-combate.
   */
  resetCombatUI() {
    this.DOM.btnStart?.classList.remove("hidden");
    this.DOM.btnEnd?.classList.add("hidden");
    this.DOM.btnNext?.classList.add("hidden");
    this.DOM.btnPrev?.classList.add("hidden");
    this.DOM.roundDisplay?.classList.add("hidden");
    this.DOM.arena?.classList.add("hidden");
    if (this.DOM.btnRollAllNpcInit) this.DOM.btnRollAllNpcInit.disabled = false;
    if (this.DOM.btnRollAllAllyInit) this.DOM.btnRollAllAllyInit.disabled = false;
    if (this.DOM.banners) this.DOM.banners.innerHTML = "";
  }

  async _stopCombatInternal() {
    try {
      window.dmCopilot.combat.broadcast("combat-update", { status: "inactive" });
    } catch (err) {
      console.warn("Falha ao broadcastar fim de combate:", err);
    }

    this.isActive = false;
    this.initiativeLocked = false;
    window.presentationController?.clearPresentation();

    this.resetCombatUI();

    this.encountersView.organizeParticipants();
    this.encountersView.renderParticipants();

    try {
      await window.dmCopilot.db.encounters.update(this.currentEncounter.id, {
        status: "finished",
      });
    } catch (err) {
      console.error("Error ending combat:", err);
    }

    this._renderCombatHotkeyPanel();
  }

  /**
   * Re-hidrata o combate a partir de um encounter persistido no DB
   * (status='active') e ativa a UI de combate. Usado quando o mestre reabre
   * um encontro ativo (mesmo após restart da app).
   */
  async resumeFromEncounter(encounter) {
    // Carrega visibility config (campanha) — necessário para broadcastState filtrar.
    if (!this.currentCampaign || this.currentCampaign.id !== encounter.campaign_id) {
      try {
        this.currentCampaign = await window.dmCopilot.db.campaigns.getById(encounter.campaign_id);
      } catch (err) {
        console.warn("Resume: falha ao carregar campanha:", err);
        this.currentCampaign = null;
      }
    }

    // Mesma sessão (memória pode ter dado mais recente que o último DB write)?
    // Caso contrário re-hidrata do DB.
    const sameSession = this.isActive && this.currentEncounter?.id === encounter.id;
    if (!sameSession) {
      this.currentEncounter = encounter;
      this.participants = (encounter.monsters || []).map((p) => ({
        ...p,
        deathSaves: p.deathSaves || this.makeEmptyDeathSaves(),
      }));
      this.currentRound = encounter.current_round || 1;
      this.currentTurnIndex = encounter.current_turn_index || 0;
      this.rollHistory = Array.isArray(encounter.roll_history) ? encounter.roll_history : [];
      // initiativeLocked é DERIVADO: se todos têm initiative !== null, está travado.
      this.initiativeLocked =
        this.participants.length > 0 &&
        this.participants.every((p) => p.initiative !== null && p.initiative !== undefined);
      this.isActive = true;
    }

    // UI: ativa modo combate.
    this.DOM.btnStart?.classList.add("hidden");
    this.DOM.btnEnd?.classList.remove("hidden");
    this.DOM.roundDisplay?.classList.remove("hidden");
    this.DOM.arena?.classList.remove("hidden");
    if (this.DOM.roundNumber) this.DOM.roundNumber.textContent = this.currentRound;
    Object.values(this.DOM.sections).forEach((s) => s.classList.add("hidden"));

    try {
      const { ip, port } = await window.dmCopilot.combat.getInfo();
      this._setPlayerLinkUrl(`http://${ip}:${port}`);
    } catch (err) {
      console.warn("Resume: falha ao carregar info do servidor:", err);
    }

    this.renderBanners();
    this.updateInitiativePhaseUI();
    this.broadcastState();

    // Adota a presentation existente sem disparar start (já estamos ativos).
    if (window.presentationController?.adoptPresentation) {
      window.presentationController.adoptPresentation({
        type: "combat",
        label: encounter.name || "Combate",
        stop: () => this._stopCombatInternal(),
      });
    }
  }

  async endCombat() {
    const ok = await showConfirm({
      title: "Finalizar Encontro",
      message:
        "Deseja finalizar este encontro? O combate será encerrado para você e para os jogadores conectados.",
      confirmLabel: "Finalizar",
      cancelLabel: "Cancelar",
      confirmVariant: "danger",
      confirmIcon: "flag",
    });
    if (!ok) return;
    await this._stopCombatInternal();
  }

  getActiveParticipant() {
    if (!this.isActive) return null;
    return this.participants[this.currentTurnIndex];
  }

  _renderCombatHotkeyPanel() {
    const panel = document.getElementById("combat-hotkey-panel");
    if (!panel) return;
    const p = this.getActiveParticipant();
    if (!p || !this.isActive) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    panel.classList.toggle("combat-hotkey-panel--minimized", !!this._hotkeyPanelMinimized);

    const minBtn = document.getElementById("btn-combat-hotkey-minimize");
    if (minBtn) {
      minBtn.innerHTML = icon(this._hotkeyPanelMinimized ? "plus" : "minus", { size: 16 });
      minBtn.title = this._hotkeyPanelMinimized ? "Expandir" : "Minimizar";
      minBtn.setAttribute("aria-label", this._hotkeyPanelMinimized ? "Expandir" : "Minimizar");
    }

    document.getElementById("combat-hotkey-panel-name").textContent = p.name || "—";

    // Abilities
    const abilitiesEl = document.getElementById("combat-hotkey-panel-abilities");
    if (abilitiesEl) {
      const abilities = [
        ["STR", "str"],
        ["DEX", "dex"],
        ["CON", "con"],
        ["INT", "int"],
        ["WIS", "wis"],
        ["CHA", "cha"],
      ];
      abilitiesEl.innerHTML = abilities
        .map(([label, key]) => {
          const score = p[key];
          const mod = score != null ? formatModifier(score) : "—";
          return `<button type="button" class="combat-hotkey-panel__btn-ability" data-ability="${key}" title="Teste de ${label}">
            <span class="combat-hotkey-panel__btn-ability-label">${label}</span>
            <span class="combat-hotkey-panel__btn-ability-mod">${mod}</span>
          </button>`;
        })
        .join("");
    }

    // Saves (only proficiency saves; sem proficiência seria igual a clicar no ability)
    const savesSection = document.getElementById("combat-hotkey-panel-saves-section");
    const savesEl = document.getElementById("combat-hotkey-panel-saves");
    const saves = Array.isArray(p.saves) ? p.saves : [];
    if (savesSection && savesEl) {
      if (saves.length === 0) {
        savesSection.classList.add("hidden");
      } else {
        savesSection.classList.remove("hidden");
        const ABILITY_LABELS = {
          str: "STR",
          dex: "DEX",
          con: "CON",
          int: "INT",
          wis: "WIS",
          cha: "CHA",
        };
        savesEl.innerHTML = saves
          .map((s) => {
            const m = s.modifier >= 0 ? `+${s.modifier}` : `${s.modifier}`;
            const label = ABILITY_LABELS[s.ability] || (s.ability || "").toUpperCase();
            return `<button type="button" class="combat-hotkey-panel__btn-ability" data-save="${s.ability}" data-save-modifier="${s.modifier}" title="Salvaguarda de ${label}">
              <span class="combat-hotkey-panel__btn-ability-label">${label}</span>
              <span class="combat-hotkey-panel__btn-ability-mod">${m}</span>
            </button>`;
          })
          .join("");
      }
    }

    // Actions
    const actionsEl = document.getElementById("combat-hotkey-panel-actions");
    if (actionsEl) {
      const actions = Array.isArray(p.actions) ? p.actions : [];
      if (actions.length === 0) {
        actionsEl.innerHTML = `<div class="combat-hotkey-panel__empty">Nenhuma ação cadastrada.</div>`;
      } else {
        const kindLabels = {
          special: "Habilidades especiais",
          skill: "Perícias",
          action: "Ações",
          reaction: "Reações",
          legendary: "Ações lendárias",
        };
        let lastKind = null;
        actionsEl.innerHTML = actions
          .map((a, i) => {
            const curKind = a.kind || "action";
            let dividerHtml = "";
            if (curKind !== lastKind) {
              dividerHtml = `<div class="combat-hotkey-panel__action-divider combat-hotkey-panel__action-divider--${curKind}">${kindLabels[curKind] || ""}</div>`;
              lastKind = curKind;
            }
            const hasAttack = typeof a.modifier === "number";
            const hasDamage = !!a.damage;
            const kindClass =
              a.kind === "special" || a.kind === "skill"
                ? " combat-hotkey-panel__action-attack--special"
                : a.kind === "legendary"
                  ? " combat-hotkey-panel__action-attack--legendary"
                  : a.kind === "reaction"
                    ? " combat-hotkey-panel__action-attack--reaction"
                    : "";
            const dmgBtn = hasDamage
              ? `<button type="button" class="combat-hotkey-panel__action-damage" data-action-index="${i}" data-roll="damage" title="Rolar dano">${a.damage}</button>`
              : "";
            if (hasAttack) {
              const mod = a.modifier >= 0 ? `+${a.modifier}` : `${a.modifier}`;
              return dividerHtml + `<div class="combat-hotkey-panel__action-row">
                <button type="button" class="combat-hotkey-panel__action-attack${kindClass}" data-action-index="${i}" data-roll="attack" title="Rolar ataque">
                  <span class="combat-hotkey-panel__action-name">${a.name}</span>
                  <span class="combat-hotkey-panel__action-mod">${mod}</span>
                </button>
                ${dmgBtn}
              </div>`;
            }
            return dividerHtml + `<div class="combat-hotkey-panel__action-row">
              <button type="button" class="combat-hotkey-panel__action-attack combat-hotkey-panel__action-attack--info${kindClass}" data-action-index="${i}" data-roll="info" title="Logar descrição">
                <span class="combat-hotkey-panel__action-name">${a.name}</span>
              </button>
              ${dmgBtn}
            </div>`;
          })
          .join("");
      }
    }
    this._renderCombatSummaryPanel();
  }

  _renderCombatSummaryPanel() {
    const panel = document.getElementById("combat-summary-panel");
    if (!panel) return;
    const p = this.getActiveParticipant();
    // Esconde quando: sem combate, sem turno, ou hotkey minimizado
    if (!p || !this.isActive || this._hotkeyPanelMinimized) {
      panel.classList.add("hidden");
      return;
    }
    const s = p.summary;
    if (!s) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");

    const body = document.getElementById("combat-summary-panel-body");
    if (!body) return;

    const groups = [];

    // Grupo 1: Tipo / Tamanho / Alinhamento
    const baseRows = [];
    if (s.type)
      baseRows.push({
        label: "Tipo",
        value: s.subtype ? `${s.type} (${s.subtype})` : s.type,
      });
    if (s.size) baseRows.push({ label: "Tamanho", value: s.size });
    if (s.alignment) baseRows.push({ label: "Alinhamento", value: s.alignment });
    if (baseRows.length) groups.push(baseRows);

    // Grupo 2: Desafio
    if (s.cr != null) {
      const crFormatted =
        s.cr === 0.125
          ? "1/8"
          : s.cr === 0.25
            ? "1/4"
            : s.cr === 0.5
              ? "1/2"
              : String(s.cr);
      const xpFormatted = s.xp != null ? s.xp.toLocaleString("pt-BR") : null;
      const value = xpFormatted ? `${crFormatted} (${xpFormatted} XP)` : crFormatted;
      groups.push([{ label: "Desafio", value }]);
    }

    // Grupo 3: Velocidades
    if (s.speeds && Object.keys(s.speeds).length > 0) {
      const lines = Object.entries(s.speeds)
        .map(([k, v]) => `${k} ${v}`)
        .join("<br>");
      groups.push([{ label: "Velocidade", valueBlock: lines }]);
    }

    // Grupo 4: Sentidos
    if (s.senses && Object.keys(s.senses).length > 0) {
      const lines = Object.entries(s.senses)
        .map(([k, v]) => `${k} ${v}`)
        .join("<br>");
      groups.push([{ label: "Sentidos", valueBlock: lines }]);
    }

    // Grupo 5: Idiomas
    if (s.languages) {
      groups.push([{ label: "Idiomas", valueBlock: s.languages }]);
    }

    // Grupo 6: Vulnerabilidades / Resistências / Imunidades
    const defRows = [];
    if (Array.isArray(s.vulnerabilities) && s.vulnerabilities.length) {
      defRows.push({ label: "Vulnerabilidades", valueBlock: s.vulnerabilities.join(", ") });
    }
    if (Array.isArray(s.resistances) && s.resistances.length) {
      defRows.push({ label: "Resistências", valueBlock: s.resistances.join("; ") });
    }
    const dmgImm = Array.isArray(s.damage_immunities) ? s.damage_immunities : [];
    const condImm = Array.isArray(s.condition_immunities) ? s.condition_immunities : [];
    if (dmgImm.length || condImm.length) {
      const parts = [];
      if (dmgImm.length) parts.push(`Dano: ${dmgImm.join(", ")}`);
      if (condImm.length) parts.push(`Condições: ${condImm.join(", ")}`);
      defRows.push({ label: "Imunidades", valueBlock: parts.join("<br>") });
    }
    if (defRows.length) groups.push(defRows);

    body.innerHTML = groups
      .map((rows) => {
        const inner = rows
          .map((r) => {
            if (r.valueBlock) {
              return `<div class="combat-summary-panel__row" style="flex-direction:column; align-items:flex-start; gap:2px">
                <span class="combat-summary-panel__label">${r.label}</span>
                <span class="combat-summary-panel__value-block">${r.valueBlock}</span>
              </div>`;
            }
            return `<div class="combat-summary-panel__row">
              <span class="combat-summary-panel__label">${r.label}</span>
              <span class="combat-summary-panel__value">${r.value}</span>
            </div>`;
          })
          .join("");
        return `<div class="combat-summary-panel__group">${inner}</div>`;
      })
      .join("");
  }

  _onHotkeyPanelClick(e) {
    const p = this.getActiveParticipant();
    if (!p) return;

    const saveBtn = e.target.closest("[data-save]");
    if (saveBtn) {
      const ability = saveBtn.dataset.save;
      const mod = parseInt(saveBtn.dataset.saveModifier, 10) || 0;
      const labelMap = {
        str: "Salvaguarda de Força",
        dex: "Salvaguarda de Destreza",
        con: "Salvaguarda de Constituição",
        int: "Salvaguarda de Inteligência",
        wis: "Salvaguarda de Sabedoria",
        cha: "Salvaguarda de Carisma",
      };
      window.diceView?.rollProgrammatic({
        notation: "1d20",
        bonus: mod,
        characterName: p.name,
        affinity: p.affinity,
        label: labelMap[ability] || `Salvaguarda de ${(ability || "").toUpperCase()}`,
      });
      return;
    }

    const abilityBtn = e.target.closest(".combat-hotkey-panel__btn-ability");
    if (abilityBtn) {
      const key = abilityBtn.dataset.ability;
      const score = p[key];
      if (score == null) return;
      const labelMap = {
        str: "Teste de Força",
        dex: "Teste de Destreza",
        con: "Teste de Constituição",
        int: "Teste de Inteligência",
        wis: "Teste de Sabedoria",
        cha: "Teste de Carisma",
      };
      window.diceView?.rollProgrammatic({
        notation: "1d20",
        bonus: modifier(score),
        characterName: p.name,
        affinity: p.affinity,
        label: labelMap[key] || `Teste de ${key.toUpperCase()}`,
      });
      return;
    }

    const actionBtn = e.target.closest("[data-roll]");
    if (!actionBtn) return;
    const index = parseInt(actionBtn.dataset.actionIndex, 10);
    const action = Array.isArray(p.actions) ? p.actions[index] : null;
    if (!action) return;

    const rollType = actionBtn.dataset.roll;
    if (rollType === "attack") {
      window.diceView?.rollProgrammatic({
        notation: "1d20",
        bonus: action.modifier ?? 0,
        characterName: p.name,
        affinity: p.affinity,
        label: `${action.name} — Ataque`,
      });
    } else if (rollType === "info") {
      this.logRoll({
        characterName: p.name,
        notation: action.name,
        total: "—",
        details: action.desc || "",
      });
    } else if (rollType === "damage" && action.damage) {
      window.diceView?.rollProgrammatic({
        notation: action.damage,
        bonus: 0,
        characterName: p.name,
        affinity: p.affinity,
        label: `${action.name} — Dano`,
      });
    }
  }

  logRoll(data) {
    // data: { characterName, notation, total, details }
    const participant = this.participants.find((p) => p.name === data.characterName);
    const affinity = participant ? participant.affinity : "neutral";

    this.rollHistory.unshift({
      ...data,
      affinity,
      timestamp: new Date().toLocaleTimeString(),
    });

    // Keep only last 20
    if (this.rollHistory.length > 20) {
      this.rollHistory.pop();
    }

    this.broadcastState();
    this.updateDB();
  }

  logRoundChange(round) {
    this.rollHistory.unshift({
      type: "round-change",
      round: round,
      timestamp: new Date().toLocaleTimeString(),
    });

    // Keep only last 20
    if (this.rollHistory.length > 20) {
      this.rollHistory.pop();
    }

    this.broadcastState();
    this.updateDB();
  }

  openQuickEditModal(id) {
    const p = this.participants.find((x) => x.id === id);
    if (!p) return;
    this.editingParticipantId = id;
    this.editingImageBuffer = p.image ?? null;
    if (this.DOM.quickEditName) this.DOM.quickEditName.value = p.name ?? "";
    if (this.DOM.quickEditCurrentHp) this.DOM.quickEditCurrentHp.value = p.current_hp ?? "";
    if (this.DOM.quickEditHp) this.DOM.quickEditHp.value = p.hp ?? "";
    if (this.DOM.quickEditCa) this.DOM.quickEditCa.value = p.ca ?? "";
    if (this.DOM.quickEditInitiative) this.DOM.quickEditInitiative.value = p.initiative ?? "";
    if (this.DOM.quickEditImagePreview) {
      this.DOM.quickEditImagePreview.src = p.image || "";
      this.DOM.quickEditImagePreview.style.visibility = p.image ? "visible" : "hidden";
    }
    document
      .querySelectorAll('input[name="quick-edit-affinity"]')
      .forEach((r) => (r.checked = r.value === p.affinity));
    this.DOM.quickEditModal?.classList.remove("hidden");
  }

  closeQuickEditModal() {
    this.editingParticipantId = null;
    this.editingImageBuffer = null;
    this.DOM.quickEditModal?.classList.add("hidden");
  }

  saveQuickEdit() {
    const id = this.editingParticipantId;
    if (!id) return;
    const p = this.participants.find((x) => x.id === id);
    if (!p) return;

    const name = (this.DOM.quickEditName?.value ?? "").trim().slice(0, 40);
    if (name) p.name = name;

    const currentHp = parseInt(this.DOM.quickEditCurrentHp?.value, 10);
    const hp = parseInt(this.DOM.quickEditHp?.value, 10);
    const ca = parseInt(this.DOM.quickEditCa?.value, 10);
    const initiative = parseInt(this.DOM.quickEditInitiative?.value, 10);

    if (!Number.isNaN(hp) && hp >= 0) p.hp = hp;
    if (!Number.isNaN(currentHp) && currentHp >= 0) {
      p.current_hp = p.hp != null ? Math.min(currentHp, p.hp) : currentHp;
    }
    if (!Number.isNaN(ca) && ca >= 0) p.ca = Math.min(40, ca);
    if (!Number.isNaN(initiative) && initiative >= 0) p.initiative = Math.min(40, initiative);

    const affRadio = document.querySelector('input[name="quick-edit-affinity"]:checked');
    if (affRadio && ["ally", "neutral", "enemy"].includes(affRadio.value)) {
      p.affinity = affRadio.value;
    }

    if (this.editingImageBuffer !== undefined) {
      p.image = this.editingImageBuffer;
    }

    this.resortByInitiative();
    this.renderBanners();
    this.broadcastState();
    this.updateDB();
    // se houver método de re-render das colunas (allies/neutrals/enemies), chame aqui também
    if (typeof this.renderEncounterColumns === "function") this.renderEncounterColumns();

    this.closeQuickEditModal();
  }

  handleQuickEditResetActed() {
    const id = this.editingParticipantId;
    if (!id) return;
    const p = this.participants.find((x) => x.id === id);
    if (!p) return;
    p.has_acted = 0;
    this.renderBanners();
    this.broadcastState();
    this.updateDB();
  }

  handleQuickEditResetSaves() {
    const id = this.editingParticipantId;
    if (!id) return;
    const p = this.participants.find((x) => x.id === id);
    if (!p) return;
    p.deathSaves = { active: false, successes: 0, failures: 0, stabilized: false, dead: false };
    this.renderBanners();
    this.broadcastState();
    this.updateDB();
  }

  async pickImageForQuickEdit() {
    // Usa dialogs.openFile para selecionar o arquivo, processa via canvas
    // (mesmo pipeline de characters-view.js) e salva via db.characters.saveImage.
    if (!window.dmCopilot?.dialogs?.openFile) {
      console.warn("pickImageForQuickEdit: dialogs.openFile não disponível");
      return;
    }
    const result = await window.dmCopilot.dialogs.openFile({
      filters: [{ name: "Imagens", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }],
      properties: ["openFile"],
    });
    if (!result || result.canceled || !result.filePaths?.[0]) return;
    const filePath = result.filePaths[0];

    // Carrega e processa a imagem via canvas (resize + webp)
    try {
      const buffer = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = (height / width) * MAX_SIZE;
              width = MAX_SIZE;
            } else {
              width = (width / height) * MAX_SIZE;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) blob.arrayBuffer().then(resolve);
              else reject(new Error("Falha ao exportar imagem"));
            },
            "image/webp",
            0.85
          );
        };
        img.onerror = () => reject(new Error("Erro ao carregar imagem"));
        // Usa o protocolo local-image:// para carregar o arquivo selecionado
        img.src = `local-image://${filePath.replace(/\\/g, "/")}`;
      });

      const relativePath = await window.dmCopilot.db.characters.saveImage(buffer);
      const imageUrl = `local-image://${relativePath}`;
      this.editingImageBuffer = imageUrl;
      if (this.DOM.quickEditImagePreview) {
        this.DOM.quickEditImagePreview.src = imageUrl;
        this.DOM.quickEditImagePreview.style.visibility = "visible";
      }
    } catch (err) {
      console.error("Erro ao processar imagem para edição rápida:", err);
    }
  }

  openParticipantDetails(id) {
    const p = this.participants.find((x) => String(x.id) === String(id));
    if (!p) return;

    this._detailsTargetId = p.id;

    document.getElementById("details-modal-name").textContent = p.name || "—";
    document.getElementById("details-cr").value = p.cr ?? "";
    document.getElementById("details-current-hp").value = p.current_hp ?? p.hp ?? 0;
    document.getElementById("details-hp").value = p.hp ?? 0;
    document.getElementById("details-ca").value = p.ca ?? p.ac ?? 10;
    document.getElementById("details-ini").value = p.initiative ?? p.ini ?? 0;

    const abilities = ["str", "dex", "con", "int", "wis", "cha"];
    abilities.forEach((ab) => {
      const input = document.getElementById(`details-${ab}`);
      const mod = document.getElementById(`details-${ab}-mod`);
      if (!input || !mod) return;
      input.value = p[ab] ?? "";
      mod.textContent = formatModifier(p[ab]);
    });

    this._renderDetailsActions(p.actions || []);
    this.DOM.participantDetailsModal?.classList.remove("hidden");
  }

  closeParticipantDetails() {
    this._detailsTargetId = null;
    this.DOM.participantDetailsModal?.classList.add("hidden");
  }

  saveParticipantDetails() {
    const id = this._detailsTargetId;
    if (id == null) return;

    const p = this.participants.find((x) => String(x.id) === String(id));
    if (!p) {
      this.closeParticipantDetails();
      return;
    }

    // Stats principais
    const cr = document.getElementById("details-cr").value.trim();
    p.cr = cr === "" ? null : cr;
    p.current_hp = parseIntOr(document.getElementById("details-current-hp").value, p.current_hp ?? 0);
    p.hp = parseIntOr(document.getElementById("details-hp").value, p.hp ?? 0);
    // CA: o banner usa "ca" como nome do campo. Mantemos consistência.
    p.ca = parseIntOr(document.getElementById("details-ca").value, p.ca ?? p.ac ?? 10);
    // Iniciativa: "initiative" durante combate; "ini" fora. Atualiza ambos pra cobrir os dois caminhos.
    const iniValue = parseIntOr(document.getElementById("details-ini").value, 0);
    p.initiative = iniValue;
    p.ini = iniValue;

    // Ability scores
    ["str", "dex", "con", "int", "wis", "cha"].forEach((ab) => {
      const v = document.getElementById(`details-${ab}`).value;
      const n = parseInt(v, 10);
      p[ab] = Number.isFinite(n) ? n : null;
    });

    // Coletar ações
    const list = document.getElementById("details-actions-list");
    const actions = [];
    list?.querySelectorAll(".participant-details__action").forEach((row) => {
      const name = row.querySelector(".participant-details__action-name")?.value.trim() || "";
      if (!name) return; // skip rows sem nome
      const modRaw = row.querySelector(".participant-details__action-mod")?.value;
      const dmg = row.querySelector(".participant-details__action-damage")?.value.trim() || "";
      const mod = parseInt(modRaw, 10);
      actions.push({
        name,
        modifier: Number.isFinite(mod) ? mod : 0,
        damage: dmg || null,
      });
    });
    p.actions = actions;

    this._renderCombatHotkeyPanel();
    this.closeParticipantDetails();
    this.resortByInitiative();
    this.renderBanners();
    // Persiste no DB do encontro (segue padrão de saveQuickEdit)
    this.updateDB?.();
  }

  _renderDetailsActions(actions) {
    const list = document.getElementById("details-actions-list");
    if (!list) return;
    list.innerHTML = "";
    actions.forEach((a, i) => list.appendChild(this._makeActionRow(a, i)));
  }

  _makeActionRow(action = {}, index = 0) {
    const row = document.createElement("div");
    row.className = "participant-details__action";
    row.dataset.actionIndex = String(index);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "participant-details__action-name";
    nameInput.placeholder = "Nome da ação";
    nameInput.maxLength = 40;
    nameInput.value = action.name || "";

    const modInput = document.createElement("input");
    modInput.type = "number";
    modInput.className = "participant-details__action-mod";
    modInput.placeholder = "0";
    modInput.value = action.modifier ?? "";

    const dmgInput = document.createElement("input");
    dmgInput.type = "text";
    dmgInput.className = "participant-details__action-damage";
    dmgInput.placeholder = "2d6+1 ou 1d6+1d8+1";
    dmgInput.value = action.damage || "";

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "participant-details__action-remove";
    rm.setAttribute("aria-label", "Remover ação");
    rm.innerHTML = icon("x", { size: 14 });
    rm.addEventListener("click", () => row.remove());

    row.appendChild(nameInput);
    row.appendChild(modInput);
    row.appendChild(dmgInput);
    row.appendChild(rm);
    return row;
  }

  _addNewAction() {
    const list = document.getElementById("details-actions-list");
    if (!list) return;
    const index = list.children.length;
    list.appendChild(this._makeActionRow({}, index));
  }
}
