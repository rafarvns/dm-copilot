// DM Copilot - Database Service (Renderer)
// Helper para acessar o banco de dados do main process

class DatabaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  // ============================================
  // Inicialização
  // ============================================
  async init() {
    try {
      if (!window.dmCopilot?.db) {
        throw new Error("Database API not available");
      }

      const result = await window.dmCopilot.db.init();
      
      if (result.success) {
        this.initialized = true;
        this.dbPath = result.path;
        console.log("Database initialized:", this.dbPath);
        return true;
      } else {
        console.error("Database initialization failed:", result.error);
        return false;
      }
    } catch (error) {
      console.error("Failed to initialize database service:", error);
      return false;
    }
  }

  // ============================================
  // Verificar status
  // ============================================
  isReady() {
    return this.initialized && window.dmCopilot?.db?.isReady;
  }

  // ============================================
  // Campaigns
  // ============================================
  async createCampaign(data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.campaigns.create(data);
  }

  async getAllCampaigns() {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.campaigns.getAll();
  }

  async getCampaignById(id) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.campaigns.getById(id);
  }

  async updateCampaign(id, data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.campaigns.update(id, data);
  }

  async deleteCampaign(id) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.campaigns.delete(id);
  }

  // ============================================
  // Characters
  // ============================================
  async createCharacter(data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.create(data);
  }

  async getAllCharacters() {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.getAll();
  }

  async getCharactersBySystem(system) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.getBySystem(system);
  }

  async getCharactersByCampaign(campaignId) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.getByCampaign(campaignId);
  }

  async getCharacterById(id) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.getById(id);
  }

  async updateCharacter(id, data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.update(id, data);
  }

  async deleteCharacter(id) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.delete(id);
  }

  async linkCharacterToCampaign(charId, campId) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.linkToCampaign(charId, campId);
  }

  async unlinkCharacterFromCampaign(charId, campId) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.unlinkFromCampaign(charId, campId);
  }

  async getAvailableCharactersForCampaign(campId, system) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.getAvailableForCampaign(campId, system);
  }

  async saveCharacterImage(imageData) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.saveImage(imageData);
  }

  // ============================================
  // Encounters
  // ============================================
  async createEncounter(data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.encounters.create(data);
  }

  async getEncountersByCampaign(campaignId) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.encounters.getAll(campaignId);
  }

  async getEncounterById(id) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.encounters.getById(id);
  }

  async updateEncounter(id, data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.encounters.update(id, data);
  }

  async deleteEncounter(id) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.encounters.delete(id);
  }

  // ============================================
  // Notes
  // ============================================
  async createNote(data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.notes.create(data);
  }

  async getNotesByCampaign(campaignId) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.notes.getAll(campaignId);
  }

  async getNoteById(id) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.notes.getById(id);
  }

  async updateNote(id, data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.notes.update(id, data);
  }

  async deleteNote(id) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.notes.delete(id);
  }

  // ============================================
  // Backup
  // ============================================
  async backup(destinationPath = null) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.backup(destinationPath);
  }
}

// Singleton instance
const databaseService = new DatabaseService();

export default databaseService;
