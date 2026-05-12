// Migration v19 — adiciona coluna actions (JSON serializado) à tabela characters.
// Idempotente: ALTER TABLE em try/catch.

module.exports = {
  version: 19,
  name: "add_character_actions",

  up(db) {
    try {
      db.prepare(`ALTER TABLE characters ADD COLUMN actions TEXT`).run();
    } catch (err) {
      if (!String(err.message).includes("duplicate column name")) throw err;
    }
  },

  down(_db) {
    // SQLite não suporta DROP COLUMN simples. No-op (padrão das outras migrations).
  },
};
