/**
 * DM Copilot - Dice Roller View
 * Manages 3D dice selection, rolling, and results
 */

import DiceBox from "@3d-dice/dice-box";

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
      this.diceBox = new DiceBox({
        container: "#dice-box",
        assetPath: "/dice-box/",
        theme: "default",
        themeColor: "#7c3aed",
        offscreen: false,
        scale: 6,
        shadows: true,
        gravity: 2,
        startingHeight: 12
      });

      await this.diceBox.init();
      console.log("DiceBox initialized with assetPath: /dice-box/");
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
    
    // Add to queue
    this.queue.push({ notation, bonus });
    
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
        await this.diceBox.clear();
      }

      console.log("Processing queued roll:", currentRoll.notation);
      const results = await this.diceBox.roll(currentRoll.notation);
      
      // Pass the bonus captured when roll was clicked
      this.displayResults(results, currentRoll.bonus);
      
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

  async displayResults(results, bonus = 0) {
    if (!results) return;

    let diceTotal = 0;
    const individualHTML = [];
    const notationParts = [];

    const resultsArray = Array.isArray(results) ? results : [results];

    resultsArray.forEach(group => {
      const groupNotation = group.notation || `${group.rolls?.length || 1}${group.die || 'd20'}`;
      notationParts.push(groupNotation);

      if (group.rolls && Array.isArray(group.rolls)) {
        group.rolls.forEach(die => {
          if (typeof die.value === 'number') {
            diceTotal += die.value;
            const type = die.die || group.die || "d20";
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
        const type = group.die || "d20";
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
      this.DOM.lastRollValue.textContent = finalTotal;
      this.DOM.lastRollDetails.innerHTML = fullDetailsHTML;
    }

    // Save to Database
    try {
      const fullNotation = notationParts.join(" + ");
      await window.dmCopilot.db.diceRolls.save({
        notation: fullNotation,
        total: finalTotal,
        details: fullDetailsHTML,
        bonus: bonus
      });
    } catch (err) {
      console.error("Failed to save roll to history:", err);
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
      this.diceBox.clear();
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
