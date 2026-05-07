// Migration v10: Adicionar campo de imagem de fundo aos encontros
const version = 10;
const name = "Add background_image field to encounters table";

function up(db) {
  try {
    db.exec(`ALTER TABLE encounters ADD COLUMN background_image TEXT`);
  } catch (error) {
    console.warn(
      "Migration v10: Column 'background_image' might already exist or table is missing."
    );
  }
}

function down(db) {
  // SQLite não suporta DROP COLUMN nativamente em versões antigas.
}

module.exports = { version, name, up, down };
