// DM Copilot - Database Service (Renderer)
// Helper para acessar o banco de dados do main process

import { EventBus } from "../core/event-bus.js";

function handleQuotaAwareResult(res) {
  if (res && res.ok === false) {
    if (res.code === "QUOTA_EXCEEDED") {
      EventBus.emit("quota:exceeded", res);
    }
    const err = new Error(res.code || res.error || "OPERATION_FAILED");
    err.code = res.code;
    err.payload = res;
    throw err;
  }
  return res && res.ok ? res.data : res;
}

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
    const res = await window.dmCopilot.db.campaigns.create(data);
    return handleQuotaAwareResult(res);
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

  async getRecentCampaigns(limit = 5) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.campaigns.getRecent(limit);
  }

  async saveCampaignImage(buffer) {
    if (!this.isReady()) throw new Error("Database service not ready");
    return window.dmCopilot.db.campaigns.saveImage(buffer);
  }

  async getCampaignStats(id) {
    if (!this.isReady()) throw new Error("Database service not ready");
    return window.dmCopilot.db.campaigns.getStats(id);
  }

  // ============================================
  // Characters
  // ============================================
  async createCharacter(data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    const res = await window.dmCopilot.db.characters.create(data);
    return handleQuotaAwareResult(res);
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

  async getRecentCharacters(limit = 5) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.getRecent(limit);
  }

  async countCharacters() {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.characters.count();
  }

  // ============================================
  // Encounters
  // ============================================
  async createEncounter(data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    const res = await window.dmCopilot.db.encounters.create(data);
    return handleQuotaAwareResult(res);
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
    const res = await window.dmCopilot.db.encounters.update(id, data);
    return handleQuotaAwareResult(res);
  }

  async deleteEncounter(id) {
    if (!this.isReady()) throw new Error("Database not initialized");
    return await window.dmCopilot.db.encounters.delete(id);
  }

  async saveEncounterImage(imageData) {
    return await window.dmCopilot.db.encounters.saveImage(imageData);
  }

  async listEncounterPresets() {
    return await window.dmCopilot.db.encounters.listPresets();
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
  // Scenes
  // ============================================
  async createScene(data) {
    if (!this.isReady()) throw new Error("Database not initialized");
    const res = await window.dmCopilot.db.scenes.create(data);
    return handleQuotaAwareResult(res);
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
