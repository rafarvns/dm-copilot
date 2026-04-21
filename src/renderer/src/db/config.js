// Configurações do banco de dados
// Este arquivo define as configurações e constantes do sistema de banco de dados

// ============================================
// Configurações do Banco de Dados
// ============================================
export const DB_CONFIG = {
  // Nome do arquivo do banco de dados
  filename: "dm-copilot.db",
  
  // Versão atual do schema
  currentVersion: 1,
  
  // Modo de journal (WAL para melhor concorrência)
  journalMode: "WAL",
  
  // Habilitar foreign keys
  foreignKeys: true,
  
  // Timeout para operações (ms)
  timeout: 5000,
};

// ============================================
// Nomes das Tabelas
// ============================================
export const TABLES = {
  CAMPAIGNS: "campaigns",
  CHARACTERS: "characters",
  ENCOUNTERS: "encounters",
  NOTES: "notes",
  SETTINGS: "settings",
  MIGRATIONS: "schema_migrations",
};

// ============================================
// Estrutura do Schema (para referência)
// ============================================
export const SCHEMA = {
  campaigns: {
    id: "INTEGER PRIMARY KEY AUTOINCREMENT",
    name: "TEXT NOT NULL",
    description: "TEXT",
    system: "TEXT",
    created_at: "TEXT NOT NULL",
    updated_at: "TEXT",
  },
  characters: {
    id: "INTEGER PRIMARY KEY AUTOINCREMENT",
    campaign_id: "INTEGER NOT NULL",
    name: "TEXT NOT NULL",
    class: "TEXT",
    level: "INTEGER DEFAULT 1",
    race: "TEXT",
    hp: "INTEGER",
    max_hp: "INTEGER",
    attributes: "TEXT",
    created_at: "TEXT NOT NULL",
    updated_at: "TEXT",
  },
  encounters: {
    id: "INTEGER PRIMARY KEY AUTOINCREMENT",
    campaign_id: "INTEGER NOT NULL",
    name: "TEXT NOT NULL",
    description: "TEXT",
    difficulty: "TEXT",
    monsters: "TEXT",
    created_at: "TEXT NOT NULL",
    updated_at: "TEXT",
  },
  notes: {
    id: "INTEGER PRIMARY KEY AUTOINCREMENT",
    campaign_id: "INTEGER NOT NULL",
    title: "TEXT NOT NULL",
    content: "TEXT",
    created_at: "TEXT NOT NULL",
    updated_at: "TEXT",
  },
  settings: {
    key: "TEXT PRIMARY KEY",
    value: "TEXT",
    updated_at: "TEXT NOT NULL",
  },
};

// ============================================
// Índices para Performance
// ============================================
export const INDEXES = {
  characters_campaign_id: "idx_characters_campaign_id",
  encounters_campaign_id: "idx_encounters_campaign_id",
  notes_campaign_id: "idx_notes_campaign_id",
  characters_name: "idx_characters_name",
  campaigns_name: "idx_campaigns_name",
};

// ============================================
// Funções de Utilidade
// ============================================
export function getDatabasePath() {
  if (typeof process !== "undefined" && process.env && process.env.ELECTRON_RUNNER) {
    // No main process
    const { app } = require("electron");
    return app.getPath("userData");
  }
  // No renderer process, usar o caminho do preload
  return window.dmCopilot?.db?.getPath?.() || "";
}

export function getDatabaseFilePath() {
  return `${getDatabasePath()}/${DB_CONFIG.filename}`;
}

// Exportar configurações
export default {
  DB_CONFIG,
  TABLES,
  SCHEMA,
  INDEXES,
  getDatabasePath,
  getDatabaseFilePath,
};
