// DM Copilot - Database Views
// Views para gerenciamento de campanhas, personagens, encontros e notas

import databaseService from "../db/database.js";

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
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
    this.deleteTargetId = null;
    this.mounted = false;

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
      detailName: document.getElementById("detail-name"),
      detailSystem: document.getElementById("detail-system"),
      detailDesc: document.getElementById("detail-description"),
      detailCreated: document.getElementById("detail-created"),
      detailUpdated: document.getElementById("detail-updated"),
      detailCharCount: document.getElementById("detail-char-count"),
      detailCharList: document.getElementById("detail-characters-list"),
      detailCharEmpty: document.getElementById("detail-characters-empty"),
      
      // Detail - Encounters
      detailEncounterCount: document.getElementById("detail-encounter-count"),
      detailEncounterList: document.getElementById("detail-encounters-list"),
      detailEncounterEmpty: document.getElementById("detail-encounters-empty"),
      btnAddEncounter: document.getElementById("btn-add-encounter"),
      
      // Link character modal
      linkModal: document.getElementById("link-character-modal"),
      linkModalOverlay: document.getElementById("link-char-modal-overlay"),
      linkCharList: document.getElementById("available-chars-list"),
      linkCharEmpty: document.getElementById("available-chars-empty"),
      linkCharSystemName: document.getElementById("link-char-system-name"),
      // Confirm modal
      confirmModal: document.getElementById("confirm-modal"),
      confirmOverlay: document.getElementById("confirm-modal-overlay"),
      confirmMessage: document.getElementById("confirm-message"),
    };
  }

  // ============================================
  // Lifecycle
  // ============================================
  async mount() {
    if (this.mounted) {
      await this.loadCampaigns();
      this.showList();
      return;
    }

    this.cacheDOM();
    this.bindEvents();
    await this.loadCampaigns();
    this.mounted = true;
  }

  // ============================================
  // Event Binding
  // ============================================
  bindEvents() {
    // New campaign buttons
    document.getElementById("btn-new-campaign").addEventListener("click", () => this.openForm());
    document.getElementById("btn-empty-new").addEventListener("click", () => this.openForm());

    // Search & filter
    this.DOM.search.addEventListener("input", () => this.applyFilters());
    this.DOM.filterSystem.addEventListener("change", () => this.applyFilters());

    // Form modal
    this.DOM.form.addEventListener("submit", (e) => this.handleSubmit(e));
    document.getElementById("btn-close-modal").addEventListener("click", () => this.closeForm());
    document.getElementById("btn-cancel-form").addEventListener("click", () => this.closeForm());
    this.DOM.modalOverlay.addEventListener("click", () => this.closeForm());

    // Detail view
    document.getElementById("btn-back-to-list").addEventListener("click", () => this.showList());
    document.getElementById("btn-edit-campaign").addEventListener("click", () => {
      if (this.selectedCampaign) this.openForm(this.selectedCampaign);
    });
    document.getElementById("btn-delete-campaign").addEventListener("click", () => {
      if (this.selectedCampaign) this.confirmDelete(this.selectedCampaign.id);
    });

    // Character linking
    document.getElementById("btn-add-char-to-campaign").addEventListener("click", () => this.openLinkModal());
    document.getElementById("btn-close-link-char-modal").addEventListener("click", () => this.closeLinkModal());
    document.getElementById("btn-close-link-char").addEventListener("click", () => this.closeLinkModal());
    this.DOM.linkModalOverlay.addEventListener("click", () => this.closeLinkModal());
    this.DOM.detailCharList.addEventListener("click", (e) => {
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
    this.DOM.linkCharList.addEventListener("click", (e) => this.handleLinkChar(e));

    // Confirmation modal events
    document.getElementById("btn-confirm-cancel").addEventListener("click", () => this.closeConfirm());
    document.getElementById("btn-close-confirm").addEventListener("click", () => this.closeConfirm());
    document.getElementById("btn-confirm-ok").addEventListener("click", () => this.executeDelete());
    this.DOM.confirmOverlay.addEventListener("click", () => this.closeConfirm());

    // Card delegation
    this.DOM.list.addEventListener("click", (e) => this.handleCardClick(e));

    // Clear validation on input
    this.DOM.nameInput.addEventListener("input", () => this.clearFieldError("name"));

    // Encounter events
    this.DOM.btnAddEncounter.addEventListener("click", () => {
      if (this.selectedCampaign) {
        window.encountersView.openForm(null, this.selectedCampaign.id);
      }
    });

    this.DOM.detailEncounterList.addEventListener("click", (e) => {
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
  }

  // ============================================
  // Load campaigns from database
  // ============================================
  async loadCampaigns() {
    try {
      if (!databaseService.isReady()) {
        console.warn("Database not ready");
        this.campaigns = [];
        this.filteredCampaigns = [];
        this.render();
        return;
      }

      this.campaigns = await databaseService.getAllCampaigns();
      this.applyFilters();
    } catch (error) {
      console.error("Failed to load campaigns:", error);
      showToast("Erro ao carregar campanhas", "error");
    }
  }

  // ============================================
  // Filtering
  // ============================================
  applyFilters() {
    const searchTerm = (this.DOM.search?.value || "").toLowerCase().trim();
    const systemFilter = this.DOM.filterSystem?.value || "";

    this.filteredCampaigns = this.campaigns.filter((c) => {
      const matchesSearch = !searchTerm || c.name.toLowerCase().includes(searchTerm) ||
        (c.description && c.description.toLowerCase().includes(searchTerm));
      const matchesSystem = !systemFilter || c.system === systemFilter;
      return matchesSearch && matchesSystem;
    });

    this.render();
  }

  // ============================================
  // Rendering
  // ============================================
  render() {
    if (!this.DOM.list) return;

    // Update count
    if (this.DOM.count) {
      const total = this.campaigns.length;
      const shown = this.filteredCampaigns.length;
      this.DOM.count.textContent = total === shown
        ? `${total} campanha${total !== 1 ? "s" : ""}`
        : `${shown} de ${total} campanha${total !== 1 ? "s" : ""}`;
    }

    // Show empty state or grid
    const isEmpty = this.filteredCampaigns.length === 0;

    if (this.DOM.empty) {
      this.DOM.empty.classList.toggle("hidden", !isEmpty);
    }
    if (this.DOM.list) {
      this.DOM.list.classList.toggle("hidden", isEmpty);
    }

    if (!isEmpty) {
      this.renderCards();
    }
  }

  renderCards() {
    this.DOM.list.innerHTML = this.filteredCampaigns
      .map((c) => this.renderCard(c))
      .join("");
  }

  renderCard(campaign) {
    const desc = campaign.description || "Sem descrição";
    const system = campaign.system || "";
    const systemBadge = system
      ? `<span class="badge badge--primary campaign-card__system">${this.escapeHTML(system)}</span>`
      : "";
    const date = this.formatDate(campaign.updated_at || campaign.created_at);

    return `
      <div class="campaign-card" data-id="${campaign.id}">
        <div class="campaign-card__header">
          <h3 class="campaign-card__title">${this.escapeHTML(campaign.name)}</h3>
          ${systemBadge}
        </div>
        <p class="campaign-card__desc">${this.escapeHTML(desc)}</p>
        <div class="campaign-card__footer">
          <span class="campaign-card__date">${date}</span>
          <div class="campaign-card__actions">
            <button class="campaign-card__btn" data-action="edit" data-id="${campaign.id}" title="Editar">✏️</button>
            <button class="campaign-card__btn campaign-card__btn--delete" data-action="delete" data-id="${campaign.id}" title="Excluir">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }

  async renderDetail(campaign) {
    if (!this.DOM.detail) return;

    this.DOM.detailName.textContent = campaign.name;

    if (campaign.system) {
      this.DOM.detailSystem.textContent = campaign.system;
      this.DOM.detailSystem.className = "badge badge--primary";
      this.DOM.detailSystem.classList.remove("hidden");
    } else {
      this.DOM.detailSystem.classList.add("hidden");
    }

    this.DOM.detailDesc.textContent = campaign.description || "Sem descrição";
    this.DOM.detailCreated.innerHTML = `<span class="campaign-detail__meta-icon">📅</span> Criada em: ${this.formatDate(campaign.created_at)}`;
    this.DOM.detailUpdated.innerHTML = `<span class="campaign-detail__meta-icon">🔄</span> Atualizada em: ${this.formatDate(campaign.updated_at)}`;

    // Load campaign characters and encounters
    await this.loadCampaignCharacters(campaign.id);
    await this.loadCampaignEncounters(campaign.id);
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
    
    const isEmpty = count === 0;
    this.DOM.detailCharEmpty.classList.toggle("hidden", !isEmpty);
    this.DOM.detailCharList.classList.toggle("hidden", isEmpty);

    if (!isEmpty) {
      this.DOM.detailCharList.innerHTML = characters.map(char => {
        const avatarContent = char.image_path 
          ? `<img src="local-image://${char.image_path}" alt="${char.name}">`
          : `<span class="character-card__avatar-placeholder">👤</span>`;

        return `
          <div class="character-card" data-id="${char.id}">
            <div class="character-card__header">
              <div class="character-card__avatar">
                ${avatarContent}
              </div>
              <div class="character-card__title-group" style="flex: 1;">
                <h3 class="character-card__title">${this.escapeHTML(char.name)}</h3>
              </div>
              <div class="character-card__actions" style="display: flex; gap: 4px;">
                <button class="btn-icon" data-action="edit-char" data-id="${char.id}" title="Editar Personagem">✏️</button>
                <button class="btn-icon btn-icon--danger" data-action="unlink" data-id="${char.id}" title="Remover da Campanha">❌</button>
                <button class="btn-icon btn-icon--danger" data-action="delete-char" data-id="${char.id}" title="Excluir Permanentemente">🗑️</button>
              </div>
            </div>
            <div class="character-card__stats">
              <div class="stat-box">
                <span class="stat-box__label">HP</span>
                <span class="stat-box__value stat-box__value--hp">${char.hp || 0}</span>
              </div>
              <div class="stat-box">
                <span class="stat-box__label">AC</span>
                <span class="stat-box__value stat-box__value--ac">${char.ac || 10}</span>
              </div>
              <div class="stat-box">
                <span class="stat-box__label">Ini</span>
                <span class="stat-box__value stat-box__value--ini">${char.ini || 0}</span>
              </div>
            </div>
          </div>
        `;
      }).join("");
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

    const isEmpty = count === 0;
    this.DOM.detailEncounterEmpty.classList.toggle("hidden", !isEmpty);
    this.DOM.detailEncounterList.classList.toggle("hidden", isEmpty);

    if (!isEmpty) {
      this.DOM.detailEncounterList.innerHTML = encounters.map(enc => {
        return `
          <div class="campaign-card campaign-card--sm" data-id="${enc.id}">
            <div class="campaign-card__header">
              <h3 class="campaign-card__title">${this.escapeHTML(enc.name)}</h3>
              <span class="badge badge--gold">${this.escapeHTML(enc.difficulty || 'Médio')}</span>
            </div>
            <p class="campaign-card__desc text-xs" style="margin-bottom: 8px;">
              📍 ${this.escapeHTML(enc.location || 'Local não definido')}
            </p>
            <div class="campaign-card__footer">
              <span class="campaign-card__date">${this.formatDate(enc.created_at)}</span>
              <div class="campaign-card__actions">
                <button class="btn btn--primary btn--sm" data-action="view-encounter" data-id="${enc.id}">Abrir</button>
                <button class="btn-icon" data-action="edit-encounter" data-id="${enc.id}">✏️</button>
                <button class="btn-icon btn-icon--danger" data-action="delete-encounter" data-id="${enc.id}">🗑️</button>
              </div>
            </div>
          </div>
        `;
      }).join("");
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
      this.DOM.linkCharList.innerHTML = characters.map(char => {
        const avatarContent = char.image_path 
          ? `<img src="local-image://${char.image_path}" alt="${char.name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`
          : `<span style="font-size: 1.2rem;">👤</span>`;

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
      }).join("");
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
    if (confirm("Deseja remover este personagem da campanha? (O personagem continuará existindo)")) {
      try {
        await databaseService.unlinkCharacterFromCampaign(charId, this.selectedCampaign.id);
        showToast("Personagem removido da campanha");
        await this.loadCampaignCharacters(this.selectedCampaign.id);
      } catch (error) {
        showToast("Erro ao remover personagem", "error");
      }
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
        window.dispatchEvent(new CustomEvent('app:edit-character', { detail: char }));
      }
    } catch (error) {
      showToast("Erro ao carregar personagem", "error");
    }
  }

  async handleDeleteChar(e) {
    const btn = e.target.closest('[data-action="delete-char"]');
    if (!btn) return;

    const charId = parseInt(btn.dataset.id, 10);
    if (confirm("Tem certeza que deseja excluir permanentemente este personagem?")) {
      try {
        await databaseService.deleteCharacter(charId);
        showToast("Personagem excluído");
        await this.loadCampaignCharacters(this.selectedCampaign.id);
      } catch (error) {
        showToast("Erro ao excluir", "error");
      }
    }
  }

  // ============================================
  // Card click delegation
  // ============================================
  handleCardClick(e) {
    const target = e.target.closest("[data-action]");
    if (target) {
      e.stopPropagation();
      const action = target.dataset.action;
      const id = parseInt(target.dataset.id, 10);

      if (action === "edit") {
        const campaign = this.campaigns.find((c) => c.id === id);
        if (campaign) this.openForm(campaign);
      } else if (action === "delete") {
        this.confirmDelete(id);
      }
      return;
    }

    // Click on card itself → open detail
    const card = e.target.closest(".campaign-card");
    if (card) {
      const id = parseInt(card.dataset.id, 10);
      const campaign = this.campaigns.find((c) => c.id === id);
      if (campaign) this.openDetail(campaign);
    }
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
    if (this.DOM.systemSelect) this.DOM.systemSelect.value = campaign ? (campaign.system || "") : "";
    if (this.DOM.descInput) this.DOM.descInput.value = campaign ? (campaign.description || "") : "";

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

    try {
      if (this.editingId) {
        // Update
        await databaseService.updateCampaign(this.editingId, {
          name,
          system: system || null,
          description: description || null,
        });
        showToast("Campanha atualizada com sucesso!", "success");
      } else {
        // Create
        await databaseService.createCampaign({
          name,
          system: system || null,
          description: description || null,
        });
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

  // ============================================
  // Delete
  // ============================================
  confirmDelete(id) {
    this.deleteTargetId = id;
    const campaign = this.campaigns.find((c) => c.id === id);

    if (this.DOM.confirmMessage) {
      this.DOM.confirmMessage.textContent = campaign
        ? `Tem certeza que deseja excluir a campanha "${campaign.name}"? Todos os personagens, encontros e notas vinculados também serão excluídos. Esta ação não pode ser desfeita.`
        : "Tem certeza que deseja excluir esta campanha?";
    }

    if (this.DOM.confirmModal) {
      this.DOM.confirmModal.classList.remove("hidden");
    }
  }

  closeConfirm() {
    if (this.DOM.confirmModal) {
      this.DOM.confirmModal.classList.add("hidden");
    }
    this.deleteTargetId = null;
  }

  async executeDelete() {
    if (!this.deleteTargetId) return;

    try {
      await databaseService.deleteCampaign(this.deleteTargetId);
      showToast("Campanha excluída com sucesso!", "success");

      // If viewing detail of deleted campaign, go back to list
      if (this.selectedCampaign && this.selectedCampaign.id === this.deleteTargetId) {
        this.showList();
      }

      this.closeConfirm();
      await this.loadCampaigns();
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      showToast("Erro ao excluir campanha", "error");
      this.closeConfirm();
    }
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

    this.initDOM();
    this.initEvents();
  }

  initDOM() {
    this.DOM = {
      // Encounter List & Metadata Modal
      modal: document.getElementById("encounter-modal"),
      modalTitle: document.getElementById("encounter-modal-title"),
      form: document.getElementById("encounter-form"),
      idInput: document.getElementById("encounter-id"),
      nameInput: document.getElementById("encounter-name"),
      difficultySelect: document.getElementById("encounter-difficulty"),
      locationInput: document.getElementById("encounter-location"),
      descInput: document.getElementById("encounter-description"),
      btnCancel: document.getElementById("btn-cancel-encounter-form"),
      btnCloseModal: document.getElementById("btn-close-encounter-modal"),
      modalOverlay: document.getElementById("encounter-modal-overlay"),

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
    };
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
    this.DOM.tabs?.forEach(tab => {
      tab.addEventListener("click", () => {
        this.DOM.tabs.forEach(t => t.classList.remove("active"));
        this.DOM.tabContents.forEach(c => c.classList.add("hidden"));
        tab.classList.add("active");
        const content = document.getElementById(tab.dataset.tab);
        content.classList.remove("hidden");
        
        if (tab.dataset.tab === "tab-db-chars") this.loadDBParticipants();
      });
    });

    // Quick Add Form
    this.DOM.quickAddForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.addQuickParticipant();
    });

    // Affinity Add Buttons (Delegation)
    document.querySelectorAll('[data-action="add-participant"]').forEach(btn => {
      btn.addEventListener("click", () => {
        this.currentAffinity = btn.dataset.affinity;
        this.openParticipantModal();
      });
    });

    // Search Events
    this.DOM.dbCharSearch?.addEventListener("input", (e) => this.loadDBParticipants(e.target.value));
    this.DOM.apiMonsterSearch?.addEventListener("input", (e) => {
      clearTimeout(this.apiSearchTimeout);
      this.apiSearchTimeout = setTimeout(() => this.searchApiMonsters(e.target.value), 500);
    });

    // Delegation for Participant Cards
    [this.DOM.listAllies, this.DOM.listNeutrals, this.DOM.listEnemies].forEach(list => {
      list?.addEventListener("click", (e) => this.handleParticipantAction(e));
    });
  }

  // ============================================
  // Encounter Form
  // ============================================
  openForm(encounter = null, campaignId = null) {
    this.editingEncounterId = encounter ? encounter.id : null;
    this.currentCampaignId = campaignId || (encounter ? encounter.campaign_id : null);

    if (this.DOM.modalTitle) {
      this.DOM.modalTitle.textContent = encounter ? "Editar Encontro" : "Novo Encontro";
    }

    if (this.DOM.idInput) this.DOM.idInput.value = encounter ? encounter.id : "";
    if (this.DOM.nameInput) this.DOM.nameInput.value = encounter ? encounter.name : "";
    if (this.DOM.difficultySelect) this.DOM.difficultySelect.value = encounter ? (encounter.difficulty || "Médio") : "Médio";
    if (this.DOM.locationInput) this.DOM.locationInput.value = encounter ? (encounter.location || "") : "";
    if (this.DOM.descInput) this.DOM.descInput.value = encounter ? (encounter.description || "") : "";

    this.DOM.modal?.classList.remove("hidden");
    this.DOM.nameInput?.focus();
  }

  closeForm() {
    this.DOM.modal?.classList.add("hidden");
    this.editingEncounterId = null;
  }

  async handleSubmit(e) {
    e.preventDefault();
    const encounterData = {
      campaign_id: this.currentCampaignId,
      name: this.DOM.nameInput.value.trim(),
      difficulty: this.DOM.difficultySelect.value,
      location: this.DOM.locationInput.value.trim(),
      description: this.DOM.descInput.value.trim(),
      monsters: this.editingEncounterId ? this.participants : []
    };

    try {
      if (this.editingEncounterId) {
        await databaseService.updateEncounter(this.editingEncounterId, encounterData);
        showToast("Encontro atualizado!");
      } else {
        await databaseService.createEncounter(encounterData);
        showToast("Encontro criado!");
      }
      this.closeForm();
      // Reload campaign view if active
      if (window.campaignsView && window.campaignsView.selectedCampaign) {
        window.campaignsView.loadCampaignEncounters(this.currentCampaignId);
      }
      
      // Update detail view if active
      if (this.currentEncounter && this.currentEncounter.id === this.editingEncounterId) {
        this.currentEncounter = { ...this.currentEncounter, ...encounterData };
        this.renderManagerHeader();
      }
    } catch (error) {
      console.error("Save encounter failed:", error);
      showToast("Erro ao salvar encontro", "error");
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
    if (confirm("Tem certeza que deseja excluir este encontro?")) {
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
      this.renderParticipants();
      
      this.DOM.detailView?.classList.remove("hidden");
    } catch (error) {
      console.error("Open manager failed:", error);
      showToast("Erro ao abrir gerenciador", "error");
    }
  }

  closeEncounterManager() {
    this.DOM.detailView?.classList.add("hidden");
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
      const affinity = p.affinity || 'enemy';
      if (this.affinityGroups[affinity]) {
        this.affinityGroups[affinity].push({ ...p, originalIndex: index });
      }
    });
  }

  renderParticipants() {
    const renderList = (listEl, group) => {
      if (!listEl) return;
      if (group.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-center py-4 text-xs">Vazio</p>';
        return;
      }
      
      listEl.innerHTML = group.map(p => `
        <div class="participant-card" data-index="${p.originalIndex}">
          <div class="participant-card__header">
            <span class="participant-card__name">${this.escapeHTML(p.name)}</span>
            <div class="participant-card__stats">
              <span class="participant-card__stat-item">HP: <b>${p.hp}</b></span>
              <span class="participant-card__stat-item">AC: <b>${p.ac}</b></span>
              <span class="participant-card__stat-item">Ini: <b>${p.ini}</b></span>
            </div>
          </div>
          <div class="participant-card__actions">
            <button class="btn-icon btn-icon--sm" data-action="duplicate" title="Duplicar">👯</button>
            <button class="btn-icon btn-icon--sm" data-action="move" data-target="ally" title="Para Aliado">🟢</button>
            <button class="btn-icon btn-icon--sm" data-action="move" data-target="neutral" title="Para Neutro">🟡</button>
            <button class="btn-icon btn-icon--sm" data-action="move" data-target="enemy" title="Para Inimigo">🔴</button>
            <button class="btn-icon btn-icon--sm btn-icon--danger" data-action="remove" title="Remover">🗑️</button>
          </div>
        </div>
      `).join("");
    };

    renderList(this.DOM.listAllies, this.affinityGroups.ally);
    renderList(this.DOM.listNeutrals, this.affinityGroups.neutral);
    renderList(this.DOM.listEnemies, this.affinityGroups.enemy);
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
      const copy = { ...this.participants[index], id: Date.now() + Math.random() };
      this.participants.push(copy);
    } else if (action === "move") {
      this.participants[index].affinity = btn.dataset.target;
    }

    await this.saveParticipants();
  }

  async saveParticipants() {
    try {
      await databaseService.updateEncounter(this.currentEncounter.id, {
        ...this.currentEncounter,
        monsters: this.participants
      });
      this.organizeParticipants();
      this.renderParticipants();
    } catch (error) {
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
      const filtered = characters.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase())
      );
      
      this.DOM.dbPartList.innerHTML = filtered.map(c => `
        <div class="selection-item" data-type="db" data-id="${c.id}">
          <div class="selection-item__info">
            <span class="selection-item__name">${this.escapeHTML(c.name)}</span>
            <span class="selection-item__meta">HP: ${c.hp} | AC: ${c.ac} | Ini: ${c.ini}</span>
          </div>
          <button class="btn btn--secondary btn--sm">Adicionar</button>
        </div>
      `).join("");

      this.DOM.dbPartList.querySelectorAll('.selection-item').forEach(item => {
        item.addEventListener("click", () => {
          const char = characters.find(c => c.id == item.dataset.id);
          this.addParticipantToList({
            id: Date.now(),
            name: char.name,
            hp: char.hp,
            ac: char.ac,
            ini: char.ini,
            affinity: this.currentAffinity
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
      affinity: this.currentAffinity
    });
    
    this.DOM.quickAddForm.reset();
  }

  async searchApiMonsters(query) {
    if (!query || query.length < 2) return;
    
    this.DOM.apiPartList.innerHTML = '<p class="text-center py-4">Buscando...</p>';
    
    try {
      // Actually fetch from dnd5eapi
      const response = await fetch(`https://www.dnd5eapi.co/api/2014/monsters?name=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.results.length === 0) {
        this.DOM.apiPartList.innerHTML = '<p class="text-center py-4 text-muted">Nenhum monstro encontrado.</p>';
        return;
      }

      this.DOM.apiPartList.innerHTML = data.results.map(m => `
        <div class="selection-item" data-index="${m.index}">
          <div class="selection-item__info">
            <span class="selection-item__name">${this.escapeHTML(m.name)}</span>
            <span class="selection-item__meta">API D&D 5e</span>
          </div>
          <button class="btn btn--secondary btn--sm">Adicionar</button>
        </div>
      `).join("");

      this.DOM.apiPartList.querySelectorAll('.selection-item').forEach(item => {
        item.addEventListener("click", () => this.addApiMonster(item.dataset.index));
      });
    } catch (error) {
      this.DOM.apiPartList.innerHTML = '<p class="text-center py-4 text-danger">Erro ao buscar na API.</p>';
    }
  }

  async addApiMonster(index) {
    try {
      const response = await fetch(`https://www.dnd5eapi.co/api/2014/monsters/${index}`);
      const monster = await response.json();
      
      this.addParticipantToList({
        id: Date.now(),
        name: monster.name,
        hp: monster.hit_points || 0,
        ac: monster.armor_class?.[0]?.value || 10,
        ini: 0,
        affinity: this.currentAffinity,
        api_url: monster.url ? `https://www.dnd5eapi.co${monster.url}` : null
      });
    } catch (error) {
      showToast("Erro ao carregar detalhes do monstro", "error");
    }
  }

  async addParticipantToList(participant) {
    this.participants.push(participant);
    await this.saveParticipants();
    showToast(`${participant.name} adicionado ao encontro!`);
    this.closeParticipantModal();
  }

  // Helpers
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
