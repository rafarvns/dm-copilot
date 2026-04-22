/**
 * DM Copilot - Encounter Combat View
 * Manages active combat, turns, and real-time syncing
 */

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
      btnCloseInit: document.getElementById("btn-close-initiative-modal"),
      
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
  }

  async startCombat() {
    this.currentEncounter = this.encountersView.currentEncounter;
    if (!this.currentEncounter) return;

    // 1. Gather all participants from the UI
    this.participants = this.gatherParticipants();
    if (this.participants.length === 0) {
      alert("Adicione participantes antes de iniciar o combate.");
      return;
    }

    // 2. Initiative Phase
    await this.handleInitiatives();

    // 3. Update DB state
    try {
      const current = this.currentEncounter;
      await window.dmCopilot.db.encounters.update(current.id, {
        campaign_id: current.campaign_id,
        name: current.name,
        description: current.description,
        difficulty: current.difficulty,
        location: current.location,
        monsters: this.participants, 
        status: 'active',
        current_round: 1,
        current_turn_index: 0
      });
    } catch (err) {
      console.error("Failed to update encounter status:", err);
    }

    // 4. Start Server
    try {
      const { ip, port } = await window.dmCopilot.combat.startServer();
      this.DOM.linkText.textContent = `http://${ip}:${port}`;
      this.DOM.serverLink.classList.remove("hidden");
    } catch (err) {
      console.error("Failed to start combat server:", err);
    }

    // 5. Update UI
    this.isActive = true;
    this.currentRound = 1;
    this.currentTurnIndex = 0;
    
    this.DOM.btnStart.classList.add("hidden");
    this.DOM.btnEnd.classList.remove("hidden");
    this.DOM.roundDisplay.classList.remove("hidden");
    this.DOM.arena.classList.remove("hidden");
    
    // Hide standard lists
    Object.values(this.DOM.sections).forEach(s => s.classList.add("hidden"));

    this.renderBanners();
    this.broadcastState();
  }

  gatherParticipants() {
    const participants = [];
    const lists = document.querySelectorAll(".encounter-section__list");
    
    lists.forEach(list => {
      const affinity = list.dataset.affinity;
      const cards = list.querySelectorAll(".participant-card");
      
      cards.forEach(card => {
        const imgEl = card.querySelector(".participant-card__img");
        participants.push({
          id: card.dataset.id,
          name: card.querySelector(".participant-card__name").textContent.trim(),
          image: imgEl ? imgEl.src : null,
          affinity: affinity,
          initiative: 0,
          has_acted: 0
        });
      });
    });
    
    return participants;
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
      
      const cleanup = () => {
        this.DOM.btnConfirmInit.removeEventListener("click", onConfirm);
        this.DOM.btnCloseInit.removeEventListener("click", onCancel);
        this.DOM.initModal.classList.add("hidden");
        this.cancelInitiative = null;
      };
      
      this.DOM.btnConfirmInit.addEventListener("click", onConfirm);
      this.DOM.btnCloseInit.addEventListener("click", onCancel);
      this.cancelInitiative = onCancel;
      
      this.DOM.initInput.focus();
      this.DOM.initInput.select();
    });
  }

  renderBanners() {
    this.DOM.banners.innerHTML = this.participants.map((p, index) => {
      const isActive = index === this.currentTurnIndex;
      const hasActed = p.has_acted && !isActive;
      
      return `
        <div class="combat-banner ${isActive ? 'combat-banner--active' : ''} ${hasActed ? 'combat-banner--acted' : ''}" data-id="${p.id}">
          <div class="combat-banner__affinity combat-banner__affinity--${p.affinity}"></div>
          ${p.image ? `
            <div class="combat-banner__image-container">
              <img src="${p.image}" class="combat-banner__img" />
            </div>
          ` : ''}
          <div class="combat-banner__name">${p.name}</div>
          <div class="combat-banner__initiative">${p.initiative}</div>
        </div>
      `;
    }).join('');

    // Ensure the active banner is centered or visible (optional refinement)
  }

  nextTurn() {
    if (!this.isActive) return;

    // Mark current as acted
    this.participants[this.currentTurnIndex].has_acted = 1;

    this.currentTurnIndex++;
    if (this.currentTurnIndex >= this.participants.length) {
      this.currentTurnIndex = 0;
      this.currentRound++;
      this.DOM.roundNumber.textContent = this.currentRound;
      
      // Reset acted status for new round
      this.participants.forEach(p => p.has_acted = 0);
    }

    this.renderBanners();
    this.broadcastState();
    this.updateDB();
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

  async updateDB() {
    if (!this.currentEncounter) return;
    await window.dmCopilot.db.encounters.update(this.currentEncounter.id, {
      current_round: this.currentRound,
      current_turn_index: this.currentTurnIndex
    });
  }

  broadcastState() {
    // Transform local-image:// protocol to http for players
    const processedParticipants = this.participants.map(p => {
      let imageUrl = p.image;
      if (imageUrl && imageUrl.startsWith('local-image://')) {
        imageUrl = `/images/${imageUrl.replace('local-image://', '')}`;
      }
      return { ...p, image: imageUrl };
    });

    window.dmCopilot.combat.broadcast('combat-update', {
      status: 'active',
      currentRound: this.currentRound,
      currentTurnIndex: this.currentTurnIndex,
      participants: processedParticipants,
      rollHistory: this.rollHistory
    });
  }

  async endCombat() {
    if (!confirm("Deseja finalizar este encontro?")) return;

    this.isActive = false;
    this.DOM.btnStart.classList.remove("hidden");
    this.DOM.btnEnd.classList.add("hidden");
    this.DOM.roundDisplay.classList.add("hidden");
    this.DOM.arena.classList.add("hidden");
    this.DOM.serverLink.classList.add("hidden");

    // Show standard lists again
    this.encountersView.organizeParticipants();
    this.encountersView.renderParticipants();

    try {
      await window.dmCopilot.db.encounters.update(this.currentEncounter.id, {
        status: 'finished'
      });
      await window.dmCopilot.combat.stopServer();
    } catch (err) {
      console.error("Error ending combat:", err);
    }
  }

  getActiveParticipant() {
    if (!this.isActive) return null;
    return this.participants[this.currentTurnIndex];
  }

  logRoll(data) {
    // data: { characterName, notation, total, details }
    this.rollHistory.unshift({
      ...data,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // Keep only last 20
    if (this.rollHistory.length > 20) {
      this.rollHistory.pop();
    }
    
    this.broadcastState();
  }
}
