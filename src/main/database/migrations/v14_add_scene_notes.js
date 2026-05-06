// Migration v14: Adicionar coluna 'notes' à tabela scenes
const version = 14;
const name = "Add notes column to scenes table";

function up(db) {
  try {
    db.exec(`ALTER TABLE scenes ADD COLUMN notes TEXT`);
  } catch (error) {
    console.warn("Migration v14: Column 'notes' might already exist on scenes.");
  }
}

function down(db) {
  // SQLite não suporta DROP COLUMN nativamente em versões antigas.
}

module.exports = { version, name, up, down };
