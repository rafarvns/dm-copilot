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

    // Confirm modal
    document.getElementById("btn-confirm-cancel").addEventListener("click", () => this.closeConfirm());
    document.getElementById("btn-close-confirm").addEventListener("click", () => this.closeConfirm());
    document.getElementById("btn-confirm-ok").addEventListener("click", () => this.executeDelete());
    this.DOM.confirmOverlay.addEventListener("click", () => this.closeConfirm());

    // Card delegation
    this.DOM.list.addEventListener("click", (e) => this.handleCardClick(e));

    // Clear validation on input
    this.DOM.nameInput.addEventListener("input", () => this.clearFieldError("name"));
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

  renderDetail(campaign) {
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
  }

  async loadEncounters(campaignId) {
    this.currentCampaignId = campaignId;
    try {
      this.encounters = await databaseService.getEncountersByCampaign(campaignId);
      this.render();
    } catch (error) {
      console.error("Failed to load encounters:", error);
    }
  }

  render() {
    console.log("Encounters:", this.encounters);
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
