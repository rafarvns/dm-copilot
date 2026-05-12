// DM Copilot - Database Views
// Views para gerenciamento de campanhas, personagens, encontros e notas

import databaseService from "../db/database.js";
import EncounterCombatView from "./encounter-combat-view.js";
import { icon, mountIcons } from "../core/icons.js";
import {
  VISIBILITY_AFFINITIES,
  VISIBILITY_FIELDS,
  parseVisibility,
  makeDefaultVisibility,
} from "../core/combat-visibility.js";
import {
  formatRelativeTime,
  pluralize,
  truncate,
  escapeHtml,
  normalizeDifficulty,
} from "../core/format.js";
import { showConfirm } from "../core/confirm-dialog.js";
import { modifier, formatModifier, formatCR } from "../core/dnd-stats.js";

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toastIcons = {
    success: icon("check-circle-2", { size: 18 }),
    error: icon("circle-x", { size: 18 }),
    info: icon("info", { size: 18 }),
  };
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${toastIcons[type] || toastIcons.info}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast--removing");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// View de Campanhas
// ============================================
class CampaignsView {
  constructor() {
    this.campaigns = [];
    this.filteredCampaigns = [];
    this.editingId = null;
    this.selectedCampaign = null;
    this.mounted = false;
    this.selectedCoverFile = null;
    this.removeCoverFlag = false;

    this.DOM = {};
  }

  // ============================================
  // Cache DOM references
  // ============================================
  cacheDOM() {
    this.DOM = {
      // List view
      listView: document.getElementById("campaigns-list-view"),
      list: document.getElementById("campaigns-list"),
      empty: document.getElementById("campaigns-empty"),
      count: document.getElementById("campaigns-count"),
      search: document.getElementById("campaign-search"),
      filterSystem: document.getElementById("campaign-filter-system"),
      sort: document.getElementById("campaign-sort"),
      btnNewCampaignEmpty: document.getElementById("btn-new-campaign-empty"),
      // Modal form
      modal: document.getElementById("campaign-modal"),
      modalOverlay: document.getElementById("campaign-modal-overlay"),
      modalTitle: document.getElementById("modal-title"),
      form: document.getElementById("campaign-form"),
      idInput: document.getElementById("campaign-id"),
      nameInput: document.getElementById("campaign-name"),
      systemSelect: document.getElementById("campaign-system"),
      descInput: document.getElementById("campaign-description"),
      errorName: document.getElementById("error-name"),
      // Detail view
      detail: document.getElementById("campaign-detail"),
      detailCover: document.getElementById("campaign-detail-cover"),
      detailCoverPlaceholder: document.getElementById("campaign-detail-cover-placeholder"),
      detailName: document.getElementById("detail-name"),
      detailSystem: document.getElementById("detail-system"),
      detailDesc: document.getElementById("detail-description"),
      detailCreated: document.getElementById("detail-created"),
      detailUpdated: document.getElementById("detail-updated"),
      detailCharCount: document.getElementById("detail-char-count"),
      detailCharList: document.getElementById("detail-characters-list"),
      detailCharEmpty: document.getElementById("detail-characters-empty"),
      // Cover uploader (form)
      imageInput: document.getElementById("campaign-image-input"),
      coverUploader: document.getElementById("campaign-cover-uploader"),
      coverPlaceholder: document.getElementById("campaign-cover-placeholder"),
      coverPreview: document.getElementById("campaign-cover-preview"),
      coverPreviewImg: document.getElementById("campaign-cover-preview-img"),
      btnRemoveCover: document.getElementById("btn-remove-campaign-cover"),

      // Detail - Encounters
      detailEncounterCount: document.getElementById("detail-encounter-count"),
      detailEncounterList: document.getElementById("detail-encounters-list"),
      detailEncounterEmpty: document.getElementById("detail-encounters-empty"),
      btnAddEncounter: document.getElementById("btn-add-encounter"),

      // Detail - Scenes
      detailSceneCount: document.getElementById("detail-scene-count"),
      detailSceneList: document.getElementById("detail-scenes-list"),
      detailSceneEmpty: document.getElementById("detail-scenes-empty"),
      btnAddScene: document.getElementById("btn-add-scene"),

      detailDescEmpty: document.getElementById("detail-description-empty"),
      detailCharCountBadge: document.getElementById("detail-char-count-badge"),
      detailSceneCountBadge: document.getElementById("detail-scene-count-badge"),
      detailEncounterCountBadge: document.getElementById("detail-encounter-count-badge"),

      // Link character modal
      linkModal: document.getElementById("link-character-modal"),
      linkModalOverlay: document.getElementById("link-char-modal-overlay"),
      linkCharList: document.getElementById("available-chars-list"),
      linkCharEmpty: document.getElementById("available-chars-empty"),
      linkCharSystemName: document.getElementById("link-char-system-name"),
    };

    // Cache visibility checkboxes (4 fields × 3 affinities)
    this.DOM.visibility = {};
    for (const aff of VISIBILITY_AFFINITIES) {
      this.DOM.visibility[aff] = {};
      for (const field of VISIBILITY_FIELDS) {
        this.DOM.visibility[aff][field] = document.getElementById(`vis-${aff}-${field}`);
      }
    }
  }

  populateVisibilityCheckboxes(jsonStr) {
    const vis = parseVisibility(jsonStr) || makeDefaultVisibility();
    for (const aff of VISIBILITY_AFFINITIES) {
      for (const field of VISIBILITY_FIELDS) {
        const cb = this.DOM.visibility?.[aff]?.[field];
        if (cb) cb.checked = !!vis[aff][field];
      }
    }
  }

  collectVisibilityFromCheckboxes() {
    const vis = makeDefaultVisibility();
    for (const aff of VISIBILITY_AFFINITIES) {
      for (const field of VISIBILITY_FIELDS) {
        const cb = this.DOM.visibility?.[aff]?.[field];
        if (cb) vis[aff][field] = !!cb.checked;
      }
    }
    return JSON.stringify(vis);
  }

  // ============================================
  // Lifecycle
  // ============================================
  async mount() {
    // Abort previously attached listeners (they may point to old DOM
    // elements from the template which has just been re-injected) and
    // bind a fresh set tied to the current AbortController.
    this._abortCtrl?.abort();
    this._abortCtrl = new AbortController();

    this.cacheDOM();
    this.bindEvents();
    await this.loadCampaigns();
    this.mounted = true;
  }

  _on(el, event, handler) {
    if (!el || !this._abortCtrl) return;
    el.addEventListener(event, handler, { signal: this._abortCtrl.signal });
  }

  // ============================================
  // Event Binding
  // ============================================
  bindEvents() {
    // New campaign buttons
    this._on(document.getElementById("btn-new-campaign"), "click", () => this.openForm());
    this._on(this.DOM.btnNewCampaignEmpty, "click", () => this.openForm());

    // Search, filter & sort
    this._on(this.DOM.search, "input", () => this.applyFilters());
    this._on(this.DOM.filterSystem, "change", () => this.applyFilters());
    this._on(this.DOM.sort, "change", () => this.applyFilters());

    // Form modal
    this._on(this.DOM.form, "submit", (e) => this.handleSubmit(e));
    this._on(document.getElementById("btn-close-modal"), "click", () => this.closeForm());
    this._on(document.getElementById("btn-cancel-form"), "click", () => this.closeForm());
    this._on(this.DOM.modalOverlay, "click", () => this.closeForm());

    // Detail view
    this._on(document.getElementById("btn-back-to-list"), "click", () => this.showList());
    this._on(document.getElementById("btn-edit-campaign"), "click", () => {
      if (this.selectedCampaign) this.openForm(this.selectedCampaign);
    });
    this._on(document.getElementById("btn-delete-campaign"), "click", () => {
      if (this.selectedCampaign) this.confirmDelete(this.selectedCampaign.id);
    });

    // Character linking
    this._on(document.getElementById("btn-add-char-to-campaign"), "click", () =>
      this.openLinkModal()
    );
    this._on(document.getElementById("btn-close-link-char-modal"), "click", () =>
      this.closeLinkModal()
    );
    this._on(document.getElementById("btn-close-link-char"), "click", () => this.closeLinkModal());
    this._on(this.DOM.linkModalOverlay, "click", () => this.closeLinkModal());
    this._on(this.DOM.detailCharList, "click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const action = target.dataset.action;
      if (action === "unlink") {
        this.handleUnlinkChar(e);
      } else if (action === "edit-char") {
        this.handleEditChar(e);
      } else if (action === "delete-char") {
        this.handleDeleteChar(e);
      }
    });
    this._on(this.DOM.linkCharList, "click", (e) => this.handleLinkChar(e));

    // Card delegation
    this._on(this.DOM.list, "click", (e) => this.handleCardClick(e));

    // Clear validation on input
    this._on(this.DOM.nameInput, "input", () => this.clearFieldError("name"));

    // Cover uploader
    this._on(this.DOM.coverUploader, "click", () => this.DOM.imageInput?.click());
    this._on(this.DOM.imageInput, "change", (e) => this.handleCoverSelect(e));
    this._on(this.DOM.btnRemoveCover, "click", (e) => {
      e.stopPropagation();
      this.handleCoverRemove();
    });

    // Encounter events
    this._on(this.DOM.btnAddEncounter, "click", () => {
      if (this.selectedCampaign) {
        window.encountersView.openForm(null, this.selectedCampaign.id);
      }
    });

    this._on(this.DOM.detailEncounterList, "click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      const id = parseInt(btn.dataset.id, 10);
      const action = btn.dataset.action;

      if (action === "view-encounter") {
        window.encountersView.openEncounterManager(id);
      } else if (action === "edit-encounter") {
        window.encountersView.loadEncounterForEdit(id);
      } else if (action === "delete-encounter") {
        window.encountersView.confirmDelete(id);
      }
    });

    // Scene events
    this._on(this.DOM.btnAddScene, "click", () => {
      if (this.selectedCampaign) {
        window.scenesView?.openForm(null, this.selectedCampaign.id);
      }
    });

    this._on(this.DOM.detailSceneList, "click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      const id = parseInt(btn.dataset.id, 10);
      const action = btn.dataset.action;

      if (action === "delete-scene") {
        window.scenesView?.confirmDelete(id);
      } else if (action === "open-scene") {
        window.scenesView?.openSceneDetail(id);
      } else if (action === "edit-scene") {
        window.scenesView?.loadSceneForEdit(id);
      }
    });

    // Empty state CTAs
    this._on(this.DOM.detailCharEmpty, "click", (e) => {
      if (e.target.closest('[data-action="add-char-empty"]')) {
        this.openLinkModal();
      }
    });

    this._on(this.DOM.detailEncounterEmpty, "click", (e) => {
      if (e.target.closest('[data-action="add-encounter-empty"]')) {
        if (this.selectedCampaign) {
          window.encountersView.openForm(null, this.selectedCampaign.id);
        }
      }
    });

    this._on(this.DOM.detailSceneEmpty, "click", (e) => {
      if (e.target.closest('[data-action="add-scene-empty"]')) {
        if (this.selectedCampaign) {
          window.scenesView?.openForm(null, this.selectedCampaign.id);
        }
      }
    });
  }

  // ============================================
  // Load campaigns from database
  // ============================================
  async loadCampaigns() {
    if (!databaseService.isReady()) {
      console.warn("Database not ready");
      this.campaigns = [];
      this.filteredCampaigns = [];
      this.render();
      return;
    }

    this.renderSkeletons();

    try {
      this.campaigns = await databaseService.getAllCampaigns();
      const statsArr = await Promise.all(
        this.campaigns.map((c) =>
          databaseService
            .getCampaignStats(c.id)
            .catch(() => ({ characters: 0, encounters: 0, scenes: 0 }))
        )
      );
      this.campaigns.forEach((c, i) => {
        c._stats = statsArr[i];
      });
      this.applyFilters();
    } catch (err) {
      console.warn("Falha ao carregar campanhas:", err);
      this.campaigns = [];
      this.applyFilters();
    }
  }

  renderSkeletons() {
    const skel = `
      <div class="campaign-card campaign-card--skeleton">
        <div class="campaign-card__cover campaign-card__cover--skeleton"></div>
        <div class="campaign-card__body">
          <div class="campaign-card__skeleton-line" style="width: 70%;"></div>
          <div class="campaign-card__skeleton-line" style="width: 90%;"></div>
          <div class="campaign-card__skeleton-line" style="width: 40%;"></div>
        </div>
      </div>
    `;
    if (this.DOM.list) {
      this.DOM.list.innerHTML = skel.repeat(4);
      this.DOM.list.hidden = false;
      if (this.DOM.empty) this.DOM.empty.hidden = true;
    }
  }

  // ============================================
  // Filtering
  // ============================================
  applyFilters() {
    const q = (this.DOM.search?.value ?? "").toLowerCase().trim();
    const sys = this.DOM.filterSystem?.value ?? "";
    const sortMode = this.DOM.sort?.value ?? "recent";

    this.filteredCampaigns = this.campaigns.filter((c) => {
      const matchesQ =
        !q ||
        (c.name?.toLowerCase().includes(q)) ||
        (c.description?.toLowerCase().includes(q));
      const matchesSys = !sys || c.system === sys;
      return matchesQ && matchesSys;
    });

    this.filteredCampaigns.sort((a, b) => {
      if (sortMode === "az") return (a.name || "").localeCompare(b.name || "", "pt-BR");
      if (sortMode === "za") return (b.name || "").localeCompare(a.name || "", "pt-BR");
      if (sortMode === "oldest")
        return new Date(a.updated_at || 0) - new Date(b.updated_at || 0);
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });

    this.render();
  }

  // ============================================
  // Rendering
  // ============================================
  render() {
    if (!this.DOM.list) return;

    if (this.DOM.count) {
      const total = this.campaigns.length;
      const shown = this.filteredCampaigns.length;
      this.DOM.count.textContent =
        total === shown
          ? `${total} campanha${total !== 1 ? "s" : ""}`
          : `${shown} de ${total} campanha${total !== 1 ? "s" : ""}`;
    }

    if (this.filteredCampaigns.length === 0) {
      this.DOM.list.hidden = true;
      if (this.DOM.empty) this.DOM.empty.hidden = false;
      return;
    }

    this.DOM.list.hidden = false;
    if (this.DOM.empty) this.DOM.empty.hidden = true;
    this.renderCards();
  }

  renderCards() {
    this.DOM.list.innerHTML = this.filteredCampaigns.map((c) => this.renderCard(c)).join("");
    mountIcons(this.DOM.list);
  }

  renderCard(c) {
    const cover = c.image_path
      ? `<img class="campaign-card__cover" src="local-image://${c.image_path}" alt="" loading="lazy" />`
      : `<div class="campaign-card__cover-placeholder"><i data-icon="image"></i></div>`;

    const stats = c._stats ?? { characters: 0, encounters: 0, scenes: 0 };
    const desc = c.description ? escapeHtml(truncate(c.description, 100)) : "";
    const name = escapeHtml(c.name ?? "Sem título");
    const system = c.system ? escapeHtml(c.system) : null;
    const updatedRel = escapeHtml(formatRelativeTime(c.updated_at));

    return `
      <article class="campaign-card" data-id="${c.id}">
        ${cover}
        <div class="campaign-card__body">
          <div class="campaign-card__header">
            <h3 class="campaign-card__title">${name}</h3>
            ${system ? `<span class="badge badge--primary campaign-card__system">${system}</span>` : ""}
          </div>
          ${desc ? `<p class="campaign-card__desc">${desc}</p>` : ""}
          <div class="campaign-card__footer">
            <div class="campaign-card__stats">
              <span class="campaign-card__stat" title="Personagens"><i data-icon="users"></i> ${stats.characters}</span>
              <span class="campaign-card__stat" title="Encontros"><i data-icon="swords"></i> ${stats.encounters}</span>
              <span class="campaign-card__stat" title="Cenas"><i data-icon="eye"></i> ${stats.scenes}</span>
            </div>
            <span class="campaign-card__time">${updatedRel}</span>
            <div class="campaign-card__actions">
              <button class="campaign-card__btn" data-action="edit" title="Editar">
                <i data-icon="pencil"></i>
              </button>
              <button class="campaign-card__btn campaign-card__btn--delete" data-action="delete" title="Excluir">
                <i data-icon="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  async renderDetail(campaign) {
    if (!this.DOM.detail) return;

    this.selectedCampaign = campaign;

    // Hero — capa
    if (campaign.image_path && this.DOM.detailCover) {
      this.DOM.detailCover.src = `local-image://${campaign.image_path}`;
      this.DOM.detailCover.hidden = false;
      if (this.DOM.detailCoverPlaceholder) this.DOM.detailCoverPlaceholder.hidden = true;
    } else {
      if (this.DOM.detailCover) {
        this.DOM.detailCover.removeAttribute("src");
        this.DOM.detailCover.hidden = true;
      }
      if (this.DOM.detailCoverPlaceholder) this.DOM.detailCoverPlaceholder.hidden = false;
    }

    // Título + badge sistema
    if (this.DOM.detailName) this.DOM.detailName.textContent = campaign.name ?? "";
    if (this.DOM.detailSystem) {
      if (campaign.system) {
        this.DOM.detailSystem.textContent = campaign.system;
        this.DOM.detailSystem.hidden = false;
      } else {
        this.DOM.detailSystem.hidden = true;
      }
    }

    // Descrição
    if (this.DOM.detailDesc) {
      if (campaign.description) {
        this.DOM.detailDesc.textContent = campaign.description;
        this.DOM.detailDesc.hidden = false;
        if (this.DOM.detailDescEmpty) this.DOM.detailDescEmpty.hidden = true;
      } else {
        this.DOM.detailDesc.textContent = "";
        this.DOM.detailDesc.hidden = true;
        if (this.DOM.detailDescEmpty) this.DOM.detailDescEmpty.hidden = false;
      }
    }

    // Data de criação
    if (this.DOM.detailCreated) {
      this.DOM.detailCreated.textContent = `Criada em ${this.formatDate(campaign.created_at)}`;
    }

    // Micro-stats (usa _stats do batch já carregado, ou busca individualmente)
    const stats =
      campaign._stats ??
      (await databaseService
        .getCampaignStats(campaign.id)
        .catch(() => ({ characters: 0, encounters: 0, scenes: 0 })));

    if (this.DOM.detailCharCount) this.DOM.detailCharCount.textContent = stats.characters;
    if (this.DOM.detailEncounterCount) this.DOM.detailEncounterCount.textContent = stats.encounters;
    if (this.DOM.detailSceneCount) this.DOM.detailSceneCount.textContent = stats.scenes;
    if (this.DOM.detailUpdated) {
      const rel = formatRelativeTime(campaign.updated_at);
      this.DOM.detailUpdated.textContent = rel || "—";
    }

    // Carregar sub-entidades em paralelo
    await Promise.all([
      this.loadCampaignCharacters(campaign.id),
      this.loadCampaignEncounters(campaign.id),
      this.loadCampaignScenes(campaign.id),
    ]);

    mountIcons(this.DOM.detail);
  }

  async loadCampaignCharacters(campaignId) {
    try {
      const characters = await databaseService.getCharactersByCampaign(campaignId);
      this.renderCampaignCharacters(characters);
    } catch (error) {
      console.error("Failed to load campaign characters:", error);
      showToast("Erro ao carregar personagens da campanha", "error");
    }
  }

  renderCampaignCharacters(characters) {
    if (!this.DOM.detailCharList) return;

    const count = characters.length;
    this.DOM.detailCharCount.textContent = count;
    if (this.DOM.detailCharCountBadge) {
      this.DOM.detailCharCountBadge.textContent = pluralize(count, "personagem", "personagens");
    }

    const isEmpty = count === 0;
    this.DOM.detailCharEmpty.classList.toggle("hidden", !isEmpty);
    this.DOM.detailCharList.classList.toggle("hidden", isEmpty);

    if (!isEmpty) {
      const cardHtml = (char) => {
        const avatar = char.image_path
          ? `<img src="local-image://${escapeHtml(char.image_path)}" alt="" loading="lazy" />`
          : `<i data-icon="user"></i>`;
        const name = escapeHtml(char.name ?? "Sem nome");
        const system = char.system ? escapeHtml(char.system) : "";
        const hp = char.hp ?? "—";
        const ac = char.ac ?? "—";
        const ini = char.ini ?? "—";

        return `
          <article class="campaign-character-card" data-id="${char.id}" data-action="edit-char">
            <div class="campaign-character-card__header">
              <div class="campaign-character-card__avatar">${avatar}</div>
              <div class="campaign-character-card__title-block">
                <h3 class="campaign-character-card__name">${name}</h3>
                ${system ? `<span class="campaign-character-card__system">${system}</span>` : ""}
              </div>
              <div class="campaign-character-card__actions">
                <button class="campaign-card__btn" data-action="edit-char" data-id="${char.id}" title="Editar">
                  <i data-icon="pencil"></i>
                </button>
                <button class="campaign-card__btn" data-action="unlink" data-id="${char.id}" title="Desvincular">
                  <i data-icon="circle-x"></i>
                </button>
                <button class="campaign-card__btn campaign-card__btn--delete" data-action="delete-char" data-id="${char.id}" title="Excluir">
                  <i data-icon="trash-2"></i>
                </button>
              </div>
            </div>
            <div class="campaign-character-card__stats">
              <div class="stat-box stat-box--hp">
                <span class="stat-box__label">HP</span>
                <span class="stat-box__value">${hp}</span>
              </div>
              <div class="stat-box stat-box--ac">
                <span class="stat-box__label">CA</span>
                <span class="stat-box__value">${ac}</span>
              </div>
              <div class="stat-box stat-box--initiative">
                <span class="stat-box__label">INI</span>
                <span class="stat-box__value">${ini}</span>
              </div>
            </div>
          </article>
        `;
      };

      this.DOM.detailCharList.innerHTML = characters.map(cardHtml).join("");
      mountIcons(this.DOM.detailCharList);
    }
  }

  async loadCampaignEncounters(campaignId) {
    try {
      const encounters = await databaseService.getEncountersByCampaign(campaignId);
      this.renderCampaignEncounters(encounters);
    } catch (error) {
      console.error("Failed to load campaign encounters:", error);
      showToast("Erro ao carregar encontros da campanha", "error");
    }
  }

  renderCampaignEncounters(encounters) {
    if (!this.DOM.detailEncounterList) return;

    const count = encounters.length;
    this.DOM.detailEncounterCount.textContent = count;
    if (this.DOM.detailEncounterCountBadge) {
      this.DOM.detailEncounterCountBadge.textContent = pluralize(count, "encontro", "encontros");
    }

    const isEmpty = count === 0;
    this.DOM.detailEncounterEmpty.classList.toggle("hidden", !isEmpty);
    this.DOM.detailEncounterList.classList.toggle("hidden", isEmpty);

    if (!isEmpty) {
      const cardHtml = (enc) => {
        const cover = enc.background_image
          ? `<img class="campaign-encounter-card__cover" src="${escapeHtml(enc.background_image)}" alt="" loading="lazy" />`
          : `<div class="campaign-encounter-card__cover-placeholder"><i data-icon="swords"></i></div>`;
        const name = escapeHtml(enc.name ?? "Sem título");
        const diff = enc.difficulty
          ? `<span class="badge badge--difficulty-${normalizeDifficulty(enc.difficulty)}">${escapeHtml(enc.difficulty)}</span>`
          : "";
        const loc = enc.location
          ? `<span class="campaign-encounter-card__meta-item"><i data-icon="map-pin"></i> ${escapeHtml(truncate(enc.location, 40))}</span>`
          : "";
        const time = enc.created_at ? escapeHtml(formatRelativeTime(enc.created_at)) : "";

        return `
          <article class="campaign-encounter-card" data-id="${enc.id}" data-action="view-encounter">
            ${cover}
            <div class="campaign-encounter-card__body">
              <h3 class="campaign-encounter-card__name">${name}</h3>
              <div class="campaign-encounter-card__meta">
                ${diff}
                ${loc}
              </div>
              <div class="campaign-encounter-card__footer">
                <span class="campaign-encounter-card__time">${time}</span>
                <div class="campaign-encounter-card__actions">
                  <button class="campaign-card__btn" data-action="edit-encounter" data-id="${enc.id}" title="Editar">
                    <i data-icon="pencil"></i>
                  </button>
                  <button class="campaign-card__btn campaign-card__btn--delete" data-action="delete-encounter" data-id="${enc.id}" title="Excluir">
                    <i data-icon="trash-2"></i>
                  </button>
                </div>
              </div>
            </div>
          </article>
        `;
      };

      this.DOM.detailEncounterList.innerHTML = encounters.map(cardHtml).join("");
      mountIcons(this.DOM.detailEncounterList);
    }
  }

  async loadCampaignScenes(campaignId) {
    try {
      const scenes = await window.dmCopilot.db.scenes.getAll(campaignId);
      this.renderCampaignScenes(scenes || []);
    } catch (error) {
      console.error("Failed to load campaign scenes:", error);
      showToast("Erro ao carregar cenas da campanha", "error");
    }
  }

  renderCampaignScenes(scenes) {
    if (!this.DOM.detailSceneList) return;

    const count = scenes.length;
    if (this.DOM.detailSceneCount) this.DOM.detailSceneCount.textContent = count;
    if (this.DOM.detailSceneCountBadge) {
      this.DOM.detailSceneCountBadge.textContent = pluralize(count, "cena", "cenas");
    }

    const isEmpty = count === 0;
    this.DOM.detailSceneEmpty?.classList.toggle("hidden", !isEmpty);
    this.DOM.detailSceneList.classList.toggle("hidden", isEmpty);

    if (!isEmpty) {
      const cardHtml = (scene) => {
        const cover = scene.background_image
          ? `<img class="campaign-scene-card__cover" src="${escapeHtml(scene.background_image)}" alt="" loading="lazy" />`
          : `<div class="campaign-scene-card__cover-placeholder"><i data-icon="eye"></i></div>`;
        const name = escapeHtml(scene.name ?? scene.title ?? "Sem título");
        const desc = scene.description ? escapeHtml(truncate(scene.description, 100)) : "";
        const time = formatRelativeTime(scene.created_at);

        return `
          <article class="campaign-scene-card" data-id="${scene.id}" data-action="open-scene">
            ${cover}
            <div class="campaign-scene-card__body">
              <h3 class="campaign-scene-card__name">${name}</h3>
              ${desc ? `<p class="campaign-scene-card__desc">${desc}</p>` : ""}
              <div class="campaign-scene-card__footer">
                <span>${escapeHtml(time)}</span>
                <div class="campaign-scene-card__actions">
                  <button class="campaign-card__btn" data-action="edit-scene" data-id="${scene.id}" title="Editar">
                    <i data-icon="pencil"></i>
                  </button>
                  <button class="campaign-card__btn campaign-card__btn--delete" data-action="delete-scene" data-id="${scene.id}" title="Excluir">
                    <i data-icon="trash-2"></i>
                  </button>
                </div>
              </div>
            </div>
          </article>
        `;
      };

      this.DOM.detailSceneList.innerHTML = scenes.map(cardHtml).join("");
      mountIcons(this.DOM.detailSceneList);
    }
  }

  // ============================================
  // Character Management (Link / Unlink)
  // ============================================
  async openLinkModal() {
    if (!this.selectedCampaign) return;

    const campaign = this.selectedCampaign;
    this.DOM.linkCharSystemName.textContent = campaign.system || "Qualquer";
    this.DOM.linkModal.classList.remove("hidden");

    await this.loadAvailableCharacters();
  }

  closeLinkModal() {
    this.DOM.linkModal.classList.add("hidden");
  }

  async loadAvailableCharacters() {
    try {
      const available = await databaseService.getAvailableCharactersForCampaign(
        this.selectedCampaign.id,
        this.selectedCampaign.system
      );
      this.renderAvailableCharacters(available);
    } catch (error) {
      console.error("Failed to load available characters:", error);
    }
  }

  renderAvailableCharacters(characters) {
    const isEmpty = characters.length === 0;
    this.DOM.linkCharEmpty.classList.toggle("hidden", !isEmpty);
    this.DOM.linkCharList.classList.toggle("hidden", isEmpty);

    if (!isEmpty) {
      this.DOM.linkCharList.innerHTML = characters
        .map((char) => {
          const avatarContent = char.image_path
            ? `<img src="local-image://${char.image_path}" alt="${char.name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`
            : `<span class="character-card__avatar-placeholder">${icon("user", { size: 20 })}</span>`;

          return `
          <div class="char-selection-item">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="char-selection-avatar" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--color-surface-active); border-radius: 50%; overflow: hidden;">
                ${avatarContent}
              </div>
              <div class="char-selection-info">
                <span class="char-selection-name">${this.escapeHTML(char.name)}</span>
                <span class="char-selection-meta">HP: ${char.hp} | AC: ${char.ac} | Ini: ${char.ini}</span>
              </div>
            </div>
            <button class="btn btn--primary btn--sm" data-action="link" data-id="${char.id}">
              Adicionar
            </button>
          </div>
        `;
        })
        .join("");
    }
  }

  async handleLinkChar(e) {
    const btn = e.target.closest('[data-action="link"]');
    if (!btn) return;

    const charId = parseInt(btn.dataset.id, 10);
    try {
      await databaseService.linkCharacterToCampaign(charId, this.selectedCampaign.id);
      showToast("Personagem adicionado!");
      await this.loadAvailableCharacters();
      await this.loadCampaignCharacters(this.selectedCampaign.id);
    } catch (error) {
      showToast("Erro ao vincular personagem", "error");
    }
  }

  async handleUnlinkChar(e) {
    const btn = e.target.closest('[data-action="unlink"]');
    if (!btn) return;

    const charId = parseInt(btn.dataset.id, 10);
    const ok = await showConfirm({
      title: "Remover da Campanha",
      message:
        "Deseja remover este personagem da campanha? O personagem continuará existindo no sistema.",
      confirmLabel: "Remover da Campanha",
      cancelLabel: "Cancelar",
      confirmVariant: "primary",
      confirmIcon: "x",
    });
    if (!ok) return;
    try {
      await databaseService.unlinkCharacterFromCampaign(charId, this.selectedCampaign.id);
      showToast("Personagem removido da campanha");
      await this.loadCampaignCharacters(this.selectedCampaign.id);
    } catch (error) {
      showToast("Erro ao remover personagem", "error");
    }
  }

  async handleEditChar(e) {
    const btn = e.target.closest('[data-action="edit-char"]');
    if (!btn) return;

    const charId = parseInt(btn.dataset.id, 10);
    try {
      const char = await databaseService.getCharacterById(charId);
      if (char) {
        // Here we need to open the global character form.
        // For simplicity, we can dispatch a custom event or just use the global instance if we can get it.
        // Dispatching a custom event is cleaner.
        window.dispatchEvent(new CustomEvent("app:edit-character", { detail: char }));
      }
    } catch (error) {
      showToast("Erro ao carregar personagem", "error");
    }
  }

  async handleDeleteChar(e) {
    const btn = e.target.closest('[data-action="delete-char"]');
    if (!btn) return;

    const charId = parseInt(btn.dataset.id, 10);
    const ok = await showConfirm({
      title: "Excluir Personagem",
      message:
        "Tem certeza que deseja excluir permanentemente este personagem? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      confirmVariant: "danger",
      confirmIcon: "trash-2",
    });
    if (!ok) return;
    try {
      await databaseService.deleteCharacter(charId);
      showToast("Personagem excluído");
      await this.loadCampaignCharacters(this.selectedCampaign.id);
    } catch (error) {
      showToast("Erro ao excluir", "error");
    }
  }

  // ============================================
  // Card click delegation
  // ============================================
  handleCardClick(e) {
    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      e.stopPropagation();
      const card = actionBtn.closest(".campaign-card");
      const id = Number(card?.dataset.id);
      const campaign = this.campaigns.find((c) => c.id === id);
      if (!campaign) return;
      if (actionBtn.dataset.action === "edit") this.openForm(campaign);
      else if (actionBtn.dataset.action === "delete") this.confirmDelete(id);
      return;
    }

    // Click on card itself → open detail
    const card = e.target.closest(".campaign-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    const campaign = this.campaigns.find((c) => c.id === id);
    if (campaign) this.openDetail(campaign);
  }

  // ============================================
  // Form (Create / Edit)
  // ============================================
  openForm(campaign = null) {
    this.editingId = campaign ? campaign.id : null;

    // Update modal title
    if (this.DOM.modalTitle) {
      this.DOM.modalTitle.textContent = campaign ? "Editar Campanha" : "Nova Campanha";
    }

    // Fill form
    if (this.DOM.idInput) this.DOM.idInput.value = campaign ? campaign.id : "";
    if (this.DOM.nameInput) this.DOM.nameInput.value = campaign ? campaign.name : "";
    if (this.DOM.systemSelect) this.DOM.systemSelect.value = campaign ? campaign.system || "" : "";
    if (this.DOM.descInput) this.DOM.descInput.value = campaign ? campaign.description || "" : "";
    this.populateVisibilityCheckboxes(campaign ? campaign.combat_visibility : null);

    // Reset cover state
    this.selectedCoverFile = null;
    this.removeCoverFlag = false;
    if (this.DOM.imageInput) this.DOM.imageInput.value = "";

    if (campaign?.image_path) {
      if (this.DOM.coverPreviewImg)
        this.DOM.coverPreviewImg.src = `local-image://${campaign.image_path}`;
      if (this.DOM.coverPreview) this.DOM.coverPreview.hidden = false;
      if (this.DOM.coverPlaceholder) this.DOM.coverPlaceholder.hidden = true;
    } else {
      if (this.DOM.coverPreviewImg) this.DOM.coverPreviewImg.removeAttribute("src");
      if (this.DOM.coverPreview) this.DOM.coverPreview.hidden = true;
      if (this.DOM.coverPlaceholder) this.DOM.coverPlaceholder.hidden = false;
    }

    // Clear errors
    this.clearAllErrors();

    // Show modal
    if (this.DOM.modal) {
      this.DOM.modal.classList.remove("hidden");
      this.DOM.nameInput?.focus();
    }
  }

  closeForm() {
    if (this.DOM.modal) {
      this.DOM.modal.classList.add("hidden");
    }
    this.editingId = null;
    this.clearAllErrors();
  }

  async handleSubmit(e) {
    e.preventDefault();

    const name = this.DOM.nameInput?.value.trim() || "";
    const system = this.DOM.systemSelect?.value || "";
    const description = this.DOM.descInput?.value.trim() || "";

    // Validate
    if (!this.validate({ name })) return;

    const combat_visibility = this.collectVisibilityFromCheckboxes();

    const data = {
      name,
      system: system || null,
      description: description || null,
      combat_visibility,
    };

    // Image pipeline
    if (this.selectedCoverFile) {
      try {
        const buffer = await this.processCoverImage(this.selectedCoverFile);
        data.image_path = await databaseService.saveCampaignImage(buffer);
      } catch (err) {
        console.error("Falha ao processar/salvar capa:", err);
        showToast("Erro ao processar imagem de capa", "error");
        return;
      }
    } else if (this.removeCoverFlag) {
      data.image_path = null;
    }
    // Se nenhum dos dois e estiver editando: omitir image_path para preservar o atual

    try {
      if (this.editingId) {
        // Update
        await databaseService.updateCampaign(this.editingId, data);
        showToast("Campanha atualizada com sucesso!", "success");
      } else {
        // Create
        await databaseService.createCampaign(data);
        showToast("Campanha criada com sucesso!", "success");
      }

      this.closeForm();
      await this.loadCampaigns();

      // If we were viewing detail, refresh it
      if (this.selectedCampaign && this.editingId === this.selectedCampaign.id) {
        const updated = this.campaigns.find((c) => c.id === this.editingId);
        if (updated) {
          this.selectedCampaign = updated;
          this.renderDetail(updated);
        }
      }

      // Live-sync: if a combat is currently broadcasting for an encounter
      // belonging to this campaign, push the new visibility to players right away.
      const enc = window.encountersView?.combatView;
      if (enc?.isActive && enc.currentEncounter?.campaign_id === this.editingId) {
        enc.currentCampaign = { ...(enc.currentCampaign || {}), combat_visibility };
        enc.broadcastState();
      }
    } catch (error) {
      console.error("Failed to save campaign:", error);
      showToast("Erro ao salvar campanha", "error");
    }
  }

  // ============================================
  // Validation
  // ============================================
  validate({ name }) {
    let valid = true;

    if (!name) {
      this.showFieldError("name", "O nome da campanha é obrigatório");
      valid = false;
    } else if (name.length < 3) {
      this.showFieldError("name", "O nome deve ter pelo menos 3 caracteres");
      valid = false;
    }

    return valid;
  }

  showFieldError(field, message) {
    const errorEl = this.DOM[`error${field.charAt(0).toUpperCase() + field.slice(1)}`];
    const inputEl = this.DOM[`${field}Input`];

    if (errorEl) errorEl.textContent = message;
    if (inputEl) inputEl.classList.add("form-input--error");
  }

  clearFieldError(field) {
    const errorEl = this.DOM[`error${field.charAt(0).toUpperCase() + field.slice(1)}`];
    const inputEl = this.DOM[`${field}Input`];

    if (errorEl) errorEl.textContent = "";
    if (inputEl) inputEl.classList.remove("form-input--error");
  }

  clearAllErrors() {
    if (this.DOM.errorName) this.DOM.errorName.textContent = "";
    if (this.DOM.nameInput) this.DOM.nameInput.classList.remove("form-input--error");
  }

  // ============================================
  // Detail View
  // ============================================
  openDetail(campaign) {
    this.selectedCampaign = campaign;
    this.renderDetail(campaign);

    if (this.DOM.listView) this.DOM.listView.classList.add("hidden");
    if (this.DOM.detail) this.DOM.detail.classList.remove("hidden");
  }

  showList() {
    this.selectedCampaign = null;

    if (this.DOM.detail) this.DOM.detail.classList.add("hidden");
    if (this.DOM.listView) this.DOM.listView.classList.remove("hidden");
  }

  // Abre o detalhe de uma campanha pelo id — usado pelo dashboard ao clicar no card "Continuar".
  async openCampaign(id) {
    if (!id) return;
    try {
      const campaign = await databaseService.getCampaignById(id);
      if (!campaign) {
        console.warn(`Campaign id ${id} não encontrada.`);
        return;
      }
      this.openDetail(campaign);
    } catch (err) {
      console.error("Falha ao abrir campanha:", err);
    }
  }

  // ============================================
  // Delete
  // ============================================
  async confirmDelete(id) {
    const campaign = this.campaigns.find((c) => c.id === id);
    const name = campaign?.name || "esta campanha";
    const ok = await showConfirm({
      title: "Excluir Campanha",
      message: `Tem certeza que deseja excluir "${name}"? Esta ação removerá todos os encontros, cenas e vínculos. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir Campanha",
      cancelLabel: "Cancelar",
      confirmVariant: "danger",
      confirmIcon: "trash-2",
    });
    if (!ok) return;

    try {
      await databaseService.deleteCampaign(id);
      showToast("Campanha excluída com sucesso!", "success");

      // If viewing detail of deleted campaign, go back to list
      if (this.selectedCampaign && this.selectedCampaign.id === id) {
        this.showList();
      }

      await this.loadCampaigns();
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      showToast("Erro ao excluir campanha", "error");
    }
  }

  // ============================================
  // Cover image upload (Fase 5)
  // ============================================
  handleCoverSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      console.warn("Arquivo selecionado não é uma imagem");
      return;
    }
    this.selectedCoverFile = file;
    this.removeCoverFlag = false;

    const reader = new FileReader();
    reader.onload = () => {
      if (this.DOM.coverPreviewImg) this.DOM.coverPreviewImg.src = reader.result;
      if (this.DOM.coverPlaceholder) this.DOM.coverPlaceholder.hidden = true;
      if (this.DOM.coverPreview) this.DOM.coverPreview.hidden = false;
    };
    reader.readAsDataURL(file);
  }

  handleCoverRemove() {
    this.selectedCoverFile = null;
    this.removeCoverFlag = true;
    if (this.DOM.imageInput) this.DOM.imageInput.value = "";
    if (this.DOM.coverPreviewImg) this.DOM.coverPreviewImg.removeAttribute("src");
    if (this.DOM.coverPreview) this.DOM.coverPreview.hidden = true;
    if (this.DOM.coverPlaceholder) this.DOM.coverPlaceholder.hidden = false;
  }

  async processCoverImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const maxH = 675;
        let { width, height } = img;
        const ratio = Math.min(maxW / width, maxH / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error("Falha ao processar imagem"));
              return;
            }
            const arrayBuffer = await blob.arrayBuffer();
            resolve(new Uint8Array(arrayBuffer));
          },
          "image/webp",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      img.src = URL.createObjectURL(file);
    });
  }

  // ============================================
  // Helpers
  // ============================================
  formatDate(isoString) {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

// ============================================
// View de Personagens (placeholder)
// ============================================
class CharactersView {
  constructor() {
    this.characters = [];
    this.currentCampaignId = null;
  }

  async loadCharacters(campaignId) {
    this.currentCampaignId = campaignId;
    try {
      this.characters = await databaseService.getCharactersByCampaign(campaignId);
      this.render();
    } catch (error) {
      console.error("Failed to load characters:", error);
    }
  }

  render() {
    console.log("Characters:", this.characters);
  }
}

// ============================================
// View de Encontros (placeholder)
// ============================================
class EncountersView {
  constructor() {
    this.encounters = [];
    this.currentCampaignId = null;
    this.currentEncounter = null;
    this.editingEncounterId = null;
    this.participants = []; // Current encounter participants
    this.affinityGroups = { ally: [], neutral: [], enemy: [] };
    this.combatView = new EncounterCombatView(this);
    this.bgPresetsLoaded = false;
    this._monsterDetailCache = new Map(); // Map<index, monsterDetail>

    this.initDOM();
    this.initEvents();
  }

  initDOM() {
    console.log("EncountersView: Initializing DOM references...");
    this.DOM = {
      // Encounter List & Metadata Modal
      modal: document.getElementById("encounter-modal"),
      modalTitle: document.getElementById("encounter-modal-title"),
      form: document.getElementById("encounter-form"),
      idInput: document.getElementById("encounter-id"),
      nameInput: document.getElementById("encounter-name"),
      difficultyGroup: document.getElementById("encounter-difficulty"),
      locationInput: document.getElementById("encounter-location"),
      descInput: document.getElementById("encounter-description"),
      btnCancel: document.getElementById("btn-cancel-encounter-form"),
      btnCloseModal: document.getElementById("btn-close-encounter-modal"),
      modalOverlay: document.getElementById("encounter-modal-overlay"),

      // Music picker
      musicUrlInput: document.getElementById("encounter-music-url"),
      musicFileInput: document.getElementById("encounter-music-file"),
      musicStatus: document.getElementById("encounter-music-status"),
      btnMusicRemove: document.getElementById("btn-encounter-music-remove"),
      btnSaveEncounter: document.getElementById("btn-save-encounter-form"),

      // Visibility override
      visibilityOverrideToggle: document.getElementById("encounter-visibility-override"),
      visibilityGrid: document.getElementById("encounter-visibility-grid"),

      // Background image picker
      bgInput: document.getElementById("encounter-background-image"),
      bgTabs: document.querySelectorAll(".encounter-bg-tab"),
      bgGallery: document.getElementById("encounter-bg-gallery"),
      bgFile: document.getElementById("encounter-bg-file"),
      btnBgUpload: document.getElementById("btn-encounter-bg-upload"),
      bgUploadName: document.getElementById("encounter-bg-upload-name"),
      bgPreview: document.getElementById("encounter-bg-preview"),
      bgPreviewWrapper: document.getElementById("encounter-bg-preview-wrapper"),
      bgPanels: {
        gallery: document.getElementById("bg-gallery"),
        upload: document.getElementById("bg-upload"),
        none: document.getElementById("bg-none"),
      },

      // Encounter Detail View (Manager)
      detailView: document.getElementById("encounter-detail-view"),
      viewName: document.getElementById("view-encounter-name"),
      viewDifficulty: document.getElementById("view-encounter-difficulty"),
      viewLocation: document.getElementById("view-encounter-location"),
      btnCloseDetail: document.getElementById("btn-close-encounter-detail"),
      btnEditCurrent: document.getElementById("btn-edit-encounter-current"),

      // Affinity Lists
      listAllies: document.getElementById("list-allies"),
      listNeutrals: document.getElementById("list-neutrals"),
      listEnemies: document.getElementById("list-enemies"),

      // Add Participant Modal
      partModal: document.getElementById("add-participant-modal"),
      btnClosePartModal: document.getElementById("btn-close-participant-modal"),
      partModalOverlay: document.getElementById("add-participant-modal-overlay"),
      dbPartList: document.getElementById("db-participant-list"),
      apiPartList: document.getElementById("api-monster-list"),
      quickAddForm: document.getElementById("quick-add-form"),
      dbCharSearch: document.getElementById("db-char-search"),
      apiMonsterSearch: document.getElementById("api-monster-search"),
      tabs: document.querySelectorAll(".tab-btn"),
      tabContents: document.querySelectorAll(".tab-content"),
      btnAddPartMain: document.getElementById("btn-add-participant-main"),
      sectionAllies: document.getElementById("section-allies"),
      sectionNeutrals: document.getElementById("section-neutrals"),
      sectionEnemies: document.getElementById("section-enemies"),
    };

    // Visibility override checkboxes (4 fields × 3 affinities)
    this.DOM.visibilityOverride = {};
    for (const aff of VISIBILITY_AFFINITIES) {
      this.DOM.visibilityOverride[aff] = {};
      for (const field of VISIBILITY_FIELDS) {
        this.DOM.visibilityOverride[aff][field] = document.getElementById(
          `enc-vis-${aff}-${field}`
        );
      }
    }

    // Verify critical elements
    Object.entries(this.DOM).forEach(([key, el]) => {
      if (!el && key !== "tabs" && key !== "tabContents" && key !== "visibilityOverride") {
        console.warn(`EncountersView: Element not found: ${key}`);
      }
    });
  }

  initEvents() {
    // Form Events
    this.DOM.form?.addEventListener("submit", (e) => this.handleSubmit(e));
    this.DOM.btnCancel?.addEventListener("click", () => this.closeForm());
    this.DOM.btnCloseModal?.addEventListener("click", () => this.closeForm());
    this.DOM.modalOverlay?.addEventListener("click", () => this.closeForm());

    // Detail View Events
    this.DOM.btnCloseDetail?.addEventListener("click", () => this.closeEncounterManager());
    this.DOM.btnEditCurrent?.addEventListener("click", () => {
      if (this.currentEncounter) this.openForm(this.currentEncounter);
    });

    // Participant Modal Events
    this.DOM.btnClosePartModal?.addEventListener("click", () => this.closeParticipantModal());
    this.DOM.partModalOverlay?.addEventListener("click", () => this.closeParticipantModal());

    // Tab Switching
    this.DOM.tabs?.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.DOM.tabs.forEach((t) => t.classList.remove("active"));
        this.DOM.tabContents.forEach((c) => c.classList.add("hidden"));
        tab.classList.add("active");
        const content = document.getElementById(tab.dataset.tab);
        if (content) {
          content.classList.remove("hidden");
          // Focus the search input in the active tab
          const searchInput = content.querySelector('input[type="text"]');
          if (searchInput) {
            setTimeout(() => searchInput.focus(), 50);
          }
        }

        if (tab.dataset.tab === "tab-db-chars") this.loadDBParticipants();
      });
    });

    // Quick Add Form
    this.DOM.quickAddForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.addQuickParticipant();
    });

    // Main Add Participant Button
    this.DOM.btnAddPartMain?.addEventListener("click", () => this.openParticipantModal());

    // Background image picker
    this.DOM.bgTabs?.forEach((tab) => {
      tab.addEventListener("click", () => this.switchBgTab(tab.dataset.bgTab));
    });
    this.DOM.btnBgUpload?.addEventListener("click", () => this.DOM.bgFile?.click());
    this.DOM.bgFile?.addEventListener("change", (e) => this.handleBgFileSelect(e));

    // Music remove button
    this.DOM.btnMusicRemove?.addEventListener("click", () => {
      if (this.DOM.musicUrlInput) this.DOM.musicUrlInput.value = "";
      if (this.DOM.musicFileInput) this.DOM.musicFileInput.value = "";
      this.updateMusicStatusUI();
    });

    // Visibility override toggle
    this.DOM.visibilityOverrideToggle?.addEventListener("change", () => {
      this.applyVisibilityOverrideToggleState();
    });

    // Auto-activate override toggle when user clicks any visibility checkbox
    for (const aff of VISIBILITY_AFFINITIES) {
      for (const field of VISIBILITY_FIELDS) {
        const cb = this.DOM.visibilityOverride?.[aff]?.[field];
        cb?.addEventListener("change", () => {
          if (this.DOM.visibilityOverrideToggle && !this.DOM.visibilityOverrideToggle.checked) {
            this.DOM.visibilityOverrideToggle.checked = true;
            this.applyVisibilityOverrideToggleState();
          }
        });
      }
    }

    // Search Events
    this.DOM.dbCharSearch?.addEventListener("input", (e) =>
      this.loadDBParticipants(e.target.value)
    );
    this.DOM.apiMonsterSearch?.addEventListener("input", (e) => {
      clearTimeout(this.apiSearchTimeout);
      this.apiSearchTimeout = setTimeout(() => this.searchApiMonsters(e.target.value), 500);
    });

    // Delegation for stat inputs and Actions
    [this.DOM.listAllies, this.DOM.listNeutrals, this.DOM.listEnemies].forEach((list) => {
      if (!list) return;

      list.addEventListener("change", (e) => {
        if (e.target.classList.contains("stat-control__input")) {
          this.handleStatChange(e);
        }
      });

      list.addEventListener("click", (e) => this.handleParticipantAction(e));

      // Drag and Drop Delegation
      list.addEventListener("dragstart", (e) => {
        const card = e.target.closest(".participant-card");
        if (card) {
          e.dataTransfer.setData("text/plain-id", card.dataset.id);
          card.classList.add("participant-card--dragging");
          setTimeout(() => card.classList.add("participant-card--ghost"), 0);
        }
      });

      list.addEventListener("dragend", (e) => {
        const card = e.target.closest(".participant-card");
        if (card) {
          card.classList.remove("participant-card--dragging");
          card.classList.remove("participant-card--ghost");
        }
      });

      list.addEventListener("dragover", (e) => this.handleDragOver(e));
      list.addEventListener("dragleave", (e) => this.handleDragLeave(e));
      list.addEventListener("drop", (e) => this.handleDrop(e));
    });
  }

  handleStatChange(e) {
    const input = e.target;
    const card = input.closest(".participant-card");
    const id = card.dataset.id;
    const field = input.dataset.field;
    const value = parseInt(input.value, 10);

    if (isNaN(value)) return;

    const index = this.participants.findIndex((p) => p.tempId === id);
    if (index !== -1) {
      this.participants[index][field] = value;
      this.saveParticipants(false); // Don't re-render everything to keep focus
    }
  }

  // ============================================
  // Encounter Form
  // ============================================
  async openForm(encounter = null, campaignId = null) {
    this.editingEncounterId = encounter ? encounter.id : null;
    this.currentCampaignId = campaignId || (encounter ? encounter.campaign_id : null);

    if (this.DOM.modalTitle) {
      this.DOM.modalTitle.textContent = encounter ? "Editar Encontro" : "Novo Encontro";
    }

    if (this.DOM.idInput) this.DOM.idInput.value = encounter ? encounter.id : "";
    if (this.DOM.nameInput) this.DOM.nameInput.value = encounter ? encounter.name : "";
    if (this.DOM.difficultyGroup) {
      const value = encounter ? encounter.difficulty || "Médio" : "Médio";
      const radio = this.DOM.difficultyGroup.querySelector(
        `input[name="encounter-difficulty"][value="${value}"]`
      );
      if (radio) radio.checked = true;
    }
    if (this.DOM.locationInput)
      this.DOM.locationInput.value = encounter ? encounter.location || "" : "";
    if (this.DOM.descInput) this.DOM.descInput.value = encounter ? encounter.description || "" : "";

    const bgValue = encounter ? encounter.background_image || "" : "";
    this.setSelectedBackground(bgValue);
    this.loadBgPresets();
    this.switchBgTab(
      bgValue.startsWith("local-image://") ? "bg-upload" : bgValue ? "bg-gallery" : "bg-gallery"
    );

    // Music fields
    if (this.DOM.musicUrlInput) this.DOM.musicUrlInput.value = encounter?.music_url || "";
    if (this.DOM.musicFileInput) this.DOM.musicFileInput.value = encounter?.music_file || "";
    this.updateMusicStatusUI();

    // Visibility override: if encounter has its own override use it, otherwise
    // preview the campaign's default so the user sees what is being inherited.
    const overrideJson = encounter?.combat_visibility_override || null;
    let previewSource = overrideJson;
    if (!overrideJson && this.currentCampaignId) {
      try {
        const camp = await databaseService.getCampaignById(this.currentCampaignId);
        previewSource = camp?.combat_visibility || null;
      } catch (err) {
        console.warn("Falha ao carregar visibility da campanha:", err);
      }
    }
    if (this.DOM.visibilityOverrideToggle) {
      this.DOM.visibilityOverrideToggle.checked = !!overrideJson;
    }
    this.populateEncounterVisibility(previewSource);
    this.applyVisibilityOverrideToggleState();

    this.DOM.modal?.classList.remove("hidden");
    this.DOM.nameInput?.focus();
  }

  populateEncounterVisibility(jsonStr) {
    const vis = parseVisibility(jsonStr) || makeDefaultVisibility();
    for (const aff of VISIBILITY_AFFINITIES) {
      for (const field of VISIBILITY_FIELDS) {
        const cb = this.DOM.visibilityOverride?.[aff]?.[field];
        if (cb) cb.checked = !!vis[aff][field];
      }
    }
  }

  collectEncounterVisibility() {
    if (!this.DOM.visibilityOverrideToggle?.checked) return null;
    const vis = makeDefaultVisibility();
    for (const aff of VISIBILITY_AFFINITIES) {
      for (const field of VISIBILITY_FIELDS) {
        const cb = this.DOM.visibilityOverride?.[aff]?.[field];
        if (cb) vis[aff][field] = !!cb.checked;
      }
    }
    return JSON.stringify(vis);
  }

  applyVisibilityOverrideToggleState() {
    const enabled = !!this.DOM.visibilityOverrideToggle?.checked;
    if (this.DOM.visibilityGrid) {
      // Visual hint only — checkboxes remain clickable to auto-activate the toggle
      this.DOM.visibilityGrid.classList.toggle("visibility-grid--inherit", !enabled);
    }
  }

  updateMusicStatusUI() {
    const hasFile = !!(this.DOM.musicFileInput && this.DOM.musicFileInput.value);
    if (this.DOM.btnMusicRemove) {
      this.DOM.btnMusicRemove.hidden = !hasFile;
    }
    if (this.DOM.musicStatus) {
      if (hasFile) {
        this.DOM.musicStatus.innerHTML = `${icon("check-circle-2")} Música baixada e pronta para tocar.`;
        this.DOM.musicStatus.className = "form-help form-help--ok";
      } else {
        this.DOM.musicStatus.textContent = "";
        this.DOM.musicStatus.className = "form-help";
      }
    }
  }

  setMusicStatus(text, kind = "") {
    if (!this.DOM.musicStatus) return;
    this.DOM.musicStatus.textContent = text || "";
    this.DOM.musicStatus.className = "form-help" + (kind ? ` form-help--${kind}` : "");
  }

  switchBgTab(panelId) {
    this.DOM.bgTabs?.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.bgTab === panelId);
    });
    Object.entries(this.DOM.bgPanels || {}).forEach(([key, el]) => {
      if (!el) return;
      const expectedId = `bg-${key}`;
      el.classList.toggle("hidden", expectedId !== panelId);
    });
    if (panelId === "bg-none") {
      this.setSelectedBackground("");
    }
  }

  async loadBgPresets() {
    if (!this.DOM.bgGallery) return;
    try {
      const presets = await window.dmCopilot.db.encounters.listPresets();
      if (!presets || presets.length === 0) {
        this.DOM.bgGallery.innerHTML = `<p class="text-muted text-center py-4">Nenhuma imagem na pasta de presets.<br><small>Adicione imagens em <code>src/assets/images/encounters-presets/</code>.</small></p>`;
        return;
      }
      const currentBg = this.DOM.bgInput?.value || "";
      this.DOM.bgGallery.innerHTML = presets
        .map((file) => {
          const value = `preset:${file}`;
          const url = this.resolveBackgroundUrl(value);
          const selected = value === currentBg ? "selected" : "";
          return `<div class="encounter-bg-thumb ${selected}" data-bg-value="${this.escapeHTML(value)}" style="background-image: url('${url}')" title="${this.escapeHTML(file)}"></div>`;
        })
        .join("");

      this.DOM.bgGallery.onclick = (e) => {
        const thumb = e.target.closest(".encounter-bg-thumb");
        if (!thumb) return;
        this.setSelectedBackground(thumb.dataset.bgValue);
        this.DOM.bgGallery
          .querySelectorAll(".encounter-bg-thumb")
          .forEach((t) => t.classList.remove("selected"));
        thumb.classList.add("selected");
      };
    } catch (error) {
      console.error("Erro ao carregar presets:", error);
      this.DOM.bgGallery.innerHTML = `<p class="text-muted text-center py-4">Erro ao carregar galeria.</p>`;
    }
  }

  async handleBgFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (this.DOM.bgUploadName) this.DOM.bgUploadName.textContent = file.name;
    try {
      const buffer = await this.processBackgroundImage(file);
      const relativePath = await window.dmCopilot.db.encounters.saveImage(buffer);
      const value = `local-image://${relativePath}`;
      this.setSelectedBackground(value);
      // Limpa seleção de presets na galeria, se houver
      this.DOM.bgGallery
        ?.querySelectorAll(".encounter-bg-thumb")
        .forEach((t) => t.classList.remove("selected"));
    } catch (error) {
      console.error("Erro ao processar imagem de fundo:", error);
      showToast("Erro ao salvar imagem", "error");
    }
  }

  processBackgroundImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1920;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = (height / width) * MAX_SIZE;
            width = MAX_SIZE;
          } else {
            width = (width / height) * MAX_SIZE;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Falha ao exportar imagem"));
            blob.arrayBuffer().then(resolve);
          },
          "image/webp",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      img.src = URL.createObjectURL(file);
    });
  }

  setSelectedBackground(value) {
    if (this.DOM.bgInput) this.DOM.bgInput.value = value || "";
    const url = value ? this.resolveBackgroundUrl(value) : "";
    if (this.DOM.bgPreviewWrapper) {
      this.DOM.bgPreviewWrapper.classList.toggle("hidden", !url);
    }
    if (this.DOM.bgPreview) {
      this.DOM.bgPreview.style.backgroundImage = url ? `url('${url}')` : "";
    }
  }

  // Resolves stored value into a URL renderable in the DM view.
  // - "preset:<file>"        → /src/assets/images/encounters-presets/<file>
  // - "local-image://<path>" → used as-is (custom protocol)
  resolveBackgroundUrl(value) {
    if (!value) return "";
    if (value.startsWith("preset:")) {
      return `/src/assets/images/encounters-presets/${value.slice("preset:".length)}`;
    }
    return value;
  }

  closeForm() {
    this.DOM.modal?.classList.add("hidden");
    this.editingEncounterId = null;
  }

  async handleSubmit(e) {
    e.preventDefault();

    const newMusicUrl = (this.DOM.musicUrlInput?.value || "").trim();
    const existingMusicFile = this.DOM.musicFileInput?.value || "";
    const previousMusicUrl = this.editingEncounterId ? this.currentEncounter?.music_url || "" : "";
    const musicChanged = newMusicUrl !== previousMusicUrl;

    // Validate URL early before saving anything
    if (newMusicUrl && musicChanged) {
      try {
        const valid = await window.dmCopilot.db.encounters.validateYouTubeUrl(newMusicUrl);
        if (!valid) {
          this.setMusicStatus("URL do YouTube inválida.", "error");
          return;
        }
      } catch (err) {
        this.setMusicStatus("Erro ao validar URL.", "error");
        return;
      }
    }

    const encounterData = {
      campaign_id: this.currentCampaignId,
      name: this.DOM.nameInput.value.trim(),
      difficulty:
        this.DOM.difficultyGroup
          ?.querySelector('input[name="encounter-difficulty"]:checked')
          ?.value ?? "Médio",
      location: this.DOM.locationInput.value.trim(),
      description: this.DOM.descInput.value.trim(),
      background_image: this.DOM.bgInput?.value || null,
      music_url: newMusicUrl || null,
      // music_file is set after download below; for now, preserve existing
      music_file: existingMusicFile || null,
      combat_visibility_override: this.collectEncounterVisibility(),
      monsters: this.editingEncounterId ? this.participants : [],
    };

    // If music URL was cleared or changed, drop the old file (don't keep stale audio)
    if (musicChanged && existingMusicFile) {
      try {
        await window.dmCopilot.db.encounters.deleteMusic(existingMusicFile);
      } catch (err) {
        console.warn("Falha ao remover música antiga:", err);
      }
      encounterData.music_file = null;
    }

    const submitBtn = this.DOM.btnSaveEncounter;
    if (submitBtn) submitBtn.disabled = true;

    try {
      let encounterId = this.editingEncounterId;
      if (encounterId) {
        await databaseService.updateEncounter(encounterId, encounterData);
      } else {
        const created = await databaseService.createEncounter(encounterData);
        encounterId = created?.id;
      }

      // Download new music if needed (after save, since we need encounterId)
      if (newMusicUrl && musicChanged && encounterId) {
        this.setMusicStatus("⏳ Baixando música... (pode levar alguns segundos)", "");
        const result = await window.dmCopilot.db.encounters.downloadMusic(newMusicUrl, encounterId);
        if (result?.success) {
          encounterData.music_file = result.fileName;
          await databaseService.updateEncounter(encounterId, { music_file: result.fileName });
          if (this.DOM.musicFileInput) this.DOM.musicFileInput.value = result.fileName;
          this.updateMusicStatusUI();
        } else {
          this.setMusicStatus(
            `${icon("circle-x")} ${result?.error || "Falha ao baixar música."}`,
            "error"
          );
          showToast("Encontro salvo, mas a música não pôde ser baixada", "error");
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
      }

      showToast(this.editingEncounterId ? "Encontro atualizado!" : "Encontro criado!");
      this.closeForm();

      if (window.campaignsView && window.campaignsView.selectedCampaign) {
        window.campaignsView.loadCampaignEncounters(this.currentCampaignId);
      }

      if (this.currentEncounter && this.currentEncounter.id === encounterId) {
        this.currentEncounter = { ...this.currentEncounter, ...encounterData };
        this.renderManagerHeader();
        this.applyManagerBackground();
        this.combatView?.broadcastState?.();
      }
    } catch (error) {
      console.error("Save encounter failed:", error);
      showToast("Erro ao salvar encontro", "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async loadEncounterForEdit(id) {
    try {
      const encounter = await databaseService.getEncounterById(id);
      if (encounter) this.openForm(encounter);
    } catch (error) {
      showToast("Erro ao carregar encontro", "error");
    }
  }

  async confirmDelete(id) {
    const ok = await showConfirm({
      title: "Excluir Encontro",
      message: "Tem certeza que deseja excluir este encontro? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      confirmVariant: "danger",
      confirmIcon: "trash-2",
    });
    if (!ok) return;
    try {
      await databaseService.deleteEncounter(id);
      showToast("Encontro excluído");
      if (window.campaignsView && window.campaignsView.selectedCampaign) {
        window.campaignsView.loadCampaignEncounters(window.campaignsView.selectedCampaign.id);
      }
    } catch (error) {
      showToast("Erro ao excluir", "error");
    }
  }

  // ============================================
  // Encounter Manager
  // ============================================
  async openEncounterManager(id) {
    try {
      const encounter = await databaseService.getEncounterById(id);
      if (!encounter) return;

      this.currentEncounter = encounter;
      this.participants = encounter.monsters || [];
      this.organizeParticipants();

      this.renderManagerHeader();
      this.applyManagerBackground();

      // Reset visual de combate antes de decidir o ramo (evita carregar
      // banners stale de um combate anterior se o mestre vier de outra tela).
      this.combatView?.resetCombatUI();

      if (encounter.status === "active") {
        // Combate em andamento — re-hidrata e mostra os banners no lugar dos cards.
        await this.combatView.resumeFromEncounter(encounter);
      } else {
        // Pré-combate normal.
        this.renderParticipants();
      }

      this.DOM.detailView?.classList.remove("hidden");
    } catch (error) {
      console.error("Open manager failed:", error);
      showToast("Erro ao abrir gerenciador", "error");
    }
  }

  applyManagerBackground() {
    const view = this.DOM.detailView;
    if (!view) return;
    const value = this.currentEncounter?.background_image;
    if (!value) {
      view.classList.remove("encounter-detail-view--has-bg");
      view.style.removeProperty("--encounter-bg-url");
      return;
    }
    const url = this.resolveBackgroundUrl(value);
    view.style.setProperty("--encounter-bg-url", `url('${url}')`);
    view.classList.add("encounter-detail-view--has-bg");
  }

  closeEncounterManager() {
    this.DOM.detailView?.classList.add("hidden");
    this.DOM.detailView?.classList.remove("encounter-detail-view--has-bg");
    this.DOM.detailView?.style.removeProperty("--encounter-bg-url");
    this.currentEncounter = null;
    this.participants = [];
  }

  renderManagerHeader() {
    if (!this.currentEncounter) return;
    this.DOM.viewName.textContent = this.currentEncounter.name;
    this.DOM.viewDifficulty.textContent = this.currentEncounter.difficulty || "Médio";
    this.DOM.viewLocation.textContent = this.currentEncounter.location || "Local não definido";
  }

  organizeParticipants() {
    this.affinityGroups = { ally: [], neutral: [], enemy: [] };
    this.participants.forEach((p, index) => {
      // Ensure unique ID for drag and drop tracking
      if (!p.tempId) p.tempId = `p-${Date.now()}-${Math.random()}`;

      const affinity = p.affinity || "enemy";
      if (this.affinityGroups[affinity]) {
        this.affinityGroups[affinity].push({ ...p, originalIndex: index });
      }
    });
  }

  renderParticipants() {
    const renderList = (listEl, sectionEl, group) => {
      if (!listEl || !sectionEl) return;

      const isEmpty = group.length === 0;
      sectionEl.classList.toggle("hidden", isEmpty);

      if (isEmpty) return;

      listEl.innerHTML = group
        .map((p) => {
          const safeName = escapeHtml(p.name ?? "Sem nome");
          const displayName = escapeHtml(truncate(p.name ?? "Sem nome", 20));
          return `
        <div class="participant-card ${p.image ? "participant-card--with-img" : ""}"
             data-index="${p.originalIndex}"
             data-id="${p.tempId}"
             draggable="true">
          ${
            p.image
              ? `
            <div class="participant-card__image-container">
              <img src="${p.image}" class="participant-card__img" alt="${safeName}" />
            </div>
          `
              : ""
          }
          <div class="participant-card__main">
            <div class="participant-card__header">
              <div class="participant-card__name" title="${safeName}">${displayName}</div>
              <div class="participant-card__stats">
                <div class="stat-control">
                  <span class="stat-control__label">HP</span>
                  <input type="number" class="stat-control__input stat-control__input--hp"
                         value="${(p.current_hp !== undefined ? p.current_hp : p.hp) || 0}"
                         data-field="current_hp" title="HP Atual" />
                  <span class="stat-control__sep">/</span>
                  <span class="stat-control__max">${p.hp || 0}</span>
                </div>
                <div class="stat-control">
                  <span class="stat-control__label">AC</span>
                  <input type="number" class="stat-control__input stat-control__input--ac"
                         value="${p.ac || 10}"
                         data-field="ac" title="CA" />
                </div>
                <div class="stat-control">
                  <span class="stat-control__label">Ini</span>
                  <span class="stat-control__value">${p.ini || 0}</span>
                </div>
              </div>
            </div>
            <div class="participant-card__actions">
              <button class="btn-icon btn-icon--sm" data-action="duplicate" title="Duplicar">${icon("copy-plus")}</button>
              <button class="btn-icon btn-icon--sm" data-action="move" data-target="ally" title="Para Aliado">${icon("circle", { className: "status-icon--ally" })}</button>
              <button class="btn-icon btn-icon--sm" data-action="move" data-target="neutral" title="Para Neutro">${icon("circle", { className: "status-icon--neutral" })}</button>
              <button class="btn-icon btn-icon--sm" data-action="move" data-target="enemy" title="Para Inimigo">${icon("circle", { className: "status-icon--enemy" })}</button>
              <button class="btn-icon btn-icon--sm btn-icon--danger" data-action="remove" title="Remover">${icon("trash-2")}</button>
            </div>
          </div>
        </div>
      `;
        })
        .join("");
    };

    renderList(this.DOM.listAllies, this.DOM.sectionAllies, this.affinityGroups.ally);
    renderList(this.DOM.listNeutrals, this.DOM.sectionNeutrals, this.affinityGroups.neutral);
    renderList(this.DOM.listEnemies, this.DOM.sectionEnemies, this.affinityGroups.enemy);

    // Update section count badges
    const countEl = (id) => document.getElementById(id);
    const setBadge = (el, count) => {
      if (el) el.textContent = String(count);
    };
    setBadge(countEl("encounter-section-count-allies"), this.affinityGroups.ally.length);
    setBadge(countEl("encounter-section-count-neutrals"), this.affinityGroups.neutral.length);
    setBadge(countEl("encounter-section-count-enemies"), this.affinityGroups.enemy.length);

    // Resolve <i data-icon> placeholders injected by renderList
    const columnsEl = this.DOM.sectionAllies?.closest(".encounter-columns");
    if (columnsEl) mountIcons(columnsEl);
  }

  async handleParticipantAction(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const card = btn.closest(".participant-card");
    const index = parseInt(card.dataset.index, 10);
    const action = btn.dataset.action;

    if (action === "remove") {
      this.participants.splice(index, 1);
    } else if (action === "duplicate") {
      const original = this.participants[index];
      const baseName = original.name.replace(/\s\(\d+\)$/, "");

      const copy = {
        ...original,
        id: Date.now() + Math.random(),
        tempId: `p-${Date.now()}-${Math.random()}`,
        current_hp: original.current_hp !== undefined ? original.current_hp : original.hp,
      };

      const count = this.participants.filter(
        (p) => p.name.replace(/\s\(\d+\)$/, "") === baseName
      ).length;
      copy.name = `${baseName} (${count + 1})`;

      this.participants.push(copy);
    } else if (action === "move") {
      this.participants[index].affinity = btn.dataset.target;
    }

    // Force update of originalIndex for next render
    this.organizeParticipants();
    await this.saveParticipants();
  }

  handleDragOver(e) {
    e.preventDefault();
    const list = e.currentTarget;
    list.classList.add("encounter-section__list--drag-over");

    const afterElement = this.getDragAfterElement(list, e.clientY);

    // Create or move placeholder
    let placeholder = list.querySelector(".participant-card--placeholder");
    if (!placeholder) {
      placeholder = document.createElement("div");
      placeholder.classList.add("participant-card--placeholder");
    }

    if (afterElement == null) {
      list.appendChild(placeholder);
    } else {
      list.insertBefore(placeholder, afterElement);
    }
  }

  handleDragLeave(e) {
    const list = e.currentTarget;
    if (!list.contains(e.relatedTarget)) {
      list.classList.remove("encounter-section__list--drag-over");
      const placeholder = list.querySelector(".participant-card--placeholder");
      if (placeholder) placeholder.remove();
    }
  }

  getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll(
        ".participant-card:not(.participant-card--ghost):not(.participant-card--placeholder)"
      ),
    ];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  async handleDrop(e) {
    e.preventDefault();
    const list = e.currentTarget;
    list.classList.remove("encounter-section__list--drag-over");

    const placeholder = list.querySelector(".participant-card--placeholder");
    if (placeholder) placeholder.remove();

    const draggedTempId = e.dataTransfer.getData("text/plain-id");
    const targetAffinity = list.dataset.affinity;

    const draggedIndex = this.participants.findIndex((p) => p.tempId === draggedTempId);
    if (draggedIndex === -1) return;

    const draggedItem = this.participants[draggedIndex];

    // Remove from current position
    this.participants.splice(draggedIndex, 1);
    draggedItem.affinity = targetAffinity;

    // Find insertion point
    const afterElement = this.getDragAfterElement(list, e.clientY);

    if (afterElement) {
      const afterTempId = afterElement.dataset.id;
      const afterIndex = this.participants.findIndex((p) => p.tempId === afterTempId);
      this.participants.splice(afterIndex, 0, draggedItem);
    } else {
      // Append to the end of the affinity group in the global list
      // We'll find the last item with this affinity
      const lastIdxOfAffinity = [...this.participants]
        .reverse()
        .findIndex((p) => (p.affinity || "enemy") === targetAffinity);
      if (lastIdxOfAffinity !== -1) {
        const absoluteIdx = this.participants.length - lastIdxOfAffinity;
        this.participants.splice(absoluteIdx, 0, draggedItem);
      } else {
        this.participants.push(draggedItem);
      }
    }

    await this.saveParticipants();
    showToast(`Movido para ${this.getAffinityLabel(targetAffinity)}`);
  }

  getAffinityLabel(affinity) {
    const labels = { ally: "Aliados", neutral: "Neutros", enemy: "Inimigos" };
    return labels[affinity] || affinity;
  }

  async saveParticipants(reRender = true) {
    if (!this.currentEncounter) return;

    try {
      // Sync local encounter object
      this.currentEncounter.monsters = [...this.participants];

      // Prepare data for DB
      const updateData = {
        name: this.currentEncounter.name,
        description: this.currentEncounter.description,
        difficulty: this.currentEncounter.difficulty,
        location: this.currentEncounter.location,
        monsters: this.participants,
        status: this.currentEncounter.status || "inactive",
      };

      await databaseService.updateEncounter(this.currentEncounter.id, updateData);

      if (this.combatView && this.combatView.isActive) {
        this.combatView.participants = this.participants.map((p) => ({
          ...p,
          id: p.tempId,
          image: p.image,
        }));
        this.combatView.broadcastState();
      }

      if (reRender) {
        this.organizeParticipants();
        this.renderParticipants();
      }
    } catch (error) {
      console.error("Save participants failed:", error);
      showToast("Erro ao salvar alterações", "error");
    }
  }

  // ============================================
  // Add Participant Logic
  // ============================================
  openParticipantModal() {
    this.DOM.partModal?.classList.remove("hidden");
    this.loadDBParticipants();
  }

  closeParticipantModal() {
    this.DOM.partModal?.classList.add("hidden");
  }

  async loadDBParticipants(search = "") {
    try {
      const characters = await databaseService.getAllCharacters();
      const filtered = characters.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      );

      this.DOM.dbPartList.innerHTML = filtered
        .map((c) => {
          const imageUrl = c.image_path ? `local-image://${c.image_path}` : null;
          const count = this.participants.filter((p) => p.db_id === c.id).length;
          const isAdded = count > 0;

          return `
          <div class="selection-item ${imageUrl ? "selection-item--with-img" : ""} ${isAdded ? "selection-item--added" : ""}" data-type="db" data-id="${c.id}">
            ${
              imageUrl
                ? `
              <div class="selection-item__image-container">
                <img src="${imageUrl}" class="selection-item__img" />
              </div>
            `
                : ""
            }
            <div class="selection-item__info">
              <span class="selection-item__name">${this.escapeHTML(c.name)}</span>
              <span class="selection-item__meta">HP: ${c.hp} | AC: ${c.ac} | Ini: ${c.ini}</span>
            </div>
            ${isAdded ? `<span class="selection-item__count">${count}</span>` : ""}
            <button class="btn btn--secondary btn--sm">Adicionar</button>
          </div>
        `;
        })
        .join("");

      this.DOM.dbPartList.querySelectorAll(".selection-item").forEach((item) => {
        item.addEventListener("click", () => {
          const char = characters.find((c) => c.id == item.dataset.id);
          this.addParticipantToList({
            id: Date.now(),
            name: char.name,
            hp: char.hp,
            ac: char.ac,
            ini: char.ini,
            affinity: this.getSelectedAffinity(),
            image: char.image_path ? `local-image://${char.image_path}` : null,
            db_id: char.id,
            cr: char.cr ?? null,
            str: char.str ?? null,
            dex: char.dex ?? null,
            con: char.con ?? null,
            int: char.int ?? null,
            wis: char.wis ?? null,
            cha: char.cha ?? null,
          });
        });
      });
    } catch (error) {
      console.error("Load DB parts failed:", error);
    }
  }

  addQuickParticipant() {
    const name = document.getElementById("quick-name").value.trim();
    if (!name) return;

    this.addParticipantToList({
      id: Date.now(),
      name,
      hp: parseInt(document.getElementById("quick-hp").value) || 0,
      ac: parseInt(document.getElementById("quick-ac").value) || 10,
      ini: parseInt(document.getElementById("quick-ini").value) || 0,
      affinity: this.getSelectedAffinity(),
    });

    this.DOM.quickAddForm.reset();
  }

  async searchApiMonsters(query) {
    if (!query || query.length < 2) return;

    this.DOM.apiPartList.innerHTML = '<p class="text-center py-4">Buscando...</p>';

    try {
      const response = await fetch(
        `https://www.dnd5eapi.co/api/2014/monsters?name=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (data.results.length === 0) {
        this.DOM.apiPartList.innerHTML =
          '<p class="text-center py-4 text-muted">Nenhum monstro encontrado.</p>';
        return;
      }

      const monsters = data.results.slice(0, 20);

      // Render imediato — cards com preview em loading ou cache
      this.DOM.apiPartList.innerHTML = monsters
        .map((m) => {
          const imageUrl = `https://www.dnd5eapi.co/api/images/monsters/${m.index}.png`;
          const apiUrl = `https://www.dnd5eapi.co/api/2014/monsters/${m.index}`;
          const count = this.participants.filter((p) => p.api_url === apiUrl).length;
          const isAdded = count > 0;
          const cached = this._monsterDetailCache.get(m.index);

          return `
          <div class="selection-item selection-item--with-img ${isAdded ? "selection-item--added" : ""}" data-index="${m.index}">
            <div class="selection-item__image-container">
              <img src="${imageUrl}" class="selection-item__img" onerror="this.parentElement.style.display='none'" />
            </div>
            <div class="selection-item__info">
              <div class="selection-item__panels">
                <div class="selection-item__main">
                  <span class="selection-item__name">${this.escapeHTML(m.name.replace(/🔗/g, ""))}</span>
                  <div class="selection-item__stats">
                    ${cached ? this._renderMonsterStats(cached) : `<span class="selection-item__panel-state">Carregando…</span>`}
                  </div>
                </div>
                <div class="selection-item__abilities">
                  ${cached ? this._renderMonsterAbilities(cached) : `<span class="selection-item__panel-state">Carregando…</span>`}
                </div>
              </div>
            </div>
            ${isAdded ? `<span class="selection-item__count">${count}</span>` : ""}
            <button class="btn btn--secondary btn--sm">Adicionar</button>
          </div>
        `;
        })
        .join("");

      this.DOM.apiPartList.querySelectorAll(".selection-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          if (e.target.classList.contains("btn")) return;
          this.addApiMonster(item.dataset.index);
        });
      });

      this.DOM.apiPartList.querySelectorAll(".selection-item button").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const item = btn.closest(".selection-item");
          this.addApiMonster(item.dataset.index);
        });
      });

      // Fetch paralelo dos detalhes ausentes no cache
      const missing = monsters.filter((m) => !this._monsterDetailCache.has(m.index));

      const fetches = missing.map(async (m) => {
        try {
          const r = await fetch(`https://www.dnd5eapi.co/api/2014/monsters/${m.index}`);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const detail = await r.json();
          return { index: m.index, ok: true, detail };
        } catch (err) {
          return { index: m.index, ok: false, err };
        }
      });

      const results = await Promise.all(fetches);

      for (const r of results) {
        const card = this.DOM.apiPartList.querySelector(
          `.selection-item[data-index="${CSS.escape(r.index)}"]`
        );
        if (!card) continue;

        const statsEl = card.querySelector(".selection-item__stats");
        const abilitiesEl = card.querySelector(".selection-item__abilities");
        if (!statsEl || !abilitiesEl) continue;

        if (r.ok) {
          this._monsterDetailCache.set(r.index, r.detail);
          statsEl.innerHTML = this._renderMonsterStats(r.detail);
          abilitiesEl.innerHTML = this._renderMonsterAbilities(r.detail);
        } else {
          statsEl.innerHTML = `<span class="selection-item__panel-state selection-item__panel-state--error">Indisponível</span>`;
          abilitiesEl.innerHTML = `<span class="selection-item__panel-state selection-item__panel-state--error">Indisponível</span>`;
        }
      }
    } catch (error) {
      this.DOM.apiPartList.innerHTML =
        '<p class="text-center py-4 text-danger">Erro ao buscar na API.</p>';
    }
  }

  _renderMonsterStats(detail) {
    const hp = parseInt(detail.hit_points) || 0;
    const ac = Array.isArray(detail.armor_class)
      ? detail.armor_class[0]?.value ?? 10
      : parseInt(detail.armor_class) || 10;
    const cr = formatCR(detail.challenge_rating);
    const iniMod = formatModifier(detail.dexterity);

    return `
      <span class="selection-item__stat">
        <span class="selection-item__stat-label">CR</span>
        <span class="selection-item__stat-value">${cr}</span>
      </span>
      <span class="selection-item__stat">
        <span class="selection-item__stat-label">HP</span>
        <span class="selection-item__stat-value">${hp}</span>
      </span>
      <span class="selection-item__stat">
        <span class="selection-item__stat-label">CA</span>
        <span class="selection-item__stat-value">${ac}</span>
      </span>
      <span class="selection-item__stat">
        <span class="selection-item__stat-label">INI</span>
        <span class="selection-item__stat-value">${iniMod}</span>
      </span>
    `;
  }

  _renderMonsterAbilities(detail) {
    const abilities = [
      ["STR", detail.strength],
      ["DEX", detail.dexterity],
      ["CON", detail.constitution],
      ["INT", detail.intelligence],
      ["WIS", detail.wisdom],
      ["CHA", detail.charisma],
    ];

    return abilities
      .map(
        ([name, score]) => `
          <span class="selection-item__ability">
            <span class="selection-item__ability-label">${name}</span>
            <span class="selection-item__ability-value">${score} <span class="selection-item__ability-mod">(${formatModifier(score)})</span></span>
          </span>`
      )
      .join("");
  }

  async addApiMonster(index) {
    try {
      let monster = this._monsterDetailCache.get(index);
      if (!monster) {
        const response = await fetch(`https://www.dnd5eapi.co/api/2014/monsters/${index}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        monster = await response.json();
        this._monsterDetailCache.set(index, monster);
      }

      this.addParticipantToList({
        id: Date.now(),
        name: monster.name,
        hp: parseInt(monster.hit_points) || 0,
        ac: Array.isArray(monster.armor_class)
          ? monster.armor_class[0]?.value || 10
          : parseInt(monster.armor_class) || 10,
        ini: modifier(monster.dexterity),
        affinity: this.getSelectedAffinity(),
        api_url: monster.url ? `https://www.dnd5eapi.co${monster.url}` : null,
        image: monster.image ? `https://www.dnd5eapi.co${monster.image}` : null,
        cr: monster.challenge_rating ?? null,
        str: monster.strength ?? null,
        dex: monster.dexterity ?? null,
        con: monster.constitution ?? null,
        int: monster.intelligence ?? null,
        wis: monster.wisdom ?? null,
        cha: monster.charisma ?? null,
      });
    } catch (error) {
      showToast("Erro ao carregar detalhes do monstro", "error");
    }
  }

  async addParticipantToList(participant) {
    // Clean name from potential link emoji
    participant.name = participant.name.replace(/🔗/g, "").trim();

    // Check for duplicates and add suffix (2), (3), etc.
    const baseName = participant.name;
    const sameBaseParticipants = this.participants.filter((p) => {
      const pBase = p.name.replace(/\s\(\d+\)$/, "");
      return pBase === baseName;
    });

    if (sameBaseParticipants.length > 0) {
      participant.name = `${baseName} (${sameBaseParticipants.length + 1})`;
    }

    if (participant.current_hp === undefined) {
      participant.current_hp = participant.hp;
    }

    // Add to local list
    this.participants.push(participant);

    // Save to DB
    await this.saveParticipants();

    // Refresh selection lists to update counts/highlights
    this.refreshSelectionLists();

    // If combat is active, notify combat view to handle initiative and sorting
    if (this.combatView && this.combatView.isActive) {
      await this.combatView.handleNewParticipant(participant);
    } else {
      showToast(`${participant.name} adicionado ao encontro!`);
    }
  }

  refreshSelectionLists() {
    // Re-run the current search/load
    const searchTerm = this.DOM.partSearch?.value || "";
    this.loadDBParticipants(searchTerm);

    // For API, we don't want to re-fetch if there's no query, but if there is one, we could re-render
    // Actually, it's easier to just re-render the existing data if we had it,
    // but for now, let's just re-trigger the search logic if there's a value
    if (searchTerm.length >= 2) {
      // To avoid unnecessary fetches, we'd need to cache the last results.
      // For now, let's just re-fetch as it's simple.
      this.searchApiMonsters(searchTerm);
    }
  }

  // Helpers
  getSelectedAffinity() {
    const radios = document.getElementsByName("part-affinity");
    for (const radio of radios) {
      if (radio.checked) return radio.value;
    }
    return "enemy";
  }

  escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

// ============================================
// View de Notas (placeholder)
// ============================================
class NotesView {
  constructor() {
    this.notes = [];
    this.currentCampaignId = null;
  }

  async loadNotes(campaignId) {
    this.currentCampaignId = campaignId;
    try {
      this.notes = await databaseService.getNotesByCampaign(campaignId);
      this.render();
    } catch (error) {
      console.error("Failed to load notes:", error);
    }
  }

  render() {
    console.log("Notes:", this.notes);
  }
}

// ============================================
// Export
// ============================================
export { CampaignsView, CharactersView, EncountersView, NotesView, showToast };
