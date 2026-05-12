/**
 * Migration: v17_add_character_stats
 * Adiciona CR e ability scores (STR/DEX/CON/INT/WIS/CHA) à tabela characters.
 * Idempotente: cada ALTER TABLE em try/catch, pra não quebrar se a coluna já existir.
 */

const version = 17;
const name = "add_character_stats";

function up(db) {
  const columns = [
    { name: "cr", type: "TEXT" },
    { name: "str", type: "INTEGER" },
    { name: "dex", type: "INTEGER" },
    { name: "con", type: "INTEGER" },
    { name: "int", type: "INTEGER" },
    { name: "wis", type: "INTEGER" },
    { name: "cha", type: "INTEGER" },
  ];

  for (const col of columns) {
    try {
      db.prepare(`ALTER TABLE characters ADD COLUMN "${col.name}" ${col.type}`).run();
    } catch (err) {
      if (!String(err.message).includes("duplicate column name")) throw err;
    }
  }
}

function down(_db) {
  // SQLite não suporta DROP COLUMN simples. No-op (padrão das outras migrations).
}

module.exports = { version, name, up, down };
