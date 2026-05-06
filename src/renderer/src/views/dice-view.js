/**
 * DM Copilot - Dice Roller View
 * Manages 3D dice selection, rolling, and results
 */

import DiceBox from "@3d-dice/dice-box-threejs";

export default class DiceView {
  constructor() {
    this.diceCounts = {
      d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0
    };
    this.diceBox = null;
    this.isRolling = false;
    this.isProcessingQueue = false;
    this.queue = [];

    this.initDOM();
    this.initDiceBox();
    this.bindEvents();
  }

  initDOM() {
    this.DOM = {
      toolbar: document.getElementById("dice-toolbar"),
      diceBtns: document.querySelectorAll(".dice-btn"),
      btnRoll: document.getElementById("btn-roll-dice"),
      bonusInput: document.getElementById("dice-bonus-input"),
      overlay: document.getElementById("dice-box-overlay"),
      resultPanel: document.getElementById("dice-result"),
      resultTotal: document.getElementById("dice-result-total"),
      resultDetails: document.getElementById("dice-result-details"),
      lastRollDisplay: document.getElementById("last-roll-display"),
      lastRollValue: document.querySelector(".last-roll-display__value"),
      lastRollDetails: document.querySelector(".last-roll-display__details"),
      queueIndicator: document.getElementById("dice-roll-queue"),
      queueCount: document.querySelector(".queue-count"),
      rollerAsCharacterToggle: document.getElementById("dice-roller-as-character"),
      btnHistory: document.getElementById("btn-dice-history"),
      modalHistory: document.getElementById("modal-dice-history"),
      historyList: document.getElementById("dice-history-list"),
      historyPagination: document.getElementById("dice-history-pagination"),
      btnClearHistory: document.getElementById("btn-clear-dice-history"),
      btnCloseHistory: document.getElementById("btn-close-dice-history"),
      btnCloseHistoryFooter: document.getElementById("btn-close-dice-history-footer"),
      historyOverlay: document.getElementById("dice-history-modal-overlay")
    };
  }

  async initDiceBox() {
    try {
      // dice-box-threejs takes the container as first arg + a config object.
      // Predeterministic rolls are supported via the "@" syntax in roll(notation).
      this.diceBox = new DiceBox("#dice-box", {
        framerate: 1 / 60,
        sounds: false,
        shadows: true,
        theme_surface: "green-felt",
        theme_colorset: "white",
        theme_material: "plastic",
        gravity_multiplier: 400,
        light_intensity: 0.7,
        baseScale: 140,
        strength: 4,
      });
      await this.diceBox.initialize();
      console.log("DiceBox-threejs initialized");
    } catch (error) {
      console.error("Failed to initialize DiceBox:", error);
    }
  }

  bindEvents() {
    // Dice Selection
    this.DOM.diceBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.dice;
        this.incrementDice(type, btn);
      });
      
      // Right click to decrement
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const type = btn.dataset.dice;
        this.decrementDice(type, btn);
      });
    });

    // Roll Button
    this.DOM.btnRoll?.addEventListener("click", () => this.roll());

    // History Button
    this.DOM.btnHistory?.addEventListener("click", () => this.openHistory());
    
    // Modal Close
    this.DOM.btnCloseHistory?.addEventListener("click", () => this.closeHistory());
    this.DOM.btnCloseHistoryFooter?.addEventListener("click", () => this.closeHistory());
    this.DOM.historyOverlay?.addEventListener("click", () => this.closeHistory());
    this.DOM.modalHistory?.addEventListener("click", (e) => {
      if (e.target === this.DOM.modalHistory) this.closeHistory();
    });
    
    // Clear History
    this.DOM.btnClearHistory?.addEventListener("click", () => this.clearHistory());

    // Auto-hide toast on click (optional)
    this.DOM.resultPanel?.addEventListener("click", () => this.hideToast());
  }

  incrementDice(type, btn) {
    this.diceCounts[type]++;
    this.updateBtnUI(type, btn);
  }

  decrementDice(type, btn) {
    if (this.diceCounts[type] > 0) {
      this.diceCounts[type]--;
      this.updateBtnUI(type, btn);
    }
  }

  updateBtnUI(type, btn) {
    const count = this.diceCounts[type];
    const pill = btn.querySelector(".dice-btn__pill");
    
    if (count > 0) {
      btn.classList.add("dice-btn--active");
      pill.textContent = count;
    } else {
      btn.classList.remove("dice-btn--active");
      pill.textContent = "0";
    }
  }

  async roll() {
    const notation = this.getNotation();
    if (!notation) return;

    const bonus = parseInt(this.DOM.bonusInput?.value || 0);
    
    // Roll mode: toggle ON → roll as the active character (uses their color
    // and name in history); toggle OFF (default) → roll as the master (purple,
    // no character name).
    let themeColor = "#7c3aed"; // Master purple
    let characterName = null;

    const rollAsCharacter = !!this.DOM.rollerAsCharacterToggle?.checked;
    if (rollAsCharacter && window.encountersView?.combatView?.isActive) {
      const activeChar = window.encountersView.combatView.getActiveParticipant();
      if (activeChar) {
        characterName = activeChar.name;
        if (activeChar.affinity === 'ally') themeColor = "#10b981";
        else if (activeChar.affinity === 'neutral') themeColor = "#f59e0b";
        else if (activeChar.affinity === 'enemy') themeColor = "#ef4444";
      }
    }

    // Add to queue
    this.queue.push({ notation, bonus, themeColor, characterName });
    
    // Reset UI immediately so user can select more
    this.resetCounts();
    this.updateQueueUI();

    // Start processing if not already
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  updateQueueUI() {
    if (!this.DOM.queueIndicator) return;

    // We show (total queue - 1) as "pending" because the 0th is current
    const pending = this.queue.length > (this.isRolling ? 1 : 0) ? this.queue.length - (this.isRolling ? 1 : 0) : 0;
    
    if (pending > 0) {
      this.DOM.queueIndicator.classList.remove("hidden");
      this.DOM.queueCount.textContent = pending;
    } else {
      this.DOM.queueIndicator.classList.add("hidden");
    }
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;
    const currentRoll = this.queue[0]; // Peek

    this.isRolling = true;
    this.updateQueueUI();
    this.showOverlay();

    try {
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }
      
      if (this.diceBox) {
        this.diceBox.clearDice?.();
      }

      // The notation in queue is an array like ["1d20"] or ["2d6", "1d4"].
      // dice-box-threejs accepts a single string with "+" between groups: "2d6+1d4".
      const notationStr = Array.isArray(currentRoll.notation)
        ? currentRoll.notation.join("+")
        : String(currentRoll.notation || "");

      console.log("Processing queued roll:", notationStr);

      // Generate authoritative values up-front (without rolling 3D yet) so we
      // can broadcast them BEFORE the local animation starts. Both screens
      // then roll the same predetermined notation in parallel.
      const presetNotation = this.generatePresetNotation(notationStr);
      console.log("Preset notation:", presetNotation);

      // Broadcast immediately so the player view starts rolling at the same
      // time as the master (no awaiting the local 3D animation first).
      const hasBroadcast = !!window.dmCopilot?.combat?.broadcast;
      console.log(
        `[DM→broadcast] dice-roll notation=${JSON.stringify(presetNotation)}, hasBroadcast=${hasBroadcast}`
      );
      if (hasBroadcast) {
        window.dmCopilot.combat.broadcast("dice-roll", {
          notation: presetNotation,
          themeColor: currentRoll.themeColor,
          characterName: currentRoll.characterName,
        });
      } else {
        console.warn(
          "[DM→broadcast] window.dmCopilot.combat.broadcast indisponível — rolagem não sincronizada"
        );
      }

      // Apply per-roll color (e.g. enemy red, ally green) before throwing.
      if (currentRoll.themeColor && this.diceBox.updateConfig) {
        try {
          await this.diceBox.updateConfig({
            theme_customColorset: {
              background: [currentRoll.themeColor],
              foreground: "#ffffff",
              material: "plastic",
              edges: "#000000",
              texture: "none",
            },
          });
        } catch (e) {
          console.warn("Falha ao atualizar cor do dado:", e);
        }
      }

      // Randomize throw strength so dice tumble more naturally and travel
      // farther from spawn point.
      this.diceBox.strength = 3 + Math.random() * 4; // 3.0 .. 7.0

      // Roll locally with the same predetermined values that were broadcast.
      const rollResult = await this.diceBox.roll(presetNotation);
      console.log("Roll result:", rollResult);

      // Adapt the result shape for displayResults (group format)
      const adaptedResults = this.adaptRollResult(rollResult);

      // Pass the bonus and characterName captured when roll was clicked
      this.displayResults(adaptedResults, currentRoll.bonus, currentRoll.characterName);
      
      // Wait a bit for the toast to be seen before next roll if queue exists
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Auto-hide toast after 3 seconds total (unless next roll happens)
      this.toastTimeout = setTimeout(() => {
        this.hideToast();
      }, 3000);

    } catch (error) {
      console.error("Queue roll failed:", error);
    } finally {
      this.isRolling = false;
      this.queue.shift(); // Remove processed
      this.updateQueueUI();
      
      // Process next in queue
      this.processQueue();
    }
  }

  getNotation() {
    const diceParts = [];
    for (const [type, count] of Object.entries(this.diceCounts)) {
      if (count > 0) {
        diceParts.push(`${count}${type}`);
      }
    }
    
    if (diceParts.length === 0) return null;
    return diceParts;
  }

  /**
   * Convert a regular dice notation (e.g. "1d20", "2d6+1d4", "1d20+5") into one
   * that has predetermined values appended ("1d20@17", "2d6@3,5+1d4@2",
   * "1d20@17+5"). The values are rolled in plain JS (Math.random) up-front,
   * so we can broadcast them to the player view BEFORE any 3D animation
   * starts — guaranteeing both screens animate in parallel.
   */
  generatePresetNotation(notationStr) {
    return String(notationStr).replace(/(\d+)d(\d+)/gi, (match, qty, sides) => {
      const n = parseInt(qty, 10) || 1;
      const s = parseInt(sides, 10) || 20;
      const values = [];
      for (let i = 0; i < n; i++) {
        values.push(1 + Math.floor(Math.random() * s));
      }
      return `${n}d${s}@${values.join(",")}`;
    });
  }

  /**
   * Adapt dice-box-threejs result shape into the legacy group array
   * `[{ rolls: [{value, sides}, ...], die: 'd20', notation: '1d20' }, ...]`
   * that displayResults expects.
   */
  adaptRollResult(rollResult) {
    if (!rollResult || !Array.isArray(rollResult.sets)) return [];
    return rollResult.sets.map((set) => ({
      die: set.type,
      sides: set.sides,
      notation: `${set.num}${set.type}`,
      rolls: (set.rolls || []).map((r) => ({ value: r.value, sides: set.sides })),
      total: set.total,
    }));
  }

  async displayResults(results, bonus = 0, characterName = null) {
    if (!results) return;

    let diceTotal = 0;
    const individualHTML = [];
    const notationParts = [];

    const resultsArray = Array.isArray(results) ? results : [results];

    resultsArray.forEach(group => {
      const groupType = group.die || (group.sides ? 'd' + group.sides : (group.rolls && group.rolls[0]?.sides ? 'd' + group.rolls[0].sides : 'd20'));
      let groupNotation = group.notation || `${group.rolls?.length || 1}${groupType}`;
      
      // Limpa nomes entre colchetes da notação para evitar duplicidade no log
      groupNotation = groupNotation.replace(/\[.*?\]\s*/g, '');
      
      notationParts.push(groupNotation);

      if (group.rolls && Array.isArray(group.rolls)) {
        group.rolls.forEach(die => {
          if (typeof die.value === 'number') {
            diceTotal += die.value;
            const type = die.die || (die.sides ? 'd' + die.sides : null) || group.die || (group.sides ? 'd' + group.sides : null) || "d20";
            const iconPath = `./src/assets/images/dices/${type === 'd100' ? 'd10' : type}.png`;
            
            individualHTML.push(`
              <span class="result-die">
                <img src="${iconPath}" class="result-die__icon">
                <span class="result-die__value">${die.value}</span>
              </span>
            `);
          }
        });
      } else if (typeof group.value === 'number') {
        diceTotal += group.value;
        const type = group.die || (group.sides ? 'd' + group.sides : null) || "d20";
        const iconPath = `./src/assets/images/dices/${type === 'd100' ? 'd10' : type}.png`;
        individualHTML.push(`
          <span class="result-die">
            <img src="${iconPath}" class="result-die__icon">
            <span>${group.value}</span>
          </span>
        `);
      }
    });

    const finalTotal = diceTotal + bonus;
    const diceDetailsHTML = individualHTML.join('<span class="result-sep">+</span>');
    
    const fullDetailsHTML = bonus !== 0 
      ? `<span class="result-group">[ ${diceDetailsHTML} ]</span> <span class="result-modifier">${bonus >= 0 ? "+" : "-"} ${Math.abs(bonus)}</span>`
      : `<span class="result-group">[ ${diceDetailsHTML} ]</span>`;

    // Update overlay panel (Toast)
    this.DOM.resultTotal.textContent = `${finalTotal}`;
    this.DOM.resultDetails.innerHTML = fullDetailsHTML;
    this.DOM.resultPanel.classList.add("visible");

    // Update header display
    if (this.DOM.lastRollDisplay) {
      this.DOM.lastRollDisplay.classList.remove("hidden");
      this.DOM.lastRollValue.textContent = (characterName ? `[${characterName}] ` : '') + finalTotal;
      this.DOM.lastRollDetails.innerHTML = fullDetailsHTML;
    }

    // Save to Database
    const baseNotation = notationParts.join(" + ");
    const fullNotation = characterName ? `[${characterName}] ${baseNotation}` : baseNotation;
    
    try {
      await window.dmCopilot.db.diceRolls.save({
        notation: fullNotation,
        total: finalTotal,
        details: fullDetailsHTML,
        bonus: bonus
      });
    } catch (err) {
      console.error("Failed to save roll to history:", err);
    }
    
    // Log to combat view if active
    if (window.encountersView?.combatView?.isActive) {
      window.encountersView.combatView.logRoll({
        characterName: characterName || 'Mestre',
        notation: baseNotation,
        total: finalTotal,
        details: fullDetailsHTML
      });
    }
  }

  // --- History Management ---

  async openHistory(page = 1) {
    this.DOM.modalHistory.classList.remove("hidden");
    this.loadHistory(page);
  }

  closeHistory() {
    this.DOM.modalHistory.classList.add("hidden");
  }

  async loadHistory(page = 1) {
    const limit = 10;
    const offset = (page - 1) * limit;
    
    try {
      const { rolls, total } = await window.dmCopilot.db.diceRolls.getAll({ limit, offset });
      
      if (rolls.length === 0) {
        this.DOM.historyList.innerHTML = '<p class="text-center text-muted p-4">Nenhuma rolagem encontrada.</p>';
        this.DOM.historyPagination.innerHTML = '';
        return;
      }

      this.DOM.historyList.innerHTML = rolls.map(roll => `
        <div class="dice-history-item">
          <div class="history-item__total">${roll.total}</div>
          <div class="history-item__content">
            <div class="history-item__meta">
              <span class="history-item__notation">${roll.notation}</span>
              <span class="history-item__date">${new Date(roll.created_at).toLocaleString()}</span>
            </div>
            <div class="history-item__details">${roll.details}</div>
          </div>
        </div>
      `).join('');

      // Pagination
      const totalPages = Math.ceil(total / limit);
      this.renderPagination(page, totalPages);

    } catch (err) {
      console.error("Failed to load history:", err);
      this.DOM.historyList.innerHTML = '<p class="text-center text-danger p-4">Erro ao carregar histórico.</p>';
    }
  }

  renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) {
      this.DOM.historyPagination.innerHTML = '';
      return;
    }

    let html = `
      <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="window.diceView.loadHistory(${currentPage - 1})">Anterior</button>
      <span class="pagination-info">Página ${currentPage} de ${totalPages}</span>
      <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.diceView.loadHistory(${currentPage + 1})">Próxima</button>
    `;
    
    this.DOM.historyPagination.innerHTML = html;
  }

  async clearHistory() {
    if (confirm("Tem certeza que deseja apagar todo o histórico de rolagens?")) {
      await window.dmCopilot.db.diceRolls.clear();
      this.loadHistory(1);
    }
  }

  showOverlay() {
    this.DOM.overlay.classList.add("visible");
    this.DOM.resultPanel.classList.remove("visible");
  }

  hideOverlay() {
    this.DOM.overlay.classList.remove("visible");
    this.hideToast();
  }

  hideToast() {
    this.DOM.resultPanel?.classList.remove("visible");

    // Clear dice from screen when toast hides
    if (this.diceBox) {
      this.diceBox.clearDice?.();
    }
  }

  resetCounts() {
    this.diceCounts = {
      d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0
    };
    this.DOM.diceBtns.forEach(btn => {
      const type = btn.dataset.dice;
      this.updateBtnUI(type, btn);
    });
  }
}
