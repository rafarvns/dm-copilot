import template from "./status-bar.html?raw";
import "./status-bar.css";
import { navigateTo } from "../../core/router.js";
import { EventBus } from "../../core/event-bus.js";

export default class StatusBarComponent {
  mount(container) {
    container.innerHTML = template;

    const licenseItem = document.getElementById("statusbar-license");
    if (licenseItem) {
      licenseItem.addEventListener("click", () => navigateTo("license"));
    }

    EventBus.on("license:changed", () => this.refresh());
  }

  setVersion(version) {
    const el = document.getElementById("version-info");
    if (el) el.textContent = `v${version}`;
  }

  setLicense(status, info) {
    const el = document.getElementById("statusbar-license-text");
    const item = document.getElementById("statusbar-license");
    if (!el) return;

    if (status === "dev") {
      el.textContent = "Dev";
      if (item) item.removeAttribute("title");
    } else if (status === "licensed") {
      el.textContent = "Licenciado";
      if (item) item.setAttribute("title", "Licença ativa — clique para detalhes");
    } else {
      const parts = [
        info?.campaigns ? `${info.campaigns.used}/${info.campaigns.limit}c` : null,
        info?.characters ? `${info.characters.used}/${info.characters.limit}p` : null,
        info?.encounters ? `${info.encounters.used}/${info.encounters.limit}e` : null,
        info?.scenes ? `${info.scenes.used}/${info.scenes.limit}s` : null,
      ].filter(Boolean);

      el.textContent = parts.length ? `Trial · ${parts.join(" · ")}` : "Trial";

      if (item && info) {
        const tooltip = [
          `Campanhas: ${info.campaigns?.used ?? 0}/${info.campaigns?.limit ?? 0}`,
          `Personagens: ${info.characters?.used ?? 0}/${info.characters?.limit ?? 0}`,
          `Encontros: ${info.encounters?.used ?? 0}/${info.encounters?.limit ?? 0}`,
          `Cenas: ${info.scenes?.used ?? 0}/${info.scenes?.limit ?? 0}`,
        ].join(" | ");
        item.setAttribute("title", `${tooltip} — clique para ativar`);
      }
    }
  }

  async refresh() {
    if (!window.dmCopilot?.license?.getStatus) return;
    const lic = await window.dmCopilot.license.getStatus();
    this.setLicense(lic.status, lic.info);
  }
}
