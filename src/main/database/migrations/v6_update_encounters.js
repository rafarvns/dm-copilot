// Migration v6: Adicionar campo de localização aos encontros
const version = 6;
const name = "Add location field to encounters table";

function up(db) {
  try {
    db.exec(`ALTER TABLE encounters ADD COLUMN location TEXT`);
  } catch (error) {
    console.warn("Migration v6: Column 'location' might already exist or table is missing.");
  }
}

function down(db) {
  // SQLite doesn't support DROP COLUMN in older versions easily, 
  // but for development, we can just leave it or recreate table if needed.
  // Since we use the database-manager's migration system, usually we don't rollback columns.
}

module.exports = { version, name, up, down };
