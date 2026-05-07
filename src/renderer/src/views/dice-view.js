/**
 * DM Copilot - Dice Roller View
 * Manages 3D dice selection, rolling, and results
 */

import DiceBox from "@3d-dice/dice-box-threejs";

export default class DiceView {
  constructor() {
    this.diceCounts = {
      d4: 0,
      d6: 0,
      d8: 0,
      d10: 0,
      d12: 0,
      d20: 0,
      d100: 0,
    };
    this.diceBox = null;
    this.isRolling = false;
    this.isProcessingQueue = false;
    this.queue = [];

    // Pool de instâncias DiceBox para rolagens 3D PARALELAS (várias animações
    // ao mesmo tempo na tela). Cada slot tem seu próprio canvas/scene/world,
    // e o feltro é escondido para os canvas se sobreporem corretamente.
    // Usado pelas rolagens individuais (rollProgrammatic). O botão ROLL e
    // os batches continuam usando a fila principal (this.diceBox).
    this.parallelPool = [];
    this.MAX_PARALLEL_SLOTS = 4;

    this.initDOM();
    this.initDiceBox();
    this.bindEvents();
    // Pré-aquece o pool em background — não bloqueia a UI nem o startup.
    this.warmupParallelPool();
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
      historyOverlay: document.getElementById("dice-history-modal-overlay"),
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

  // ---------------- Parallel Pool ----------------

  async createParallelSlot(idx) {
    const overlay = this.DOM.overlay;
    if (!overlay) return null;

    // Reserva o slot ANTES de qualquer await — assim acquireParallelSlot
    // não pega o mesmo idx e dispara uma criação duplicada.
    this.parallelPool[idx] = { id: idx, busy: true, initializing: true };

    const container = document.createElement("div");
    container.id = `dice-box-parallel-${idx}`;
    container.className = "dice-box-parallel-slot";
    overlay.appendChild(container);

    const db = new DiceBox(`#dice-box-parallel-${idx}`, {
      framerate: 1 / 60,
      sounds: false,
      shadows: false, // sombras desabilitadas pra reduzir custo (4 contextos WebGL)
      theme_surface: "green-felt",
      theme_colorset: "white",
      theme_material: "plastic",
      gravity_multiplier: 400,
      light_intensity: 0.7,
      baseScale: 140,
      strength: 4,
    });
    try {
      await db.initialize();
    } catch (err) {
      console.error("Falha ao inicializar slot paralelo:", err);
      this.parallelPool[idx] = null;
      container.remove();
      return null;
    }
    // Esconde o feltro/desk dessa instância — assim os canvas se sobrepõem
    // sem o feltro de um cobrir os dados do outro. O canvas em si já é
    // transparente (alpha: true, clearColor 0,0).
    if (db.desk) db.desk.visible = false;

    const slot = { id: idx, container, diceBox: db, busy: false };
    this.parallelPool[idx] = slot;
    return slot;
  }

  async warmupParallelPool() {
    // Init SERIAL com pequeno stagger entre slots — evita o spike de ~900 ms
    // de compilação de shaders em paralelo (que congelava a main thread).
    // O custo total fica espalhado em ~750 ms ao invés de concentrado.
    for (let i = 0; i < this.MAX_PARALLEL_SLOTS; i++) {
      await this.createParallelSlot(i);
      await new Promise((resolve) => {
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(resolve, { timeout: 100 });
        } else {
          setTimeout(resolve, 50);
        }
      });
    }
    console.log(`Parallel dice pool ready (${this.parallelPool.filter(Boolean).length} slots)`);
  }

  async acquireParallelSlot() {
    // Slot pronto e ocioso? (ignora slots ainda inicializando — sem diceBox)
    const ready = this.parallelPool.find((s) => s && !s.busy && s.diceBox);
    if (ready) return ready;

    // Pool ainda não lotado? Cria mais um sob demanda.
    const total = this.parallelPool.filter(Boolean).length;
    if (total < this.MAX_PARALLEL_SLOTS) {
      const idx = this.parallelPool.findIndex((s) => !s);
      const newIdx = idx >= 0 ? idx : this.parallelPool.length;
      const created = await this.createParallelSlot(newIdx);
      if (created) return created;
    }

    // Tudo ocupado/inicializando — aguarda o próximo a liberar.
    return this.waitForFreeSlot();
  }

  waitForFreeSlot() {
    return new Promise((resolve) => {
      const tick = () => {
        const free = this.parallelPool.find((s) => s && !s.busy && s.diceBox);
        if (free) return resolve(free);
        setTimeout(tick, 80);
      };
      tick();
    });
  }

  releaseParallelSlot(slot) {
    if (!slot) return;
    try {
      slot.diceBox.clearDice?.();
    } catch (err) {
      console.warn("Falha ao limpar slot paralelo:", err);
    }
    slot.busy = false;
  }

  /**
   * Roda uma notação 3D num slot paralelo, sem bloquear outros slots.
   * Cada slot tem seu próprio canvas/scene; várias rolagens simultâneas
   * aparecem juntas na tela.
   */
  async rollOnParallelSlot(slot, ctx) {
    slot.busy = true;
    try {
      if (ctx.themeColor && slot.diceBox.updateConfig) {
        try {
          await slot.diceBox.updateConfig({
            theme_customColorset: {
              background: [ctx.themeColor],
              foreground: "#ffffff",
              material: "plastic",
              edges: "#000000",
              texture: "none",
            },
          });
        } catch (e) {
          console.warn("Falha ao atualizar cor do dado (slot paralelo):", e);
        }
      }

      // Broadcast ao player view (cada rolagem é um evento separado).
      if (window.dmCopilot?.combat?.broadcast) {
        window.dmCopilot.combat.broadcast("dice-roll", {
          notation: ctx.presetNotation,
          themeColor: ctx.themeColor,
          characterName: ctx.characterName,
        });
      }

      slot.diceBox.strength = 3 + Math.random() * 4;
      // Mostra o overlay (fundo escurecido) caso esteja escondido.
      this.showOverlay();

      const rollResult = await slot.diceBox.roll(ctx.presetNotation);
      const adapted = this.adaptRollResult(rollResult);
      // Toast e persistência por rolagem (cada uma loga separadamente).
      this.displayResults(adapted, ctx.bonus, ctx.characterName, ctx.label);
    } catch (err) {
      console.error("Parallel roll failed:", err);
    } finally {
      // Mantém os dados visíveis um pouco antes de limpar o slot.
      setTimeout(() => this.releaseParallelSlot(slot), 2500);
    }
  }

  bindEvents() {
    // Dice Selection
    this.DOM.diceBtns.forEach((btn) => {
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
        if (activeChar.affinity === "ally") themeColor = "#10b981";
        else if (activeChar.affinity === "neutral") themeColor = "#f59e0b";
        else if (activeChar.affinity === "enemy") themeColor = "#ef4444";
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
    const pending =
      this.queue.length > (this.isRolling ? 1 : 0)
        ? this.queue.length - (this.isRolling ? 1 : 0)
        : 0;

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

      const isBatch = currentRoll.kind === "batch";
      let presetNotation;
      let broadcastCharacterName;

      if (isBatch) {
        presetNotation = currentRoll.composite;
        broadcastCharacterName = currentRoll.characterName || null;
      } else {
        // The notation in queue is an array like ["1d20"] or ["2d6", "1d4"].
        // dice-box-threejs accepts a single string with "+" between groups: "2d6+1d4".
        const notationStr = Array.isArray(currentRoll.notation)
          ? currentRoll.notation.join("+")
          : String(currentRoll.notation || "");
        // Generate authoritative values up-front (without rolling 3D yet) so we
        // can broadcast them BEFORE the local animation starts. Both screens
        // then roll the same predetermined notation in parallel.
        // If the caller already provided a preset (programmatic rolls do this
        // so they can know the rolled value before queueing), reuse it.
        presetNotation = currentRoll.presetNotation || this.generatePresetNotation(notationStr);
        broadcastCharacterName = currentRoll.characterName;
      }
      console.log("Processing queued roll:", presetNotation, isBatch ? "(batch)" : "");

      // Broadcast immediately so the player view starts rolling at the same
      // time as the master (no awaiting the local 3D animation first).
      const hasBroadcast = !!window.dmCopilot?.combat?.broadcast;
      if (hasBroadcast) {
        window.dmCopilot.combat.broadcast("dice-roll", {
          notation: presetNotation,
          themeColor: currentRoll.themeColor,
          characterName: broadcastCharacterName,
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
      const adaptedResults = this.adaptRollResult(rollResult);

      if (isBatch) {
        // Toast com uma linha por personagem; o branch batch persiste por spec
        // logo abaixo, então pedimos para displayResults pular DB save / logRoll.
        const batchLines = currentRoll.specs.map((s) => `${s.characterName}: ${s.total}`);
        this.displayResults(adaptedResults, 0, broadcastCharacterName, currentRoll.label, {
          batchLines,
          skipPersist: true,
        });

        for (const spec of currentRoll.specs) {
          const fullNotation =
            `[${spec.characterName}] ${spec.label || ""} ${spec.notation}`.trim();
          try {
            await window.dmCopilot.db.diceRolls.save({
              notation: fullNotation,
              total: spec.total + (spec.bonus || 0),
              details: `<span class="result-die"><span class="result-die__value">${spec.total}</span></span>`,
              bonus: spec.bonus || 0,
            });
          } catch (err) {
            console.error("Failed to save batch roll to history:", err);
          }
          if (window.encountersView?.combatView?.isActive) {
            window.encountersView.combatView.logRoll({
              characterName: spec.characterName,
              notation: `${spec.label || ""} ${spec.notation}`.trim(),
              total: spec.total + (spec.bonus || 0),
              details: `<span class="result-die"><span class="result-die__value">${spec.total}</span></span>`,
            });
          }
        }

        try {
          currentRoll.onComplete?.(currentRoll.specs.map((s) => s.total));
        } catch (cbErr) {
          console.warn("onComplete (batch) callback failed:", cbErr);
        }
      } else {
        // Single roll path — displayResults persiste e loga internamente.
        this.displayResults(
          adaptedResults,
          currentRoll.bonus,
          currentRoll.characterName,
          currentRoll.label
        );

        try {
          currentRoll.onComplete?.(currentRoll.total);
        } catch (cbErr) {
          console.warn("onComplete callback failed:", cbErr);
        }
      }

      // Auto-hide toast after 3 seconds (unless another roll replaces it).
      // Non-blocking — não atrasa a próxima rolagem na fila.
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
   * Programmatic dice roll. Pre-rolls the value synchronously and dispatches
   * the 3D animation to a parallel pool slot — múltiplas rolagens podem
   * acontecer ao mesmo tempo na tela (sem fila).
   *
   * Returns `{ total, done }` synchronously: `total` é o valor pré-rolado
   * (disponível imediatamente para atualizar UI), `done` é a Promise que
   * resolve quando a animação 3D daquela rolagem termina.
   */
  rollProgrammatic({
    notation = "1d20",
    characterName = null,
    affinity = null,
    bonus = 0,
    label = null,
  } = {}) {
    const themeColor = this.colorForAffinity(affinity);
    const presetNotation = this.generatePresetNotation(notation);
    const total = this.extractPresetTotal(presetNotation);

    const ctx = { notation, presetNotation, bonus, themeColor, characterName, label, total };

    const done = (async () => {
      const slot = await this.acquireParallelSlot();
      if (slot) {
        await this.rollOnParallelSlot(slot, ctx);
      } else {
        // Fallback raro: pool indisponível — cai na fila principal.
        await new Promise((resolve) => {
          this.queue.push({
            kind: "single",
            notation,
            presetNotation,
            bonus,
            themeColor,
            characterName,
            label,
            total,
            onComplete: () => resolve(),
          });
          this.updateQueueUI();
          if (!this.isProcessingQueue) this.processQueue();
        });
      }
      return total;
    })();

    return { total, done };
  }

  /**
   * Batched programmatic dice roll. Composes N rolls into ONE 3D animation
   * (and ONE broadcast to the player view), so a "roll all NPCs" flow can
   * show every die falling simultaneously.
   *
   * @param {Array<{ notation:string, characterName?:string|null,
   *                 affinity?:string|null, bonus?:number, label?:string|null }>} specs
   * @returns {Promise<number[]>} totals em ordem de specs (sem bônus)
   */
  async rollBatch(specs) {
    if (!Array.isArray(specs) || specs.length === 0) return [];

    const enriched = specs.map((s) => {
      const presetNotation = this.generatePresetNotation(s.notation || "1d20");
      const total = this.extractPresetTotal(presetNotation);
      return {
        notation: s.notation || "1d20",
        presetNotation,
        total,
        characterName: s.characterName ?? null,
        affinity: s.affinity ?? null,
        bonus: s.bonus || 0,
        label: s.label ?? null,
      };
    });

    const composite = this.composeBatchNotation(enriched);
    const themeColor = this.pickBatchColor(enriched);
    const sharedLabel = enriched[0]?.label || null;

    return new Promise((resolve) => {
      this.queue.push({
        kind: "batch",
        specs: enriched,
        composite,
        themeColor,
        characterName: sharedLabel ? `${sharedLabel} (lote)` : null,
        label: sharedLabel,
        onComplete: (totals) => resolve(totals),
      });
      this.updateQueueUI();
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Compõe a notação 3D para um lote. A lib dice-box-threejs deduplica
   * grupos repetidos do mesmo tipo (ex: "1d20@5+1d20@7" renderiza só 1 dado),
   * então mesclamos specs do mesmo Ndx num único grupo "Nd20@v1,v2,...,vN".
   * Tipos diferentes (ex: 1d20 + 1d6) continuam unidos por "+".
   */
  composeBatchNotation(enriched) {
    const byDie = new Map(); // sides -> [values...]
    for (const e of enriched) {
      const m = /^(\d+)d(\d+)@([\d,]+)$/i.exec(String(e.presetNotation).trim());
      if (!m) {
        // Fallback: spec não é um único grupo Ndx@v — usa join + (caso raro).
        return enriched.map((s) => s.presetNotation).join("+");
      }
      const sides = parseInt(m[2], 10);
      const values = m[3].split(",").map((v) => parseInt(v, 10));
      if (!byDie.has(sides)) byDie.set(sides, []);
      byDie.get(sides).push(...values);
    }
    return Array.from(byDie.entries())
      .map(([sides, values]) => `${values.length}d${sides}@${values.join(",")}`)
      .join("+");
  }

  pickBatchColor(specs) {
    const counts = new Map();
    for (const s of specs) {
      const a = s.affinity || "master";
      counts.set(a, (counts.get(a) || 0) + 1);
    }
    let bestAffinity = null;
    let bestCount = -1;
    const priority = { enemy: 3, neutral: 2, ally: 1, master: 0 };
    for (const [a, c] of counts) {
      if (
        c > bestCount ||
        (c === bestCount && (priority[a] || 0) > (priority[bestAffinity] || 0))
      ) {
        bestAffinity = a;
        bestCount = c;
      }
    }
    return this.colorForAffinity(bestAffinity);
  }

  colorForAffinity(affinity) {
    if (affinity === "ally") return "#10b981";
    if (affinity === "neutral") return "#f59e0b";
    if (affinity === "enemy") return "#ef4444";
    return "#7c3aed";
  }

  extractPresetTotal(presetNotation) {
    let total = 0;
    String(presetNotation).replace(/@([\d,]+)/g, (_, vals) => {
      vals.split(",").forEach((v) => {
        total += parseInt(v, 10) || 0;
      });
      return _;
    });
    return total;
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

  async displayResults(results, bonus = 0, characterName = null, label = null, opts = {}) {
    if (!results) return;
    const { batchLines = null, skipPersist = false } = opts;

    let diceTotal = 0;
    const individualHTML = [];
    const notationParts = [];

    const resultsArray = Array.isArray(results) ? results : [results];

    resultsArray.forEach((group) => {
      const groupType =
        group.die ||
        (group.sides
          ? "d" + group.sides
          : group.rolls && group.rolls[0]?.sides
            ? "d" + group.rolls[0].sides
            : "d20");
      let groupNotation = group.notation || `${group.rolls?.length || 1}${groupType}`;

      // Limpa nomes entre colchetes da notação para evitar duplicidade no log
      groupNotation = groupNotation.replace(/\[.*?\]\s*/g, "");

      notationParts.push(groupNotation);

      if (group.rolls && Array.isArray(group.rolls)) {
        group.rolls.forEach((die) => {
          if (typeof die.value === "number") {
            diceTotal += die.value;
            const type =
              die.die ||
              (die.sides ? "d" + die.sides : null) ||
              group.die ||
              (group.sides ? "d" + group.sides : null) ||
              "d20";
            const iconPath = `./src/assets/images/dices/${type === "d100" ? "d10" : type}.png`;

            individualHTML.push(`
              <span class="result-die">
                <img src="${iconPath}" class="result-die__icon">
                <span class="result-die__value">${die.value}</span>
              </span>
            `);
          }
        });
      } else if (typeof group.value === "number") {
        diceTotal += group.value;
        const type = group.die || (group.sides ? "d" + group.sides : null) || "d20";
        const iconPath = `./src/assets/images/dices/${type === "d100" ? "d10" : type}.png`;
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

    const fullDetailsHTML =
      bonus !== 0
        ? `<span class="result-group">[ ${diceDetailsHTML} ]</span> <span class="result-modifier">${bonus >= 0 ? "+" : "-"} ${Math.abs(bonus)}</span>`
        : `<span class="result-group">[ ${diceDetailsHTML} ]</span>`;

    // Para batches, o toast mostra uma linha por personagem em vez do total agregado.
    if (batchLines && batchLines.length > 0) {
      const linesHTML = batchLines
        .map((line) => `<div class="result-batch-line">${line}</div>`)
        .join("");
      this.DOM.resultTotal.textContent = label || "Lote";
      this.DOM.resultDetails.innerHTML = linesHTML;
    } else {
      this.DOM.resultTotal.textContent = `${finalTotal}`;
      this.DOM.resultDetails.innerHTML = fullDetailsHTML;
    }
    this.DOM.resultPanel.classList.add("visible");

    // Update header display
    if (this.DOM.lastRollDisplay) {
      this.DOM.lastRollDisplay.classList.remove("hidden");
      if (batchLines && batchLines.length > 0) {
        this.DOM.lastRollValue.textContent = label || "Lote";
        this.DOM.lastRollDetails.innerHTML = batchLines.join(" · ");
      } else {
        this.DOM.lastRollValue.textContent =
          (characterName ? `[${characterName}] ` : "") + finalTotal;
        this.DOM.lastRollDetails.innerHTML = fullDetailsHTML;
      }
    }

    if (skipPersist) return;

    // Save to Database
    const baseNotation = notationParts.join(" + ");
    const labeledNotation = label ? `${label} ${baseNotation}` : baseNotation;
    const fullNotation = characterName ? `[${characterName}] ${labeledNotation}` : labeledNotation;

    try {
      await window.dmCopilot.db.diceRolls.save({
        notation: fullNotation,
        total: finalTotal,
        details: fullDetailsHTML,
        bonus: bonus,
      });
    } catch (err) {
      console.error("Failed to save roll to history:", err);
    }

    // Log to combat view if active
    if (window.encountersView?.combatView?.isActive) {
      window.encountersView.combatView.logRoll({
        characterName: characterName || "Mestre",
        notation: labeledNotation,
        total: finalTotal,
        details: fullDetailsHTML,
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
        this.DOM.historyList.innerHTML =
          '<p class="text-center text-muted p-4">Nenhuma rolagem encontrada.</p>';
        this.DOM.historyPagination.innerHTML = "";
        return;
      }

      this.DOM.historyList.innerHTML = rolls
        .map(
          (roll) => `
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
      `
        )
        .join("");

      // Pagination
      const totalPages = Math.ceil(total / limit);
      this.renderPagination(page, totalPages);
    } catch (err) {
      console.error("Failed to load history:", err);
      this.DOM.historyList.innerHTML =
        '<p class="text-center text-danger p-4">Erro ao carregar histórico.</p>';
    }
  }

  renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) {
      this.DOM.historyPagination.innerHTML = "";
      return;
    }

    let html = `
      <button class="pagination-btn" ${currentPage === 1 ? "disabled" : ""} onclick="window.diceView.loadHistory(${currentPage - 1})">Anterior</button>
      <span class="pagination-info">Página ${currentPage} de ${totalPages}</span>
      <button class="pagination-btn" ${currentPage === totalPages ? "disabled" : ""} onclick="window.diceView.loadHistory(${currentPage + 1})">Próxima</button>
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
      d4: 0,
      d6: 0,
      d8: 0,
      d10: 0,
      d12: 0,
      d20: 0,
      d100: 0,
    };
    this.DOM.diceBtns.forEach((btn) => {
      const type = btn.dataset.dice;
      this.updateBtnUI(type, btn);
    });
  }
}
