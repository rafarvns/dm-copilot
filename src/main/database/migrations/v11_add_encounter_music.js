// Migration v11: Adicionar campos de música (URL e arquivo local) aos encontros
const version = 11;
const name = "Add music_url and music_file fields to encounters table";

function up(db) {
  try {
    db.exec(`ALTER TABLE encounters ADD COLUMN music_url TEXT`);
  } catch (error) {
    console.warn("Migration v11: Column 'music_url' might already exist or table is missing.");
  }
  try {
    db.exec(`ALTER TABLE encounters ADD COLUMN music_file TEXT`);
  } catch (error) {
    console.warn("Migration v11: Column 'music_file' might already exist or table is missing.");
  }
}

function down(db) {
  // SQLite não suporta DROP COLUMN nativamente em versões antigas.
}

module.exports = { version, name, up, down };
