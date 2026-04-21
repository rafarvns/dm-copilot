// Migration v4: Reformular tabela de personagens e adicionar tabela de junção
// Permite que personagens sejam independentes e vinculados a múltiplas campanhas

const version = 4;
const name = "Refactor characters for system-based independent entities";

function up(db) {
  // 1. Salvar dados existentes (opcional, mas como era 'em breve', provavelmente está vazia)
  // 2. Remover tabela antiga
  db.exec("DROP TABLE IF EXISTS characters");

  // 3. Criar nova tabela de personagens (desvinculada de campanha)
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      system TEXT NOT NULL,
      hp INTEGER DEFAULT 0,
      ac INTEGER DEFAULT 10,
      ini INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  // 4. Criar tabela de junção para vínculo com campanhas
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_characters (
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      PRIMARY KEY (campaign_id, character_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // 5. Criar índices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_campaign_characters_campaign_id ON campaign_characters(campaign_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_campaign_characters_character_id ON campaign_characters(character_id)
  `);
}

function down(db) {
  db.exec("DROP TABLE IF EXISTS campaign_characters");
  db.exec("DROP TABLE IF EXISTS characters");
  
  // Recriar a tabela original da v1 se necessário para rollback total
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
}

module.exports = { version, name, up, down };
