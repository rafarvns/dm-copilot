/**
 * DM Copilot - Encounter Combat View
 * Manages active combat, turns, and real-time syncing
 */

import { showToast } from "../core/toast.js";
import {
  resolveEffectiveVisibility,
  applyVisibilityToParticipant
} from "../core/combat-visibility.js";

export default class EncounterCombatView {
  constructor(encountersView) {
    this.encountersView = encountersView;
    this.isActive = false;
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
      
      // Initiative Modal
      initModal: document.getElementById("modal-initiative"),
      initPrompt: document.getElementById("initiative-prompt-text"),
      initInput: document.getElementById("input-initiative-value"),
      btnConfirmInit: document.getElementById("btn-confirm-initiative"),
      btnRollInit: document.getElementById("btn-roll-initiative"),
      btnCloseInit: document.getElementById("btn-close-initiative-modal"),

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
        enemies: document.getElementById("section-enemies")
      }
    };
  }

  bindEvents() {
    this.DOM.btnStart?.addEventListener("click", () => this.startCombat());
    this.DOM.btnEnd?.addEventListener("click", () => this.endCombat());
    this.DOM.btnNext?.addEventListener("click", () => this.nextTurn());
    this.DOM.btnPrev?.addEventListener("click", () => this.prevTurn());

    // Modal Close
    this.DOM.btnCloseInit?.addEventListener("click", () => this.cancelInitiative?.());

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
      window.dmCopilot.combat.getInfo().then(({ ip, port }) => {
        if (this.DOM.linkText) this.DOM.linkText.textContent = `http://${ip}:${port}`;
        this.DOM.serverLink?.classList.remove("hidden");
      }).catch(() => {});
    }
  }

  async startCombat() {
    this.currentEncounter = this.encountersView.currentEncounter;
    if (!this.currentEncounter) return;

    try {
      this.currentCampaign = await window.dmCopilot.db.campaigns.getById(this.currentEncounter.campaign_id);
    } catch (err) {
      console.warn("Falha ao carregar campanha para visibility config:", err);
      this.currentCampaign = null;
    }

    this.participants = this.gatherParticipants();
    if (this.participants.length === 0) {
      alert("Adicione participantes antes de iniciar o combate.");
      return;
    }

    await this.handleInitiatives();

    await window.presentationController.requestPresentation({
      type: 'combat',
      label: this.currentEncounter.name || 'Combate',
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
        status: 'active',
        current_round: 1,
        current_turn_index: 0
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
    this.currentRound = 1;
    this.currentTurnIndex = 0;
    this.logRoundChange(1);

    this.DOM.btnStart.classList.add("hidden");
    this.DOM.btnEnd.classList.remove("hidden");
    this.DOM.roundDisplay.classList.remove("hidden");
    this.DOM.arena.classList.remove("hidden");
    Object.values(this.DOM.sections).forEach(s => s.classList.add("hidden"));

    this.renderBanners();
    this.broadcastState();
    await this.handleTurnStart();
  }

  gatherParticipants() {
    const participants = [];
    const lists = document.querySelectorAll(".encounter-section__list");
    const sourceList = this.encountersView?.participants || [];

    lists.forEach(list => {
      const affinity = list.dataset.affinity;
      const cards = list.querySelectorAll(".participant-card");

      cards.forEach(card => {
        const imgEl = card.querySelector(".participant-card__img");
        const cardId = card.dataset.id;
        const original = sourceList.find(p => p.tempId === cardId || p.id === cardId);

        // Read live values directly from the DOM inputs — this is the source
        // of truth the user sees on screen, and avoids cases where the backing
        // object got out of sync.
        const acInputEl = card.querySelector('input[data-field="ac"]');
        const hpInputEl = card.querySelector('input[data-field="current_hp"]');
        const hpMaxEl = card.querySelector('.stat-control__max');

        const domAc = acInputEl ? parseInt(acInputEl.value, 10) : NaN;
        const domCurHp = hpInputEl ? parseInt(hpInputEl.value, 10) : NaN;
        const domMaxHp = hpMaxEl ? parseInt(hpMaxEl.textContent, 10) : NaN;

        const ca = !isNaN(domAc) ? domAc : (Number(original?.ac) || 10);
        const maxHp = !isNaN(domMaxHp) ? domMaxHp : (Number(original?.hp) || 0);
        const currentHp = !isNaN(domCurHp)
          ? domCurHp
          : (original?.current_hp !== undefined ? Number(original.current_hp) : maxHp);

        participants.push({
          id: cardId,
          name: card.querySelector(".participant-card__name").textContent.trim(),
          image: imgEl ? imgEl.src : null,
          affinity: affinity,
          initiative: 0,
          has_acted: 0,
          hp: maxHp,
          current_hp: currentHp,
          ca: ca,
          deathSaves: this.makeEmptyDeathSaves()
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
      dead: false
    };
  }

  async handleInitiatives() {
    // Auto-roll for enemies and neutrals, prompt for allies
    for (const p of this.participants) {
      if (p.affinity === 'enemy' || p.affinity === 'neutral') {
        p.initiative = Math.floor(Math.random() * 20) + 1; // Basic d20 roll
      } else {
        p.initiative = await this.requestInitiative(p.name);
      }
    }
    
    // Sort by initiative descending
    this.participants.sort((a, b) => b.initiative - a.initiative);
  }

  requestInitiative(name) {
    return new Promise((resolve) => {
      this.DOM.initPrompt.textContent = `Insira a iniciativa para: ${name}`;
      this.DOM.initInput.value = "10";
      this.DOM.initModal.classList.remove("hidden");
      
      const onConfirm = () => {
        const val = parseInt(this.DOM.initInput.value) || 10;
        cleanup();
        resolve(val);
      };
      
      const onCancel = () => {
        cleanup();
        resolve(10); // Default fallback
      };
      
      const onRoll = () => {
        const roll = Math.floor(Math.random() * 20) + 1;
        this.DOM.initInput.value = roll;
        onConfirm(); // Auto-confirm after roll
      };
      
      const cleanup = () => {
        this.DOM.btnConfirmInit.removeEventListener("click", onConfirm);
        this.DOM.btnRollInit.removeEventListener("click", onRoll);
        this.DOM.btnCloseInit.removeEventListener("click", onCancel);
        this.DOM.initModal.classList.add("hidden");
        this.cancelInitiative = null;
      };
      
      this.DOM.btnConfirmInit.addEventListener("click", onConfirm);
      this.DOM.btnRollInit.addEventListener("click", onRoll);
      this.DOM.btnCloseInit.addEventListener("click", onCancel);
      this.cancelInitiative = onCancel;
      
      this.DOM.initInput.focus();
      this.DOM.initInput.select();
    });
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
      showToast(`✨ ${participant.name} teve uma recuperação miraculosa! (1 HP)`, 'success');
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
      showToast(`🛡️ ${participant.name} foi estabilizado`, 'success');
    } else if (ds.failures >= 3) {
      ds.dead = true;
      ds.active = false;
      showToast(`💀 ${participant.name} morreu`, 'error');
    }
  }

  async handleNewParticipant(participant) {
    if (!this.isActive) return;

    // Prompt for initiative
    const initiative = await this.requestInitiative(participant.name);
    
    // Transform to combat participant format
    const maxHp = Number(participant.hp) || 0;
    const currentHp = participant.current_hp !== undefined ? Number(participant.current_hp) : maxHp;
    const ca = Number(participant.ac) || 0;
    const combatParticipant = {
      id: participant.tempId || participant.id,
      name: participant.name,
      image: participant.image,
      affinity: participant.affinity,
      initiative: initiative,
      has_acted: 0,
      hp: maxHp,
      current_hp: currentHp,
      ca: ca,
      deathSaves: this.makeEmptyDeathSaves()
    };

    // Add to list
    const currentActiveId = this.participants[this.currentTurnIndex]?.id;
    this.participants.push(combatParticipant);
    
    // Re-sort
    this.participants.sort((a, b) => b.initiative - a.initiative);
    
    // Find new currentTurnIndex for the same character to maintain focus
    if (currentActiveId) {
      this.currentTurnIndex = this.participants.findIndex(p => p.id === currentActiveId);
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();
    
    showToast(`${combatParticipant.name} entrou na luta!`);
  }

  renderBanners() {
    this.DOM.banners.innerHTML = this.participants.map((p, index) => {
      const isActive = index === this.currentTurnIndex;
      const hasActed = p.has_acted && !isActive;
      const ds = p.deathSaves;
      const isDead = ds?.dead;
      const showSaves = ds && (ds.active || ds.stabilized || ds.dead);

      const savesHtml = showSaves ? `
        <div class="death-saves" data-id="${p.id}">
          ${[0, 1, 2].map(i => `
            <span class="death-save-marker death-save-marker--success ${i < ds.successes ? 'filled' : ''}"
                  data-id="${p.id}" data-kind="success" data-index="${i}" title="Sucesso ${i + 1}"></span>
          `).join('')}
          <span class="death-save-divider"></span>
          ${[0, 1, 2].map(i => `
            <span class="death-save-marker death-save-marker--failure ${i < ds.failures ? 'filled' : ''}"
                  data-id="${p.id}" data-kind="failure" data-index="${i}" title="Falha ${i + 1}"></span>
          `).join('')}
        </div>
      ` : '';

      return `
        <div class="combat-banner ${isActive ? 'combat-banner--active' : ''} ${hasActed ? 'combat-banner--acted' : ''} ${isDead ? 'combat-banner--dead' : ''}" data-id="${p.id}">
          <button class="combat-banner__remove" data-id="${p.id}" title="Remover da luta">×</button>
          <div class="combat-banner__affinity combat-banner__affinity--${p.affinity}"></div>
          ${p.image ? `
            <div class="combat-banner__image-container">
              <img src="${p.image}" class="combat-banner__img" />
            </div>
          ` : ''}
          <div class="combat-banner__name">${p.name}</div>
          ${savesHtml}
          <div class="combat-banner__actions">
            <input type="text" class="damage-input" placeholder="Dano" data-id="${p.id}" />
          </div>
          <div class="combat-banner__initiative">${p.initiative}</div>
        </div>
      `;
    }).join('');

    // Bind damage inputs
    this.DOM.banners.querySelectorAll('.damage-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const rawValue = input.value.trim();
          if (!rawValue) return;

          let type = 'damage';
          let amount = 0;

          if (rawValue.startsWith('+')) {
            type = 'heal';
            amount = parseInt(rawValue.substring(1));
          } else if (rawValue.startsWith('-')) {
            type = 'damage';
            amount = parseInt(rawValue.substring(1));
          } else {
            type = 'damage';
            amount = parseInt(rawValue);
          }

          if (!isNaN(amount)) {
            this.triggerDamageEffect(input.dataset.id, amount, type);
            input.value = '';
          }
        }
      });
    });

    // Bind remove buttons
    this.DOM.banners.querySelectorAll('.combat-banner__remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeParticipantFromCombat(btn.dataset.id);
      });
    });

    // Bind death save markers (manual edit by clicking)
    this.DOM.banners.querySelectorAll('.death-save-marker').forEach(marker => {
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDeathSaveMarker(marker.dataset.id, marker.dataset.kind, parseInt(marker.dataset.index, 10));
      });
    });
  }

  toggleDeathSaveMarker(id, kind, index) {
    const participant = this.participants.find(p => p.id === id);
    if (!participant || !participant.deathSaves) return;
    const ds = participant.deathSaves;
    const field = kind === 'success' ? 'successes' : 'failures';
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
    const index = this.participants.findIndex(p => p.id === id);
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

    const participant = this.participants.find(p => p.id === id);
    if (participant) {
      const maxHp = Number(participant.hp) || 0;
      const currentHp = Number(participant.current_hp) || 0;

      if (type === 'damage') {
        participant.current_hp = Math.max(0, currentHp - amount);
      } else if (type === 'heal') {
        const cap = maxHp > 0 ? maxHp : currentHp + amount;
        participant.current_hp = Math.min(cap, currentHp + amount);
      }

      // Cura tira do estado de death save automaticamente
      if (type === 'heal' && participant.current_hp > 0 && participant.deathSaves?.active) {
        participant.deathSaves = this.makeEmptyDeathSaves();
        showToast(`${participant.name} recuperou e saiu do teste de morte`, 'success');
      }
    }

    // Broadcast action for animation
    window.dmCopilot.combat.broadcast('combat-action', {
      type: type,
      targetId: id,
      amount: amount
    });

    // Check if ally fell to 0 HP — prompt for death save
    if (
      participant &&
      type === 'damage' &&
      participant.current_hp === 0 &&
      participant.affinity === 'ally' &&
      !participant.deathSaves?.active &&
      !participant.deathSaves?.dead &&
      !participant.deathSaves?.stabilized
    ) {
      const start = window.confirm(`${participant.name} caiu a 0 HP. Iniciar teste de resistência contra morte?`);
      if (start) {
        participant.deathSaves = { ...this.makeEmptyDeathSaves(), active: true };
        showToast(`Teste de resistência iniciado para ${participant.name}`, 'info');
      }
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();
  }

  async nextTurn() {
    if (!this.isActive) return;

    // Mark current as acted
    this.participants[this.currentTurnIndex].has_acted = 1;

    this.currentTurnIndex++;
    if (this.currentTurnIndex >= this.participants.length) {
      this.currentTurnIndex = 0;
      this.currentRound++;
      this.DOM.roundNumber.textContent = this.currentRound;
      this.logRoundChange(this.currentRound);

      // Reset acted status for new round
      this.participants.forEach(p => p.has_acted = 0);
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();

    await this.handleTurnStart();
  }

  prevTurn() {
    if (!this.isActive) return;

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
      const anyAlive = this.participants.some(p => !p.deathSaves?.dead);
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
    let detail = '';
    if (value === 20) detail = 'recuperação miraculosa (HP=1)';
    else if (value === 1) detail = '💀 falha crítica (2 falhas)';
    else if (value >= 10) detail = '✓ sucesso';
    else detail = '✗ falha';

    this.rollHistory.unshift({
      type: 'death-save',
      characterName: participant.name,
      notation: '1d20',
      total: value,
      details: `Death Save — ${detail}`,
      affinity: participant.affinity || 'ally',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    if (this.rollHistory.length > 50) this.rollHistory.length = 50;
  }

  async updateDB() {
    if (!this.currentEncounter) return;
    await window.dmCopilot.db.encounters.update(this.currentEncounter.id, {
      current_round: this.currentRound,
      current_turn_index: this.currentTurnIndex
    });
  }

  broadcastState() {
    if (!this.isActive) return;

    // Resolve effective visibility config (encounter override or campaign default)
    const visibility = resolveEffectiveVisibility(this.currentEncounter, this.currentCampaign);

    // Transform local-image:// protocol to http for players AND apply visibility filter
    const processedParticipants = this.participants.map(p => {
      let imageUrl = p.image;
      if (imageUrl && imageUrl.startsWith('local-image://')) {
        imageUrl = `/images/${imageUrl.replace('local-image://', '')}`;
      }
      const filtered = applyVisibilityToParticipant(p, visibility[p.affinity]);
      return { ...filtered, image: imageUrl };
    });

    // Resolve encounter background to a URL the player view (Express) can serve
    const bgValue = this.currentEncounter?.background_image || this.encountersView?.currentEncounter?.background_image;
    const backgroundImage = this.resolveBackgroundForPlayer(bgValue);
    console.log("[broadcastState] bgValue:", bgValue, "→ player URL:", backgroundImage);

    // Resolve encounter music file for the player view
    const musicValue = this.currentEncounter?.music_file || this.encountersView?.currentEncounter?.music_file;
    const musicFile = musicValue ? `/music/${musicValue}` : null;

    window.dmCopilot.combat.broadcast('combat-update', {
      status: 'active',
      currentRound: this.currentRound,
      currentTurnIndex: this.currentTurnIndex,
      participants: processedParticipants,
      rollHistory: this.rollHistory,
      backgroundImage,
      musicFile
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

  async _stopCombatInternal() {
    try {
      window.dmCopilot.combat.broadcast('combat-update', { status: 'inactive' });
    } catch (err) {
      console.warn("Falha ao broadcastar fim de combate:", err);
    }

    this.isActive = false;
    window.presentationController?.clearPresentation();

    this.DOM.btnStart.classList.remove("hidden");
    this.DOM.btnEnd.classList.add("hidden");
    this.DOM.roundDisplay.classList.add("hidden");
    this.DOM.arena.classList.add("hidden");

    this.encountersView.organizeParticipants();
    this.encountersView.renderParticipants();

    try {
      await window.dmCopilot.db.encounters.update(this.currentEncounter.id, {
        status: 'finished'
      });
    } catch (err) {
      console.error("Error ending combat:", err);
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
    const participant = this.participants.find(p => p.name === data.characterName);
    const affinity = participant ? participant.affinity : 'neutral';

    this.rollHistory.unshift({
      ...data,
      affinity,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // Keep only last 20
    if (this.rollHistory.length > 20) {
      this.rollHistory.pop();
    }
    
    this.broadcastState();
  }

  logRoundChange(round) {
    this.rollHistory.unshift({
      type: 'round-change',
      round: round,
      timestamp: new Date().toLocaleTimeString()
    });

    // Keep only last 20
    if (this.rollHistory.length > 20) {
      this.rollHistory.pop();
    }

    this.broadcastState();
  }
}
