/**
 * Migration: v18_add_scene_notes_table
 * Cria tabela scene_notes (1:N com scenes) pra múltiplas anotações por cena.
 * Migra dados existentes de scenes.notes pra primeira nota chamada "Notas".
 */

const version = 18;
const name = "add_scene_notes_table";

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scene_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Nota',
      content TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scene_notes_scene_id
      ON scene_notes(scene_id, position);
  `);

  try {
    const count = db.prepare("SELECT COUNT(*) AS c FROM scene_notes").get();
    if (count.c === 0) {
      db.exec(`
        INSERT INTO scene_notes (scene_id, title, content, position)
        SELECT id, 'Notas', notes, 0
        FROM scenes
        WHERE notes IS NOT NULL AND TRIM(notes) <> ''
      `);
    }
  } catch (err) {
    if (!String(err.message).includes("no such column")) throw err;
  }
}

function down(_db) {}

module.exports = { version, name, up, down };
