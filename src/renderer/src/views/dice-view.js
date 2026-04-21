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
      resultTotal: document.querySelector(".dice-result-total"),
      resultDetails: document.querySelector(".dice-result-details"),
      btnCloseResult: document.getElementById("btn-close-dice-result"),
      lastRollDisplay: document.getElementById("last-roll-display"),
      lastRollValue: document.querySelector(".last-roll-display__value"),
      lastRollDetails: document.querySelector(".last-roll-display__details")
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

    // Close Result
    this.DOM.btnCloseResult?.addEventListener("click", () => this.hideOverlay());
    this.DOM.overlay?.addEventListener("click", (e) => {
      if (e.target === this.DOM.overlay) this.hideOverlay();
    });
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
    if (!notation || this.isRolling) return;

    this.isRolling = true;
    this.showOverlay();

    console.log("Full Rolling Notation:", notation);

    try {
      const results = await this.diceBox.roll(notation);
      console.log("Raw DiceBox Results:", results);
      this.displayResults(results);
    } catch (error) {
      console.error("Roll failed:", error);
      this.hideOverlay();
    } finally {
      this.isRolling = false;
      this.resetCounts();
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
    
    // Join with " + " to prevent digit merging (like d6 + 2d8 becoming d62)
    return diceParts.join(" + ");
  }

  displayResults(results) {
    if (!results) {
      console.warn("No results received from DiceBox");
      return;
    }

    console.log("Processing DiceBox Results:", results);

    const bonus = parseInt(this.DOM.bonusInput?.value || 0);
    let diceTotal = 0;
    const individualValues = [];

    // Ensure results is an array
    const resultsArray = Array.isArray(results) ? results : [results];

    resultsArray.forEach(item => {
      // Handle groups with .rolls (Standard v1.1+)
      if (item.rolls && Array.isArray(item.rolls)) {
        item.rolls.forEach(die => {
          if (die && typeof die.value === 'number') {
            diceTotal += die.value;
            individualValues.push(die.value);
          }
        });
      } 
      // Handle single objects or flat results
      else if (typeof item.value === 'number') {
        diceTotal += item.value;
        individualValues.push(item.value);
      }
      // Handle total if no individual rolls found
      else if (typeof item.total === 'number' && individualValues.length === 0) {
        diceTotal += item.total;
        individualValues.push(item.total);
      }
    });

    const finalTotal = diceTotal + bonus;
    const diceDetails = individualValues.length > 0 ? individualValues.join(" + ") : "0";
    
    const fullDetails = bonus !== 0 
      ? `(${diceDetails}) ${bonus >= 0 ? "+" : "-"} ${Math.abs(bonus)}`
      : `(${diceDetails})`;

    console.log(`Roll Summary: Total=${finalTotal}, Dice=${diceTotal}, Bonus=${bonus}`);

    // Update overlay panel
    this.DOM.resultTotal.textContent = `Total: ${finalTotal}`;
    this.DOM.resultDetails.textContent = fullDetails;
    this.DOM.resultPanel.classList.add("visible");

    // Update header display
    if (this.DOM.lastRollDisplay) {
      this.DOM.lastRollDisplay.classList.remove("hidden");
      this.DOM.lastRollValue.textContent = finalTotal;
      this.DOM.lastRollDetails.textContent = fullDetails;
    }
  }

  showOverlay() {
    this.DOM.overlay.classList.add("visible");
    this.DOM.resultPanel.classList.remove("visible");
  }

  hideOverlay() {
    this.DOM.overlay.classList.remove("visible");
    this.DOM.resultPanel.classList.remove("visible");
    
    // Clear dice from canvas if possible
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
