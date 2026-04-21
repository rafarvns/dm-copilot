// DM Copilot - Characters View
// Gerenciamento global de personagens (independentes de campanhas)

import databaseService from "../db/database.js";
import { showToast } from "./database-views.js";

class GlobalCharactersView {
  constructor() {
    this.characters = [];
    this.filteredCharacters = [];
    this.editingId = null;
    this.mounted = false;

    this.DOM = {};
  }

  cacheDOM() {
    this.DOM = {
      listView: document.getElementById("characters-list-view"),
      list: document.getElementById("characters-list"),
      empty: document.getElementById("characters-empty"),
      count: document.getElementById("characters-count"),
      search: document.getElementById("character-search"),
      filterSystem: document.getElementById("character-filter-system"),
      
      // Modal form
      modal: document.getElementById("character-modal"),
      modalOverlay: document.getElementById("character-modal-overlay"),
      modalTitle: document.getElementById("char-modal-title"),
      form: document.getElementById("character-form"),
      idInput: document.getElementById("character-id"),
      nameInput: document.getElementById("character-name"),
      systemInput: document.getElementById("character-system"), // Changed from systemSelect to systemInput
      hpInput: document.getElementById("character-hp"),
      acInput: document.getElementById("character-ac"),
      iniInput: document.getElementById("character-ini"),
      descInput: document.getElementById("character-description"),
      errorName: document.getElementById("error-char-name"),
      errorSystem: document.getElementById("error-char-system"),

      // Image
      imageUpload: document.getElementById("char-image-preview"),
      imageInput: document.getElementById("character-image-input"),
      imageDisplay: document.getElementById("char-image-display"),
      imagePlaceholder: document.getElementById("char-image-placeholder"),
    };
  }

  async mount() {
    if (!this.mounted) {
      this.cacheDOM();
      this.bindEvents();
      this.mounted = true;
    }
    await this.loadCharacters();
  }

  bindEvents() {
    document.getElementById("btn-new-character").addEventListener("click", () => this.openForm());
    document.getElementById("btn-char-empty-new").addEventListener("click", () => this.openForm());

    this.DOM.search.addEventListener("input", () => this.applyFilters());
    this.DOM.filterSystem.addEventListener("change", () => this.applyFilters());

    this.DOM.form.addEventListener("submit", (e) => this.handleSubmit(e));
    document.getElementById("btn-close-char-modal").addEventListener("click", () => this.closeForm());
    document.getElementById("btn-cancel-char-form").addEventListener("click", () => this.closeForm());
    this.DOM.modalOverlay.addEventListener("click", () => this.closeForm());

    this.DOM.list.addEventListener("click", (e) => this.handleCardAction(e));

    this.DOM.nameInput.addEventListener("input", () => this.clearFieldError("Name"));
    this.DOM.systemInput.addEventListener("change", () => this.clearFieldError("System"));

    window.addEventListener('app:edit-character', (e) => {
      this.openForm(e.detail);
    });

    this.DOM.imageUpload.addEventListener("click", () => this.DOM.imageInput.click());
    this.DOM.imageInput.addEventListener("change", (e) => this.handleImageSelect(e));
  }

  async loadCharacters() {
    try {
      if (!databaseService.isReady()) return;
      this.characters = await databaseService.getAllCharacters();
      this.applyFilters();
    } catch (error) {
      console.error("Failed to load characters:", error);
      showToast("Erro ao carregar personagens", "error");
    }
  }

  applyFilters() {
    const searchTerm = (this.DOM.search?.value || "").toLowerCase().trim();
    const systemFilter = this.DOM.filterSystem?.value || "";

    this.filteredCharacters = this.characters.filter((c) => {
      const matchesSearch = !searchTerm || c.name.toLowerCase().includes(searchTerm) ||
        (c.description && c.description.toLowerCase().includes(searchTerm));
      const matchesSystem = !systemFilter || c.system === systemFilter;
      return matchesSearch && matchesSystem;
    });

    this.render();
  }

  render() {
    if (!this.DOM.list) return;

    const total = this.characters.length;
    const shown = this.filteredCharacters.length;
    this.DOM.count.textContent = total === shown
      ? `${total} personagem${total !== 1 ? "s" : ""}`
      : `${shown} de ${total} personagem${total !== 1 ? "s" : ""}`;

    const isEmpty = this.filteredCharacters.length === 0;
    this.DOM.empty.classList.toggle("hidden", !isEmpty);
    this.DOM.list.classList.toggle("hidden", isEmpty);

    if (!isEmpty) {
      this.DOM.list.innerHTML = this.filteredCharacters
        .map((c) => this.renderCard(c))
        .join("");
    }
  }

  renderCard(char) {
    const avatarContent = char.image_path 
      ? `<img src="local-image://${char.image_path}" alt="${char.name}">`
      : `<span class="character-card__avatar-placeholder">👤</span>`;

    return `
      <div class="character-card" data-id="${char.id}">
        <div class="character-card__header">
          <div class="character-card__avatar">
            ${avatarContent}
          </div>
          <div class="character-card__title-group">
            <h3 class="character-card__title">${this.escapeHTML(char.name)}</h3>
            <span class="badge badge--primary">${this.escapeHTML(char.system)}</span>
          </div>
        </div>
        
        <p class="character-card__desc">${this.escapeHTML(char.description || "Sem descrição")}</p>
        
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

        <div class="campaign-card__footer mt-4">
          <span class="campaign-card__date">${this.formatDate(char.updated_at || char.created_at)}</span>
          <div class="campaign-card__actions">
            <button class="campaign-card__btn" data-action="edit" data-id="${char.id}" title="Editar">✏️</button>
            <button class="campaign-card__btn campaign-card__btn--delete" data-action="delete" data-id="${char.id}" title="Excluir">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }

  handleCardAction(e) {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const id = parseInt(target.dataset.id, 10);
    const char = this.characters.find(c => c.id === id);

    if (action === "edit" && char) {
      this.openForm(char);
    } else if (action === "delete") {
      this.handleDelete(id);
    }
  }

  async handleDelete(id) {
    if (confirm("Tem certeza que deseja excluir este personagem permanentemente?")) {
      try {
        await databaseService.deleteCharacter(id);
        showToast("Personagem excluído com sucesso");
        await this.loadCharacters();
      } catch (error) {
        console.error("Failed to delete character:", error);
        showToast("Erro ao excluir personagem", "error");
      }
    }
  }

  openForm(char = null) {
    this.editingId = char ? char.id : null;
    this.selectedImageFile = null;
    this.DOM.modalTitle.textContent = char ? "Editar Personagem" : "Novo Personagem";
    
    this.DOM.idInput.value = char ? char.id : "";
    this.DOM.nameInput.value = char ? char.name : "";
    this.DOM.systemInput.value = char ? char.system : "";
    this.DOM.hpInput.value = char ? char.hp : "";
    this.DOM.acInput.value = char ? char.ac : "";
    this.DOM.iniInput.value = char ? char.ini : "";
    this.DOM.descInput.value = char ? char.description || "" : "";

    // Reset image preview
    if (char && char.image_path) {
      this.DOM.imageDisplay.src = `local-image://${char.image_path}`;
      this.DOM.imageDisplay.classList.remove("hidden");
      this.DOM.imagePlaceholder.classList.add("hidden");
    } else {
      this.DOM.imageDisplay.src = "";
      this.DOM.imageDisplay.classList.add("hidden");
      this.DOM.imagePlaceholder.classList.remove("hidden");
    }

    this.clearAllErrors();
    this.DOM.modal.classList.remove("hidden");
    this.DOM.nameInput.focus();
  }

  closeForm() {
    this.DOM.modal.classList.add("hidden");
    this.editingId = null;
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const data = {
      name: this.DOM.nameInput.value.trim(),
      system: this.DOM.systemInput.value,
      hp: parseInt(this.DOM.hpInput.value) || 0,
      ac: parseInt(this.DOM.acInput.value) || 10,
      ini: parseInt(this.DOM.iniInput.value) || 0,
      description: this.DOM.descInput.value.trim(),
      image_path: this.editingId ? this.characters.find(c => c.id === this.editingId)?.image_path : null
    };

    if (!this.validate(data)) return;

    try {
      // Processar imagem se houver uma nova selecionada
      if (this.selectedImageFile) {
        const processedBuffer = await this.processImage(this.selectedImageFile);
        const relativePath = await databaseService.saveCharacterImage(processedBuffer);
        data.image_path = relativePath;
      }

      if (this.editingId) {
        await databaseService.updateCharacter(this.editingId, data);
        showToast("Personagem atualizado!");
      } else {
        await databaseService.createCharacter(data);
        showToast("Personagem criado!");
      }
      this.closeForm();
      await this.loadCharacters();
    } catch (error) {
      console.error("Error saving character:", error);
      showToast("Erro ao salvar personagem", "error");
    }
  }

  async handleDelete(id) {
    // Para simplificar, vamos usar confirm padrão aqui ou reutilizar o confirm modal do app
    if (confirm("Tem certeza que deseja excluir este personagem?")) {
      try {
        await databaseService.deleteCharacter(id);
        showToast("Personagem excluído");
        await this.loadCharacters();
      } catch (error) {
        showToast("Erro ao excluir", "error");
      }
    }
  }

  validate(data) {
    let valid = true;
    if (!data.name) {
      this.showFieldError("Name", "Nome é obrigatório");
      valid = false;
    }
    if (!data.system) {
      this.showFieldError("System", "Sistema é obrigatório");
      valid = false;
    }
    return valid;
  }

  showFieldError(field, message) {
    const errorEl = this.DOM[`error${field}`];
    const inputEl = this.DOM[`${field.toLowerCase()}Input`];
    
    if (errorEl) errorEl.textContent = message;
    if (inputEl) inputEl.classList.add("form-input--error");
  }

  clearFieldError(field) {
    const errorEl = this.DOM[`error${field}`];
    const inputEl = this.DOM[`${field.toLowerCase()}Input`];
    
    if (errorEl) errorEl.textContent = "";
    if (inputEl) inputEl.classList.remove("form-input--error");
  }

  clearAllErrors() {
    this.clearFieldError("Name");
    this.clearFieldError("System");
  }

  formatDate(isoString) {
    if (!isoString) return "—";
    const date = new Date(isoString);
    return date.toLocaleDateString("pt-BR");
  }

  escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (event) => {
      this.DOM.imageDisplay.src = event.target.result;
      this.DOM.imageDisplay.classList.remove("hidden");
      this.DOM.imagePlaceholder.classList.add("hidden");
    };
    reader.readAsDataURL(file);

    this.selectedImageFile = file;
  }

  async processImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const MAX_SIZE = 800;
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
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            blob.arrayBuffer().then(resolve);
          } else {
            reject(new Error("Falha ao exportar imagem"));
          }
        }, "image/webp", 0.85);
      };
      img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      img.src = URL.createObjectURL(file);
    });
  }
}

export default new GlobalCharactersView();
