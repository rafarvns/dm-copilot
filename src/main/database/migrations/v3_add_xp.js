// Migration v3: Adicionar coluna de XP aos personagens
// Exemplo de como adicionar colunas a tabelas existentes

const version = 3;
const name = "Add XP column to characters";

function up(db) {
  // Adicionar coluna xp à tabela characters
  db.exec(`
    ALTER TABLE characters ADD COLUMN xp INTEGER DEFAULT 0
  `);

  db.exec(`
    ALTER TABLE characters ADD COLUMN next_level_xp INTEGER DEFAULT 300
  `);
}

function down(db) {
  // SQLite não suporta DROP COLUMN diretamente em todas as versões
  // Para reverter, seria necessário recriar a tabela (complexo)
  // Por enquanto, deixar vazio ou adicionar warning
  console.warn("Cannot rollback migration v3 - SQLite limitation");
}

module.exports = { version, name, up, down };
