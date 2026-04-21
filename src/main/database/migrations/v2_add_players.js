// Migration v2: Adicionar tabela de jogadores
// Exemplo de como adicionar novas funcionalidades

const version = 2;
const name = "Add players table";

function up(db) {
  // Criar tabela de jogadores
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      character_id INTEGER,
      role TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
    )
  `);

  // Criar índice
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_players_campaign_id ON players(campaign_id)
  `);
}

function down(db) {
  // Remover índice
  db.exec("DROP INDEX IF EXISTS idx_players_campaign_id");

  // Remover tabela
  db.exec("DROP TABLE IF EXISTS players");
}

module.exports = { version, name, up, down };
