// Migration v7: Adicionar campo updated_at aos encontros
const version = 7;
const name = "Add updated_at field to encounters table";

function up(db) {
  try {
    db.exec(`ALTER TABLE encounters ADD COLUMN updated_at TEXT`);
  } catch (error) {
    console.warn("Migration v7: Column 'updated_at' might already exist.");
  }
}

function down(db) {
  // SQLite doesn't support DROP COLUMN in older versions easily
}

module.exports = { version, name, up, down };
