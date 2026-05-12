import template from "./dice-roller.html?raw";
import "./dice-roller.css";
import { EventBus } from "../../core/event-bus.js";
import { mountIcons } from "../../core/icons.js";

// Log de rolagens persistido em memória pela duração da sessão do renderer.
// Sobrevive a desmontagens da feature (navegação entre telas), mas é descartado
// quando o app fecha — não vai pro banco.
const MAX_ENTRIES = 50;
const sessionHistory = [];

export default class DiceRollerFeature {
  constructor() {
    this.container = null;
    this.toolbarNode = null;
    this.toolbarOriginalParent = null;
    this.onRoll = this.onRoll.bind(this);
  }

  async mount(container) {
    this.container = container;
    container.innerHTML = template;
    mountIcons(container);

    this.toolbarNode = document.getElementById("dice-toolbar");
    const slot = container.querySelector("#dice-roller-toolbar-slot");
    if (this.toolbarNode && slot) {
      this.toolbarOriginalParent = this.toolbarNode.parentElement;
      slot.appendChild(this.toolbarNode);
    }

    EventBus.on("dice:rolled", this.onRoll);

    if (window.diceView?.enableAdHocMode) {
      window.diceView.enableAdHocMode();
    }

    container.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="clear"]');
      if (btn) this.clearLog();
    });

    this.render();
  }

  destroy() {
    if (this.toolbarNode && this.toolbarOriginalParent) {
      this.toolbarOriginalParent.appendChild(this.toolbarNode);
    }
    this.toolbarNode = null;
    this.toolbarOriginalParent = null;

    EventBus.off("dice:rolled", this.onRoll);

    if (window.diceView?.disableAdHocMode) {
      window.diceView.disableAdHocMode();
    }

    this.container = null;
  }

  onRoll(data) {
    sessionHistory.unshift(data);
    if (sessionHistory.length > MAX_ENTRIES) {
      sessionHistory.length = MAX_ENTRIES;
    }
    this.render();
  }

  clearLog() {
    sessionHistory.length = 0;
    this.render();
  }

  render() {
    const list = this.container?.querySelector("#dice-roller-log");
    if (!list) return;

    list.innerHTML = "";

    if (sessionHistory.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "dice-roller__empty";

      const icon = document.createElement("i");
      icon.setAttribute("data-icon", "dice-5");
      icon.className = "dice-roller__empty-icon";
      emptyItem.appendChild(icon);

      const text = document.createElement("p");
      text.className = "dice-roller__empty-text";
      text.textContent =
        "Nenhuma rolagem ainda. Selecione dados na barra abaixo e clique em ROLL.";
      emptyItem.appendChild(text);

      list.appendChild(emptyItem);
    } else {
      sessionHistory.forEach((data) => {
        const item = document.createElement("li");
        item.className = "dice-roller__entry";

        const time = document.createElement("span");
        time.className = "dice-roller__entry-time";
        time.textContent = new Date(data.timestamp).toLocaleTimeString("pt-BR");
        item.appendChild(time);

        const notation = document.createElement("span");
        notation.className = "dice-roller__entry-notation";
        notation.textContent = data.notation;
        item.appendChild(notation);

        if (data.batchLines && data.batchLines.length > 0) {
          const batchContainer = document.createElement("span");
          batchContainer.className = "dice-roller__entry-batch";
          data.batchLines.forEach((line) => {
            const lineEl = document.createElement("div");
            lineEl.className = "dice-roller__entry-batch-line";
            lineEl.textContent = line;
            batchContainer.appendChild(lineEl);
          });
          item.appendChild(batchContainer);
        } else {
          const details = document.createElement("span");
          details.className = "dice-roller__entry-details";
          details.innerHTML = data.detailsHTML;
          item.appendChild(details);

          const total = document.createElement("span");
          total.className = "dice-roller__entry-total";
          total.textContent = String(data.total);
          item.appendChild(total);
        }

        list.appendChild(item);
      });
    }

    mountIcons(this.container);
  }
}
