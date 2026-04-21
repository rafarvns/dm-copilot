// Migration v1: Schema inicial
// Cria todas as tabelas do sistema

const version = 1;
const name = "Initial schema - campaigns, characters, encounters, notes";

function up(db) {
  // Tabela de campanhas
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      system TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  // Tabela de personagens
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      class TEXT,
      level INTEGER DEFAULT 1,
      race TEXT,
      hp INTEGER,
      max_hp INTEGER,
      attributes TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  // Tabela de encontros
  db.exec(`
    CREATE TABLE IF NOT EXISTS encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      difficulty TEXT,
      monsters TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  // Tabela de notas
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  // Tabela de configurações
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  // Tabela de personagens (índices para performance)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_characters_campaign_id ON characters(campaign_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_encounters_campaign_id ON encounters(campaign_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_campaign_id ON notes(campaign_id)
  `);
}

function down(db) {
  // Remover índices
  db.exec("DROP INDEX IF EXISTS idx_characters_campaign_id");
  db.exec("DROP INDEX IF EXISTS idx_encounters_campaign_id");
  db.exec("DROP INDEX IF EXISTS idx_notes_campaign_id");

  // Remover tabelas
  db.exec("DROP TABLE IF EXISTS settings");
  db.exec("DROP TABLE IF EXISTS notes");
  db.exec("DROP TABLE IF EXISTS encounters");
  db.exec("DROP TABLE IF EXISTS characters");
  db.exec("DROP TABLE IF EXISTS campaigns");
}

module.exports = { version, name, up, down };
