// Utilitários para o banco de dados
// Funções auxiliares para operações comuns

// ============================================
// Validar dados
// ============================================
export function validateCampaign(data) {
  const errors = [];

  if (!data.name || data.name.trim() === "") {
    errors.push("Nome da campanha é obrigatório");
  }

  if (data.name && data.name.length > 100) {
    errors.push("Nome da campanha deve ter no máximo 100 caracteres");
  }

  if (data.description && data.description.length > 1000) {
    errors.push("Descrição deve ter no máximo 1000 caracteres");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCharacter(data) {
  const errors = [];

  if (!data.name || data.name.trim() === "") {
    errors.push("Nome do personagem é obrigatório");
  }

  if (data.name && data.name.length > 100) {
    errors.push("Nome do personagem deve ter no máximo 100 caracteres");
  }

  if (data.level && (data.level < 1 || data.level > 20)) {
    errors.push("Nível deve estar entre 1 e 20");
  }

  if (data.hp && data.hp < 0) {
    errors.push("HP não pode ser negativo");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateEncounter(data) {
  const errors = [];

  if (!data.name || data.name.trim() === "") {
    errors.push("Nome do encontro é obrigatório");
  }

  if (data.name && data.name.length > 100) {
    errors.push("Nome do encontro deve ter no máximo 100 caracteres");
  }

  if (data.difficulty && !["easy", "medium", "hard", "deadly"].includes(data.difficulty)) {
    errors.push("Dificuldade deve ser: easy, medium, hard ou deadly");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateNote(data) {
  const errors = [];

  if (!data.title || data.title.trim() === "") {
    errors.push("Título da nota é obrigatório");
  }

  if (data.title && data.title.length > 200) {
    errors.push("Título deve ter no máximo 200 caracteres");
  }

  if (data.content && data.content.length > 10000) {
    errors.push("Conteúdo deve ter no máximo 10000 caracteres");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// Formatar dados
// ============================================
export function formatCampaign(campaign) {
  return {
    ...campaign,
    created_at: new Date(campaign.created_at).toLocaleDateString("pt-BR"),
    updated_at: campaign.updated_at
      ? new Date(campaign.updated_at).toLocaleDateString("pt-BR")
      : null,
  };
}

export function formatCharacter(character) {
  return {
    ...character,
    created_at: new Date(character.created_at).toLocaleDateString("pt-BR"),
    attributes: character.attributes ? JSON.parse(character.attributes) : null,
  };
}

export function formatEncounter(encounter) {
  return {
    ...encounter,
    created_at: new Date(encounter.created_at).toLocaleDateString("pt-BR"),
    monsters: encounter.monsters ? JSON.parse(encounter.monsters) : null,
  };
}

export function formatNote(note) {
  return {
    ...note,
    created_at: new Date(note.created_at).toLocaleDateString("pt-BR"),
    updated_at: note.updated_at
      ? new Date(note.updated_at).toLocaleDateString("pt-BR")
      : null,
  };
}

// ============================================
// Contadores
// ============================================
export async function getCampaignStats(db) {
  const { countCampaigns } = require("./queries/campaigns");
  const { countCharactersByCampaign } = require("./queries/characters");
  const { countEncountersByCampaign } = require("./queries/encounters");
  const { countNotesByCampaign } = require("./queries/notes");

  const totalCampaigns = countCampaigns(db);

  return {
    totalCampaigns,
    // Os outros contadores precisam de campaignId específico
  };
}

// ============================================
// Busca
// ============================================
export function searchCampaigns(campaigns, query) {
  const lowerQuery = query.toLowerCase();
  return campaigns.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      (c.description && c.description.toLowerCase().includes(lowerQuery)) ||
      (c.system && c.system.toLowerCase().includes(lowerQuery))
  );
}

export function searchCharacters(characters, query) {
  const lowerQuery = query.toLowerCase();
  return characters.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      (c.class && c.class.toLowerCase().includes(lowerQuery)) ||
      (c.race && c.race.toLowerCase().includes(lowerQuery))
  );
}

export function searchEncounters(encounters, query) {
  const lowerQuery = query.toLowerCase();
  return encounters.filter(
    (e) =>
      e.name.toLowerCase().includes(lowerQuery) ||
      (e.description && e.description.toLowerCase().includes(lowerQuery))
  );
}

export function searchNotes(notes, query) {
  const lowerQuery = query.toLowerCase();
  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(lowerQuery) ||
      (n.content && n.content.toLowerCase().includes(lowerQuery))
  );
}

// ============================================
// Exportar
// ============================================
export default {
  validateCampaign,
  validateCharacter,
  validateEncounter,
  validateNote,
  formatCampaign,
  formatCharacter,
  formatEncounter,
  formatNote,
  getCampaignStats,
  searchCampaigns,
  searchCharacters,
  searchEncounters,
  searchNotes,
};
