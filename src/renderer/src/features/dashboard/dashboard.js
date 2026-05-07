import template from "./dashboard.html?raw";
import "./dashboard.css";
import { navigateTo } from "../../core/router.js";
import { mountIcons } from "../../core/icons.js";
import databaseService from "../../db/database.js";
import { pluralize, formatRelativeTime, truncate, escapeHtml } from "../../core/format.js";

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default class DashboardFeature {
  constructor() {
    this.container = null;
  }

  async mount(container) {
    this.container = container;
    container.innerHTML = template;

    this.fillGreetingDate();
    this.bindEvents();
    mountIcons(container);

    // Carrega dados em paralelo; o HTML inicial já tem skeletons.
    try {
      const [recentCampaigns, charCount, campaignCount] = await Promise.all([
        databaseService.getRecentCampaigns(1),
        databaseService.countCharacters(),
        databaseService.getAllCampaigns().then((rows) => rows.length).catch(() => 0),
      ]);
      this.renderContinue(recentCampaigns?.[0] ?? null);
      this.renderCounts({ campaigns: campaignCount, characters: charCount });
      mountIcons(container);
    } catch (err) {
      console.warn("Dashboard data fetch failed:", err);
      this.renderContinue(null);
      this.renderCounts({ campaigns: 0, characters: 0 });
      mountIcons(container);
    }
  }

  destroy() {
    this.container = null;
  }

  fillGreetingDate() {
    const el = this.container.querySelector("#dash-greeting-date");
    if (el) el.textContent = DATE_FORMAT.format(new Date());
  }

  renderContinue(campaign) {
    const slot = this.container.querySelector("#dash-continue-slot");
    if (!slot) return;

    if (!campaign) {
      slot.innerHTML = `
        <div class="continue-empty">
          <span class="continue-empty__icon"><i data-icon="castle"></i></span>
          <h3 class="continue-empty__title">Pronto pra começar?</h3>
          <p class="continue-empty__text">Crie sua primeira campanha e dê vida ao próximo mundo.</p>
          <button class="btn btn--primary continue-empty__action" data-action="new-campaign">
            <i class="btn__icon" data-icon="plus"></i>
            <span>Crie sua Primeira Campanha</span>
          </button>
        </div>
      `;
      return;
    }

    const name = escapeHtml(campaign.name ?? "Sem título");
    const desc = escapeHtml(truncate(campaign.description ?? "", 140));
    const system = campaign.system ? escapeHtml(campaign.system) : null;
    const updatedRel = formatRelativeTime(campaign.updated_at);

    slot.innerHTML = `
      <article class="continue-card" data-action="open-campaign" data-id="${campaign.id}">
        <h3 class="continue-card__name">${name}</h3>
        <div class="continue-card__meta">
          ${system ? `<span class="continue-card__system-badge">${system}</span>` : ""}
          ${updatedRel ? `<span>última edição ${escapeHtml(updatedRel)}</span>` : ""}
        </div>
        ${desc ? `<p class="continue-card__desc">${desc}</p>` : ""}
      </article>
    `;
  }

  renderCounts({ campaigns, characters }) {
    const cmp = this.container.querySelector("#dash-count-campaigns");
    const chr = this.container.querySelector("#dash-count-characters");
    if (cmp) cmp.textContent = pluralize(campaigns ?? 0, "campanha", "campanhas");
    if (chr) chr.textContent = pluralize(characters ?? 0, "personagem", "personagens");
  }

  bindEvents() {
    this.container.addEventListener("click", async (event) => {
      const trigger = event.target.closest("[data-action]");
      if (!trigger) return;
      const action = trigger.dataset.action;

      if (action === "new-campaign") {
        if (window.campaignsView) {
          window.campaignsView.openForm?.();
        } else {
          await navigateTo("campaigns");
          window.setTimeout(() => window.campaignsView?.openForm?.(), 100);
        }
        return;
      }

      if (action === "new-character") {
        window.charactersView?.openForm?.();
        return;
      }

      if (action === "open-campaigns") {
        await navigateTo("campaigns");
        return;
      }

      if (action === "open-characters") {
        await navigateTo("characters");
        return;
      }

      if (action === "open-dice") {
        const toolbar = document.getElementById("dice-toolbar");
        if (toolbar) {
          toolbar.scrollIntoView({ behavior: "smooth", block: "center" });
          toolbar.classList.add("dice-toolbar--flash");
          window.setTimeout(() => toolbar.classList.remove("dice-toolbar--flash"), 600);
        }
        return;
      }

      if (action === "open-campaign") {
        const id = Number(trigger.dataset.id);
        if (!Number.isFinite(id)) return;
        await navigateTo("campaigns");
        window.setTimeout(() => window.campaignsView?.openCampaign?.(id), 100);
        return;
      }
    });
  }
}
