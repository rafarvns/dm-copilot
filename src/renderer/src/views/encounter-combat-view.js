/**
 * DM Copilot - Encounter Combat View
 * Manages active combat, turns, and real-time syncing
 */

import { showToast } from "../core/toast.js";
import { icon } from "../core/icons.js";
import { truncate, escapeHtml } from "../core/format.js";
import {
  resolveEffectiveVisibility,
  applyVisibilityToParticipant,
} from "../core/combat-visibility.js";

export default class EncounterCombatView {
  constructor(encountersView) {
    this.encountersView = encountersView;
    this.isActive = false;
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
      serverLink: document.getElementById("combat-server-link"),
      linkText: document.getElementById("player-link-text"),
      roundDisplay: document.getElementById("combat-round-display"),
      roundNumber: document.getElementById("current-round-number"),

      // Initiative phase bar
      initiativeBar: document.getElementById("combat-initiative-bar"),
      initiativeBarHint: document.getElementById("initiative-bar-hint"),
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

    // Click to copy link
    this.DOM.linkText?.addEventListener("click", () => {
      const text = this.DOM.linkText.textContent;
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          showToast("Link copiado para o clipboard!");
        });
      }
    });

    // Show server link immediately (server auto-starts with the app)
    if (window.dmCopilot?.combat) {
      window.dmCopilot.combat
        .getInfo()
        .then(({ ip, port }) => {
          if (this.DOM.linkText) this.DOM.linkText.textContent = `http://${ip}:${port}`;
          this.DOM.serverLink?.classList.remove("hidden");
        })
        .catch(() => {});
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
      alert("Adicione participantes antes de iniciar o combate.");
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
      this.DOM.linkText.textContent = `http://${ip}:${port}`;
      this.DOM.serverLink.classList.remove("hidden");
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
          id: cardId,
          name: card.querySelector(".participant-card__name").textContent.trim(),
          image: imgEl ? imgEl.src : null,
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
            <input type="number" class="initiative-input" placeholder="—"
                   data-id="${p.id}" min="0" max="40" step="1" value="${initValue}" />
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
          ? `<span class="combat-banner__hp ${hpLow ? "combat-banner__hp--low" : ""}"><span class="combat-banner__hp-icon">${icon("heart")}</span> ${p.current_hp}/${p.hp}</span>`
          : "";
        const caHtml = hasCa
          ? `<span class="combat-banner__ca"><span class="combat-banner__ca-icon">${icon("shield")}</span> ${p.ca}</span>`
          : "";
        const statsHtml =
          hasHp || hasCa ? `<div class="combat-banner__stats">${hpHtml}${caHtml}</div>` : "";

        return `
        <div class="combat-banner ${isActive ? "combat-banner--active" : ""} ${hasActed ? "combat-banner--acted" : ""} ${isDead ? "combat-banner--dead" : ""}" data-id="${p.id}">
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
          <div class="combat-banner__name" title="${escapeHtml(p.name)}">${escapeHtml(truncate(p.name, 24))}</div>
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

    // Bind initiative inputs (Enter confirms manual value)
    this.DOM.banners.querySelectorAll(".initiative-input").forEach((input) => {
      const commit = () => {
        if (input.value === "") return;
        const raw = parseInt(input.value, 10);
        if (Number.isNaN(raw)) return;
        const p = this.participants.find((x) => x.id === input.dataset.id);
        if (p && p.initiative === raw) return; // valor inalterado, evita re-render
        this.setManualInitiative(input.dataset.id, raw);
      };
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") commit();
      });
      input.addEventListener("blur", commit);
    });

    // Bind individual roll buttons (rolls a single d20 with 3D animation)
    this.DOM.banners.querySelectorAll(".initiative-roll-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.rollSingleInitiative(btn.dataset.id);
      });
    });
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

  removeParticipantFromCombat(id) {
    const index = this.participants.findIndex((p) => p.id === id);
    if (index === -1) return;

    if (!confirm(`Remover ${this.participants[index].name} desta luta?`)) return;

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

    // Check if ally fell to 0 HP — prompt for death save
    if (
      participant &&
      type === "damage" &&
      participant.current_hp === 0 &&
      participant.affinity === "ally" &&
      !participant.deathSaves?.active &&
      !participant.deathSaves?.dead &&
      !participant.deathSaves?.stabilized
    ) {
      const start = window.confirm(
        `${participant.name} caiu a 0 HP. Iniciar teste de resistência contra morte?`
      );
      if (start) {
        participant.deathSaves = { ...this.makeEmptyDeathSaves(), active: true };
        showToast(`Teste de resistência iniciado para ${participant.name}`, "info");
      }
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();
  }

  updateInitiativePhaseUI() {
    if (!this.DOM.initiativeBar) return;

    if (!this.isActive) {
      this.DOM.initiativeBar.classList.add("hidden");
      this.DOM.btnNext?.classList.remove("hidden");
      this.DOM.btnPrev?.classList.remove("hidden");
      return;
    }

    if (this.initiativeLocked) {
      this.DOM.initiativeBar.classList.add("hidden");
      this.DOM.btnNext?.classList.remove("hidden");
      this.DOM.btnPrev?.classList.remove("hidden");
      return;
    }

    // Em fase de iniciativa: mostra a barra e esconde os controles de turno
    const pendingNpcs = this.participants.filter(
      (p) =>
        (p.affinity === "enemy" || p.affinity === "neutral") &&
        (p.initiative === null || p.initiative === undefined)
    ).length;
    const pendingAllies = this.participants.filter(
      (p) => p.affinity === "ally" && (p.initiative === null || p.initiative === undefined)
    ).length;

    this.DOM.initiativeBar.classList.remove("hidden");
    if (this.DOM.btnRollAllNpcInit) {
      this.DOM.btnRollAllNpcInit.disabled = pendingNpcs === 0;
    }
    if (this.DOM.btnRollAllAllyInit) {
      this.DOM.btnRollAllAllyInit.disabled = pendingAllies === 0;
    }
    if (this.DOM.initiativeBarHint) {
      if (pendingNpcs > 0 && pendingAllies > 0) {
        this.DOM.initiativeBarHint.textContent = `Faltam ${pendingNpcs} NPC(s) e ${pendingAllies} jogador(es) para definir iniciativa.`;
      } else if (pendingNpcs > 0) {
        this.DOM.initiativeBarHint.textContent = `Falta(m) ${pendingNpcs} NPC(s) para rolar iniciativa.`;
      } else if (pendingAllies > 0) {
        this.DOM.initiativeBarHint.textContent = `Aguardando iniciativa dos jogadores (${pendingAllies}).`;
      } else {
        this.DOM.initiativeBarHint.textContent = "Pronto para iniciar os turnos!";
      }
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

  async rollSingleInitiative(id) {
    const p = this.participants.find((x) => x.id === id);
    if (!p) return;
    if (!window.diceView?.rollProgrammatic) {
      // Fallback caso o DiceView não esteja disponível
      p.initiative = 1 + Math.floor(Math.random() * 20);
      this.renderBanners();
      this.updateInitiativePhaseUI();
      this.broadcastState();
      await this.maybeLockAfterRoll();
      return;
    }
    // total já vem pré-rolado, sincronamente. A animação 3D fica enfileirada
    // em background — o mestre pode clicar no próximo dado imediatamente.
    const { total } = window.diceView.rollProgrammatic({
      notation: "1d20",
      characterName: p.name,
      affinity: p.affinity,
      label: "Iniciativa",
    });
    p.initiative = total;
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
      label: "Iniciativa",
    }));
    const totals = await window.diceView.rollBatch(specs);
    group.forEach((p, i) => {
      p.initiative = totals[i];
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
    this.DOM.initiativeBar?.classList.add("hidden");
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
      if (this.DOM.linkText) this.DOM.linkText.textContent = `http://${ip}:${port}`;
      this.DOM.serverLink?.classList.remove("hidden");
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
    if (!confirm("Deseja finalizar este encontro?")) return;
    await this._stopCombatInternal();
  }

  getActiveParticipant() {
    if (!this.isActive) return null;
    return this.participants[this.currentTurnIndex];
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
}
