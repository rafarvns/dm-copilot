// Migration v13: Adicionar configuração de visibilidade de dados em combate
// - campaigns.combat_visibility       → JSON com config padrão por afinidade
// - encounters.combat_visibility_override → JSON com sobrescrita opcional do encontro
const version = 13;
const name = "Add combat_visibility (campaigns) and combat_visibility_override (encounters)";

function up(db) {
  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN combat_visibility TEXT`);
  } catch (error) {
    console.warn("Migration v13: Column 'combat_visibility' might already exist on campaigns.");
  }
  try {
    db.exec(`ALTER TABLE encounters ADD COLUMN combat_visibility_override TEXT`);
  } catch (error) {
    console.warn("Migration v13: Column 'combat_visibility_override' might already exist on encounters.");
  }
}

function down(db) {
  // SQLite não suporta DROP COLUMN nativamente em versões antigas.
}

module.exports = { version, name, up, down };
