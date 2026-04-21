// Exemplo de como usar o banco de dados em uma view
// Este arquivo demonstra integração com o sistema de views

import databaseService from "./db/database.js";

// ============================================
// View de Campanhas
// ============================================
class CampaignsView {
  constructor() {
    this.campaigns = [];
    this DOM = {
      list: document.getElementById("campaigns-list"),
      form: document.getElementById("campaign-form"),
      nameInput: document.getElementById("campaign-name"),
      descInput: document.getElementById("campaign-desc"),
      systemSelect: document.getElementById("campaign-system"),
    };
  }

  // ============================================
  // Carregar campanhas do banco
  // ============================================
  async loadCampaigns() {
    try {
      if (!databaseService.isReady()) {
        console.warn("Database not ready");
        return;
      }

      this.campaigns = await databaseService.getAllCampaigns();
      this.render();
    } catch (error) {
      console.error("Failed to load campaigns:", error);
    }
  }

  // ============================================
  // Renderizar lista de campanhas
  // ============================================
  render() {
    if (!this.DOM.list) return;

    this.DOM.list.innerHTML = this.campaigns
      .map(
        (c) => `
      <div class="campaign-card" data-id="${c.id}">
        <h3>${c.name}</h3>
        <p>${c.description || "Sem descrição"}</p>
        <small>Sistema: ${c.system || "Não especificado"}</small>
        <div class="campaign-actions">
          <button onclick="editCampaign(${c.id})">Editar</button>
          <button onclick="deleteCampaign(${c.id})">Excluir</button>
        </div>
      </div>
    `
      )
      .join("");
  }

  // ============================================
  // Criar nova campanha
  // ============================================
  async createCampaign() {
    if (!this.DOM.form) return;

    const name = this.DOM.nameInput.value.trim();
    const description = this.DOM.descInput.value.trim();
    const system = this.DOM.systemSelect.value;

    if (!name) {
      alert("Nome da campanha é obrigatório");
      return;
    }

    try {
      const campaign = await databaseService.createCampaign({
        name,
        description,
        system,
      });

      this.campaigns.push(campaign);
      this.render();
      this.DOM.form.reset();

      alert(`Campanha "${name}" criada com sucesso!`);
    } catch (error) {
      console.error("Failed to create campaign:", error);
      alert("Erro ao criar campanha");
    }
  }

  // ============================================
  // Editar campanha
  // ============================================
  async editCampaign(id) {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return;

    const newName = prompt("Novo nome:", campaign.name);
    if (!newName) return;

    try {
      await databaseService.updateCampaign(id, {
        name: newName,
        description: campaign.description,
        system: campaign.system,
      });

      // Atualizar lista local
      const index = this.campaigns.findIndex((c) => c.id === id);
      if (index !== -1) {
        this.campaigns[index].name = newName;
        this.render();
      }

      alert("Campanha atualizada!");
    } catch (error) {
      console.error("Failed to update campaign:", error);
      alert("Erro ao atualizar campanha");
    }
  }

  // ============================================
  // Excluir campanha
  // ============================================
  async deleteCampaign(id) {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;

    try {
      const deleted = await databaseService.deleteCampaign(id);
      if (deleted) {
        this.campaigns = this.campaigns.filter((c) => c.id !== id);
        this.render();
        alert("Campanha excluída!");
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      alert("Erro ao excluir campanha");
    }
  }
}

// ============================================
// View de Personagens
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

  async createCharacter() {
    const name = prompt("Nome do personagem:");
    if (!name) return;

    try {
      const character = await databaseService.createCharacter({
        campaign_id: this.currentCampaignId,
        name,
        class: "Aventureiro",
        level: 1,
        race: "Humano",
        hp: 20,
        max_hp: 20,
      });

      this.characters.push(character);
      this.render();
      alert("Personagem criado!");
    } catch (error) {
      console.error("Failed to create character:", error);
      alert("Erro ao criar personagem");
    }
  }

  render() {
    // Implementar renderização
    console.log("Characters:", this.characters);
  }
}

// ============================================
// View de Encontros
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

  async createEncounter() {
    const name = prompt("Nome do encontro:");
    if (!name) return;

    try {
      const encounter = await databaseService.createEncounter({
        campaign_id: this.currentCampaignId,
        name,
        description: "Descrição do encontro",
        difficulty: "medium",
        monsters: [],
      });

      this.encounters.push(encounter);
      this.render();
      alert("Encontro criado!");
    } catch (error) {
      console.error("Failed to create encounter:", error);
      alert("Erro ao criar encontro");
    }
  }

  render() {
    // Implementar renderização
    console.log("Encounters:", this.encounters);
  }
}

// ============================================
// View de Notas
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

  async createNote() {
    const title = prompt("Título da nota:");
    if (!title) return;

    const content = prompt("Conteúdo da nota:");
    if (!content) return;

    try {
      const note = await databaseService.createNote({
        campaign_id: this.currentCampaignId,
        title,
        content,
      });

      this.notes.push(note);
      this.render();
      alert("Nota criada!");
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("Erro ao criar nota");
    }
  }

  render() {
    // Implementar renderização
    console.log("Notes:", this.notes);
  }
}

// ============================================
// Inicialização
// ============================================
let campaignsView, charactersView, encountersView, notesView;

document.addEventListener("DOMContentLoaded", async () => {
  // Inicializar views
  campaignsView = new CampaignsView();
  charactersView = new CharactersView();
  encountersView = new EncountersView();
  notesView = new NotesView();

  // Carregar campanhas
  await campaignsView.loadCampaigns();

  // Expor funções globalmente para uso nos botões
  window.editCampaign = (id) => campaignsView.editCampaign(id);
  window.deleteCampaign = (id) => campaignsView.deleteCampaign(id);
});

// Exportar para uso externo
export {
  CampaignsView,
  CharactersView,
  EncountersView,
  NotesView,
  campaignsView,
  charactersView,
  encountersView,
  notesView,
};
